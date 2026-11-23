import { z } from "zod";

import {
  MAX_PASSWORD_RESETS_PER_WINDOW,
  minutesAfter,
  PASSWORD_RESET_MINUTES,
} from "@/domain/auth/email-token";

import { parseInput } from "../shared/input-error";
import type { AuditLogger, Clock } from "../shared/ports";
import { passwordResetEmail } from "./emails";
import { emailSchema } from "./password-schema";
import type { Mailer, PasswordRepository, TokenService } from "./ports";

export const requestPasswordResetSchema = z.object({ email: emailSchema });
export type RequestPasswordResetField = keyof z.input<typeof requestPasswordResetSchema>;

export interface RequestPasswordResetDeps {
  passwords: PasswordRepository;
  tokens: TokenService;
  mailer: Mailer;
  audit: AuditLogger;
  clock: Clock;
  appUrl: string;
}

/**
 * Pedir un enlace para recuperar la contraseña (RF-005). La respuesta es la misma exista o no
 * el correo (no revela qué cuentas existen). Solo se manda a cuentas activas, y como máximo
 * 3 enlaces cada 30 minutos por cuenta (para que nadie llene el buzón de otra persona).
 */
export function createRequestPasswordReset(deps: RequestPasswordResetDeps) {
  return async function requestPasswordReset(input: { email: string }): Promise<{ email: string }> {
    const { email } = parseInput<RequestPasswordResetField, typeof requestPasswordResetSchema>(
      requestPasswordResetSchema,
      input,
    );
    const now = deps.clock.now();
    const account = await deps.passwords.findAccountByEmail(email);
    if (account?.status !== "ACTIVE") return { email };

    const recent = await deps.passwords.countResetTokensExpiringAfter(account.id, now);
    if (recent >= MAX_PASSWORD_RESETS_PER_WINDOW) return { email };

    const token = deps.tokens.generate();
    await deps.passwords.addResetToken({
      userId: account.id,
      tokenHash: deps.tokens.hash(token),
      expiresAt: minutesAfter(now, PASSWORD_RESET_MINUTES),
    });
    await deps.audit.log({
      userId: account.id,
      action: "PASSWORD_RESET_REQUESTED",
      entity: "user",
      entityId: account.id,
    });
    await deps.mailer.send(
      passwordResetEmail(email, account.fullName, deps.appUrl, token, PASSWORD_RESET_MINUTES),
    );
    return { email };
  };
}
