import { z } from "zod";

import { checkDevice, requiresAuthorizedDevice } from "@/domain/auth/authorized-device";
import {
  hasLockout,
  isLocked,
  lockedUntilFrom,
  minutesUntilUnlock,
  shouldLock,
} from "@/domain/auth/lockout";
import { redirectAfterLogin } from "@/domain/auth/roles";
import { sessionExpiresAt } from "@/domain/auth/session-policy";
import { DomainError } from "@/domain/shared/domain-error";

import type { AuditLogger, Clock } from "../shared/ports";
import type {
  AuthorizedDeviceRepository,
  AuthSettingsProvider,
  CurrentUser,
  PasswordHasher,
  SessionRepository,
  TokenService,
  UserCredentials,
  UserCredentialsRepository,
} from "./ports";

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(120).pipe(z.email()),
  password: z.string().min(1).max(256),
  next: z.string().max(300).optional(),
});

export type LoginInput = z.input<typeof loginInputSchema>;

/** Datos de la petición que no escribe el usuario: el token de la cookie de la computadora. */
export interface LoginContext {
  deviceToken?: string;
}

export interface LoginResult {
  /** Token en claro: solo va en la cookie, nunca a la base ni a la bitácora. */
  token: string;
  expiresAt: Date;
  user: CurrentUser;
  redirectTo: string;
}

export interface LoginDeps {
  users: UserCredentialsRepository;
  sessions: SessionRepository;
  devices: AuthorizedDeviceRepository;
  settings: AuthSettingsProvider;
  hasher: PasswordHasher;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
}

/** El mismo mensaje para correo inexistente o contraseña incorrecta (no revela qué cuentas existen). */
export const INVALID_CREDENTIALS = new DomainError(
  "INVALID_CREDENTIALS",
  "Correo o contraseña incorrectos.",
);

/**
 * La computadora no está autorizada. Si se le asignó un token nuevo, `deviceToken` trae el
 * valor que hay que guardar en su cookie para que el superadministrador pueda aprobarla.
 */
export class DeviceNotAuthorizedError extends DomainError {
  constructor(
    code: string,
    message: string,
    readonly deviceToken?: string,
  ) {
    super(code, message);
    this.name = "DeviceNotAuthorizedError";
  }
}

const DEVICE_PENDING_MESSAGE =
  "Esta computadora todavía no está autorizada. Ya se envió la solicitud: pide al " +
  "superadministrador que la apruebe y vuelve a intentarlo.";

/**
 * Iniciar sesión (RF-003) con las protecciones del personal: bloqueo por intentos fallidos
 * (RF-010) y computadoras autorizadas (RF-011). Crea una sesión en la base y devuelve el
 * token para la cookie.
 */
