import { cookies } from "next/headers";
import { cache } from "react";

import {
  createLogin,
  DeviceNotAuthorizedError,
  type LoginInput,
  type LoginResult,
} from "@/application/auth/login";
import { createChangePassword, type ChangePasswordInput } from "@/application/auth/change-password";
import type { CurrentUser } from "@/application/auth/ports";
import { createRegisterPassenger } from "@/application/auth/register-passenger";
import { createRequestPasswordReset } from "@/application/auth/request-password-reset";
import { createResetPassword } from "@/application/auth/reset-password";
import { createGetCurrentUser, createLogout } from "@/application/auth/session";
import { createVerifyEmail } from "@/application/auth/verify-email";
import { systemClock } from "@/application/shared/ports";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { argon2PasswordHasher } from "@/infrastructure/auth/argon2-password-hasher";
import { cryptoTokenService } from "@/infrastructure/auth/crypto-token-service";
import {
  prismaAuthorizedDeviceRepository,
  prismaSessionRepository,
  prismaUserCredentialsRepository,
} from "@/infrastructure/auth/prisma-auth-repositories";
import { prismaAuthSettings } from "@/infrastructure/auth/prisma-auth-settings";
import { prismaPasswordRepository } from "@/infrastructure/auth/prisma-password-repository";
import {
  prismaEmailTokenRepository,
  prismaPassengerRegistrationRepository,
} from "@/infrastructure/auth/prisma-registration-repositories";
import { prisma } from "@/infrastructure/db/prisma";
import { DomainError } from "@/domain/shared/domain-error";
import { env } from "@/lib/env";
import { mailer } from "@/lib/mailer";

import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./session-cookie";

/**
 * Punto de unión del módulo de autenticación con Next.js: arma los casos de uso con sus
 * implementaciones reales y maneja la cookie. Solo se usa en el servidor.
 */
const sessions = prismaSessionRepository(prisma);
const audit = prismaAuditLogger(prisma);
const settings = prismaAuthSettings(prisma);

const loginUseCase = createLogin({
  users: prismaUserCredentialsRepository(prisma),
  sessions,
  devices: prismaAuthorizedDeviceRepository(prisma),
  settings,
  hasher: argon2PasswordHasher,
  tokens: cryptoTokenService,
  audit,
  clock: systemClock,
});
const getCurrentUserUseCase = createGetCurrentUser({
  sessions,
  settings,
  tokens: cryptoTokenService,
  audit,
  clock: systemClock,
});
const logoutUseCase = createLogout({ sessions, tokens: cryptoTokenService, audit });

const passwords = prismaPasswordRepository(prisma);
const emailTokens = prismaEmailTokenRepository(prisma);

/** Registro de pasajero (RF-001). Lanza RegistrationInputError con el error de cada campo. */
export const registerPassenger = createRegisterPassenger({
  accounts: prismaPassengerRegistrationRepository(prisma),
  hasher: argon2PasswordHasher,
  tokens: cryptoTokenService,
  mailer,
  audit,
  clock: systemClock,
  appUrl: env.APP_URL,
});

/** Confirmar el correo con el enlace (RF-002). */
export const verifyEmail = createVerifyEmail({
  emailTokens,
  tokens: cryptoTokenService,
  audit,
  clock: systemClock,
});

/** Pedir enlace para recuperar la contraseña (RF-005). Responde igual exista o no el correo. */
export const requestPasswordReset = createRequestPasswordReset({
  passwords,
  tokens: cryptoTokenService,
  mailer,
  audit,
  clock: systemClock,
  appUrl: env.APP_URL,
});

/** Elegir contraseña nueva con el enlace del correo (RF-005); cierra todas las sesiones. */
export const resetPassword = createResetPassword({
  passwords,
  emailTokens,
  hasher: argon2PasswordHasher,
  tokens: cryptoTokenService,
  mailer,
  audit,
  clock: systemClock,
  appUrl: env.APP_URL,
});

const changePasswordUseCase = createChangePassword({
  passwords,
  hasher: argon2PasswordHasher,
  tokens: cryptoTokenService,
  mailer,
  audit,
  appUrl: env.APP_URL,
});

/**
 * Cambiar la contraseña del usuario con sesión (RF-006, RF-013). Conserva esta sesión y
 * cierra las demás. Devuelve al usuario para mandarlo a su sección.
 */
export async function changeOwnPassword(input: ChangePasswordInput): Promise<CurrentUser> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getCurrentUser();
  if (!token || !user) throw new DomainError("UNAUTHENTICATED", "Inicia sesión para continuar.");
  await changePasswordUseCase({ userId: user.id, token }, input);
  return { ...user, mustChangePassword: false };
}

/** Inicia sesión y guarda la cookie. Solo desde una Server Action o una ruta API. */
export async function signIn(input: LoginInput): Promise<LoginResult> {
  const store = await cookies();
  try {
    const result = await loginUseCase(input, { deviceToken: store.get(DEVICE_COOKIE)?.value });
    store.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
    return result;
  } catch (error) {
    // Computadora nueva: se guarda su token para que, ya aprobada, la reconozca.
    if (error instanceof DeviceNotAuthorizedError && error.deviceToken) {
      store.set(DEVICE_COOKIE, error.deviceToken, deviceCookieOptions());
    }
    throw error;
  }
}

/** Cierra la sesión en la base y borra la cookie. Solo desde una Server Action o una ruta API. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  await logoutUseCase(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}

/**
 * Usuario con sesión válida, o null. Se consulta la base una sola vez por petición
 * (React `cache`), aunque varias partes de la página lo pidan.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getCurrentUserUseCase(token);
});
