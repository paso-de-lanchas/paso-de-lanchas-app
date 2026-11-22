import { cookies } from "next/headers";
import { cache } from "react";

import { createLogin, type LoginInput, type LoginResult } from "@/application/auth/login";
import type { CurrentUser } from "@/application/auth/ports";
import { createGetCurrentUser, createLogout } from "@/application/auth/session";
import { systemClock } from "@/application/shared/ports";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { argon2PasswordHasher } from "@/infrastructure/auth/argon2-password-hasher";
import { cryptoTokenService } from "@/infrastructure/auth/crypto-token-service";
import {
  prismaSessionRepository,
  prismaUserCredentialsRepository,
} from "@/infrastructure/auth/prisma-auth-repositories";
import { prisma } from "@/infrastructure/db/prisma";

import { SESSION_COOKIE, sessionCookieOptions } from "./session-cookie";

/**
 * Punto de unión del módulo de autenticación con Next.js: arma los casos de uso con sus
 * implementaciones reales y maneja la cookie. Solo se usa en el servidor.
 */
const sessions = prismaSessionRepository(prisma);
const audit = prismaAuditLogger(prisma);

const loginUseCase = createLogin({
  users: prismaUserCredentialsRepository(prisma),
  sessions,
  hasher: argon2PasswordHasher,
  tokens: cryptoTokenService,
  audit,
  clock: systemClock,
});
const getCurrentUserUseCase = createGetCurrentUser({
  sessions,
  tokens: cryptoTokenService,
  clock: systemClock,
});
const logoutUseCase = createLogout({ sessions, tokens: cryptoTokenService, audit });

/** Inicia sesión y guarda la cookie. Solo desde una Server Action o una ruta API. */
export async function signIn(input: LoginInput): Promise<LoginResult> {
  const result = await loginUseCase(input);
  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
  return result;
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
