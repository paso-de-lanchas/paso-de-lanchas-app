import { isSessionExpired } from "@/domain/auth/session-policy";

import type { AuditLogger, Clock } from "../shared/ports";
import type { CurrentUser, SessionRepository, TokenService } from "./ports";

export interface SessionDeps {
  sessions: SessionRepository;
  tokens: TokenService;
  clock: Clock;
}

/**
 * Usuario dueño del token de la cookie, o null si no hay sesión válida.
 * Una sesión vencida o de una cuenta que ya no está activa se borra en ese momento.
 */
export function createGetCurrentUser(deps: SessionDeps) {
  return async function getCurrentUser(token: string | undefined): Promise<CurrentUser | null> {
    if (!token) return null;
    const tokenHash = deps.tokens.hash(token);
    const found = await deps.sessions.findByTokenHash(tokenHash);
    if (!found) return null;

    const { status, ...user } = found.user;
    if (isSessionExpired(found.expiresAt, deps.clock.now()) || status !== "ACTIVE") {
      await deps.sessions.deleteByTokenHash(tokenHash);
      return null;
    }
    return user;
  };
}

/** Cerrar sesión (RF-004): borra la sesión de la base. La cookie la borra quien llama. */
export function createLogout(deps: Omit<SessionDeps, "clock"> & { audit: AuditLogger }) {
  return async function logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const deleted = await deps.sessions.deleteByTokenHash(deps.tokens.hash(token));
    if (deleted) {
      await deps.audit.log({
        userId: deleted.userId,
        action: "LOGOUT",
        entity: "user",
        entityId: deleted.userId,
      });
    }
  };
}
