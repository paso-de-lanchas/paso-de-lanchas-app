import { z } from "zod";

import { PASSWORD_MAX_LENGTH } from "@/domain/auth/password-policy";
import { DomainError } from "@/domain/shared/domain-error";

import { InputError, parseInput } from "../shared/input-error";
import type { AuditLogger } from "../shared/ports";
import { passwordChangedEmail } from "./emails";
import { confirmedPasswordSchema, PASSWORDS_DIFFER } from "./password-schema";
import type { Mailer, PasswordHasher, PasswordRepository, TokenService } from "./ports";

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Escribe tu contraseña actual.")
      .max(PASSWORD_MAX_LENGTH + 1),
    ...confirmedPasswordSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: PASSWORDS_DIFFER,
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ["password"],
    message: "La contraseña nueva debe ser distinta de la actual.",
  });
export type ChangePasswordField = keyof z.input<typeof changePasswordSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export interface ChangePasswordDeps {
  passwords: PasswordRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  mailer: Mailer;
  audit: AuditLogger;
  appUrl: string;
}

/**
 * Cambiar la contraseña desde la cuenta (RF-006), también la temporal del personal (RF-013).
 * Pide la actual, conserva la sesión en uso y cierra las demás.
 */
export function createChangePassword(deps: ChangePasswordDeps) {
  return async function changePassword(
    session: { userId: string; token: string },
    input: ChangePasswordInput,
  ): Promise<void> {
    const { currentPassword, password } = parseInput<
      ChangePasswordField,
      typeof changePasswordSchema
    >(changePasswordSchema, input);

    const account = await deps.passwords.findById(session.userId);
    if (!account) throw new DomainError("UNAUTHENTICATED", "Inicia sesión para continuar.");
    if (!(await deps.hasher.verify(account.passwordHash, currentPassword))) {
      await deps.audit.log({
        userId: session.userId,
        action: "PASSWORD_CHANGE_FAILED",
        entity: "user",
        entityId: session.userId,
      });
      throw new InputError<ChangePasswordField>({
        currentPassword: "La contraseña actual no es correcta.",
      });
    }

    await deps.passwords.changePassword(
      session.userId,
      await deps.hasher.hash(password),
      deps.tokens.hash(session.token),
    );
    await deps.audit.log({
      userId: session.userId,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: session.userId,
    });
    await deps.mailer.send(passwordChangedEmail(account.email, account.fullName, deps.appUrl));
  };
}
