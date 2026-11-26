import {
  hasIdleTimeout,
  isIdleExpired,
  isSessionExpired,
  shouldRecordActivity,
} from "@/domain/auth/session-policy";

import type { AuditLogger, Clock } from "../shared/ports";
import type { AuthSettingsProvider, CurrentUser, SessionRepository, TokenService } from "./ports";

export interface SessionDeps {
  sessions: SessionRepository;
  settings: AuthSettingsProvider;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
}

/**
 * Usuario dueño del token de la cookie, o null si no hay sesión válida. La sesión se borra
 * en ese momento si venció, si la cuenta ya no está activa, si se retiró la computadora
 * autorizada o si el personal pasó demasiado tiempo sin actividad (RF-012).
 */
export function createGetCurrentUser(deps: SessionDeps) {
  return async function getCurrentUser(token: string | undefined): Promise<CurrentUser | null> {
    if (!token) return null;
    const tokenHash = deps.tokens.hash(token);
    const found = await deps.sessions.findByTokenHash(tokenHash);
    if (!found) return null;

    const now = deps.clock.now();
    const { status, ...user } = found.user;
    const invalid =
      isSessionExpired(found.expiresAt, now) ||
      status !== "ACTIVE" ||
      (found.deviceStatus !== null && found.deviceStatus !== "APPROVED");
    if (invalid) {
      await deps.sessions.deleteByTokenHash(tokenHash);
      return null;
    }

    if (hasIdleTimeout(user.role)) {
      const { staffIdleMinutes } = await deps.settings.get();
      if (isIdleExpired(found.lastActivityAt, now, staffIdleMinutes)) {
        await deps.sessions.deleteByTokenHash(tokenHash);
        await deps.audit.log({
          userId: user.id,
          action: "SESSION_EXPIRED_IDLE",
          entity: "user",
          entityId: user.id,
        });
        return null;
      }
      if (shouldRecordActivity(found.lastActivityAt, now)) {
        await deps.sessions.recordActivity(tokenHash, now);
      }
    }
    return user;
  };
}

/** Cerrar sesión (RF-004): borra la sesión de la base. La cookie la borra quien llama. */
export function createLogout(deps: Pick<SessionDeps, "sessions" | "tokens" | "audit">) {
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
