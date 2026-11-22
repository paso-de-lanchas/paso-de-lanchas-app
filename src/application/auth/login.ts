import { z } from "zod";

import { redirectAfterLogin } from "@/domain/auth/roles";
import { sessionExpiresAt } from "@/domain/auth/session-policy";
import { DomainError } from "@/domain/shared/domain-error";

import type { AuditLogger, Clock } from "../shared/ports";
import type {
  CurrentUser,
  PasswordHasher,
  SessionRepository,
  TokenService,
  UserCredentialsRepository,
} from "./ports";

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(120).pipe(z.email()),
  password: z.string().min(1).max(256),
  next: z.string().max(300).optional(),
});

export type LoginInput = z.input<typeof loginInputSchema>;

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
 * Iniciar sesión (RF-003). Crea una sesión en la base y devuelve el token para la cookie.
 */
export function createLogin(deps: LoginDeps) {
  // Hash de relleno: si el correo no existe, igual se verifica una contraseña para que la
  // respuesta tarde lo mismo y no se pueda adivinar qué correos están registrados.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= deps.hasher.hash("contraseña-de-relleno"));

  return async function login(input: LoginInput): Promise<LoginResult> {
    const parsed = loginInputSchema.safeParse(input);
    if (!parsed.success) throw INVALID_CREDENTIALS;
    const { email, password, next } = parsed.data;

    const user = await deps.users.findByEmail(email);
    const passwordOk = await deps.hasher.verify(
      user?.passwordHash ?? (await getDummyHash()),
      password,
    );

    if (!user || !passwordOk) {
      await deps.audit.log({
        userId: user?.id ?? null,
        action: "LOGIN_FAILED",
        entity: "user",
        entityId: user?.id ?? null,
        details: { reason: user ? "WRONG_PASSWORD" : "UNKNOWN_EMAIL" },
      });
      throw INVALID_CREDENTIALS;
    }

    // Solo se revela el estado de la cuenta a quien ya demostró conocer la contraseña.
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

    const token = deps.tokens.generate();
    const expiresAt = sessionExpiresAt(user.role, deps.clock.now());
    await deps.sessions.create({ userId: user.id, tokenHash: deps.tokens.hash(token), expiresAt });
    await deps.audit.log({
      userId: user.id,
      action: "LOGIN_SUCCEEDED",
      entity: "user",
      entityId: user.id,
    });

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
