import { z } from "zod";

import { emailTokenState, PASSWORD_RESET_MINUTES } from "@/domain/auth/email-token";
import { DomainError } from "@/domain/shared/domain-error";

import { parseInput } from "../shared/input-error";
import type { AuditLogger, Clock } from "../shared/ports";
import { passwordChangedEmail } from "./emails";
import { confirmedPasswordSchema, PASSWORDS_DIFFER } from "./password-schema";
import type {
  EmailTokenRepository,
  Mailer,
  PasswordHasher,
  PasswordRepository,
  TokenService,
} from "./ports";

export const resetPasswordSchema = z
  .object(confirmedPasswordSchema)
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: PASSWORDS_DIFFER,
  });
export type ResetPasswordField = keyof z.input<typeof resetPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export interface ResetPasswordDeps {
  passwords: PasswordRepository;
  emailTokens: EmailTokenRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  mailer: Mailer;
  audit: AuditLogger;
  clock: Clock;
  appUrl: string;
}

const INVALID_LINK = new DomainError(
  "INVALID_LINK",
  "El enlace no es válido. Revisa que lo hayas abierto completo desde el correo.",
);
const USED_LINK = new DomainError(
  "LINK_USED",
  "Este enlace ya se usó. Si necesitas cambiar tu contraseña otra vez, pide un enlace nuevo.",
);
const EXPIRED_LINK = new DomainError(
  "LINK_EXPIRED",
  `El enlace ya venció (dura ${PASSWORD_RESET_MINUTES} minutos). Pide uno nuevo.`,
);

/**
 * Elegir contraseña nueva con el enlace del correo (RF-005). El enlace sirve una sola vez y,
 * al usarlo, se cierran todas las sesiones de la cuenta.
 */
export function createResetPassword(deps: ResetPasswordDeps) {
  async function findValidToken(token: string) {
    if (!token || token.length > 200) throw INVALID_LINK;
    const record = await deps.emailTokens.findByHash(deps.tokens.hash(token), "PASSWORD_RESET");
    if (!record) throw INVALID_LINK;
    const state = emailTokenState(record, deps.clock.now());
    if (state === "USED") throw USED_LINK;
    if (state === "EXPIRED") throw EXPIRED_LINK;
    return record;
  }

  return async function resetPassword(token: string, input: ResetPasswordInput): Promise<void> {
    const record = await findValidToken(token);
    const { password } = parseInput<ResetPasswordField, typeof resetPasswordSchema>(
      resetPasswordSchema,
      input,
    );
    const passwordHash = await deps.hasher.hash(password);
    const now = deps.clock.now();
    const done = await deps.passwords.resetWithToken(record.id, record.userId, passwordHash, now);
    if (!done) throw USED_LINK;

    await deps.audit.log({
      userId: record.userId,
      action: "PASSWORD_RESET",
      entity: "user",
      entityId: record.userId,
    });
    const account = await deps.passwords.findById(record.userId);
    if (account) {
      await deps.mailer.send(passwordChangedEmail(account.email, account.fullName, deps.appUrl));
    }
  };
}