export function createLogin(deps: LoginDeps) {
  // Hash de relleno: si el correo no existe, igual se verifica una contraseña para que la
  // respuesta tarde lo mismo y no se pueda adivinar qué correos están registrados.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= deps.hasher.hash("contraseña-de-relleno"));

  const audit = (
    user: UserCredentials | null,
    action: string,
    details?: Record<string, unknown>,
    deviceId?: string,
  ) =>
    deps.audit.log({
      userId: user?.id ?? null,
      deviceId: deviceId ?? null,
      action,
      entity: "user",
      entityId: user?.id ?? null,
      details,
    });

  async function registerFailure(user: UserCredentials, now: Date) {
    const { maxFailedLogins, lockoutMinutes } = await deps.settings.get();
    const attempts = await deps.users.recordFailedLogin(user.id);
    if (shouldLock(attempts, maxFailedLogins)) {
      const until = lockedUntilFrom(now, lockoutMinutes);
      await deps.users.lock(user.id, until);
      await audit(user, "ACCOUNT_LOCKED", { attempts, lockedUntil: until.toISOString() });
    }
  }

  /** Devuelve el id de la computadora autorizada (o null si el rol no la necesita). */
  async function authorizeDevice(user: UserCredentials, deviceToken?: string) {
    if (!requiresAuthorizedDevice(user.role)) return null;

    const device = deviceToken
      ? await deps.devices.findByTokenHash(deps.tokens.hash(deviceToken))
      : null;
    const check = checkDevice(user, device);
    if (check === "ALLOWED") return device!.id;

    if (check === "UNKNOWN") {
      const newToken = deviceToken ? undefined : deps.tokens.generate();
      const request = await deps.devices.requestApproval({
        tokenHash: deps.tokens.hash(deviceToken ?? newToken!),
        dockId: user.dockId,
        name: `Computadora de ${user.fullName}`.slice(0, 60),
        requestedById: user.id,
      });
      await audit(user, "DEVICE_APPROVAL_REQUESTED", undefined, request.id);
      throw new DeviceNotAuthorizedError("DEVICE_PENDING", DEVICE_PENDING_MESSAGE, newToken);
    }

    await audit(user, "LOGIN_REJECTED_DEVICE", { reason: check }, device!.id);
    if (check === "PENDING")
      throw new DeviceNotAuthorizedError("DEVICE_PENDING", DEVICE_PENDING_MESSAGE);
    if (check === "REVOKED") {
      throw new DeviceNotAuthorizedError(
        "DEVICE_REVOKED",
        "El acceso desde esta computadora fue retirado. Contacta al superadministrador.",
      );
    }
    throw new DeviceNotAuthorizedError(
      "DEVICE_WRONG_DOCK",
      "Esta computadora es de otro muelle. Inicia sesión desde la taquilla de tu muelle.",
    );
  }

  return async function login(input: LoginInput, context: LoginContext = {}): Promise<LoginResult> {
    const parsed = loginInputSchema.safeParse(input);
    if (!parsed.success) throw INVALID_CREDENTIALS;
    const { email, password, next } = parsed.data;
    const now = deps.clock.now();

    const user = await deps.users.findByEmail(email);
    const locked = !!user && hasLockout(user.role) && isLocked(user.lockedUntil, now);
    const passwordOk = await deps.hasher.verify(
      user?.passwordHash ?? (await getDummyHash()),
      password,
    );

    if (!user || !passwordOk) {
      // Durante el bloqueo no se suman intentos: así nadie lo alarga indefinidamente.
      if (user && hasLockout(user.role) && !locked) await registerFailure(user, now);
      await audit(user, "LOGIN_FAILED", { reason: user ? "WRONG_PASSWORD" : "UNKNOWN_EMAIL" });
      throw INVALID_CREDENTIALS;
    }

    // Lo que sigue solo se revela a quien ya demostró conocer la contraseña.
    if (locked) {
      await audit(user, "LOGIN_REJECTED_LOCKED");
      const minutes = minutesUntilUnlock(user.lockedUntil!, now);
      throw new DomainError(
        "ACCOUNT_LOCKED",
        `Por seguridad, tu cuenta está bloqueada por muchos intentos fallidos. Intenta de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
      );
    }
    if (user.status === "PENDING_VERIFICATION") {
      throw new DomainError(
        "EMAIL_NOT_VERIFIED",
        "Confirma tu correo con el enlace que te enviamos antes de iniciar sesión.",
      );
    }
    if (user.status !== "ACTIVE") {
      throw new DomainError(
        "ACCOUNT_DISABLED",
        "Tu cuenta está bloqueada o inactiva. Acude a la taquilla o contacta al administrador.",
      );
    }

    const deviceId = await authorizeDevice(user, context.deviceToken);

    if (user.failedLoginAttempts > 0 || user.lockedUntil)
      await deps.users.clearFailedLogins(user.id);
    if (deviceId) await deps.devices.markSeen(deviceId, now);

    const token = deps.tokens.generate();
    const expiresAt = sessionExpiresAt(user.role, now);
    await deps.sessions.create({
      userId: user.id,
      tokenHash: deps.tokens.hash(token),
      expiresAt,
      deviceId,
    });
    await audit(user, "LOGIN_SUCCEEDED", undefined, deviceId ?? undefined);

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      redirectTo: redirectAfterLogin(user.role, next),
    };
  };
}
