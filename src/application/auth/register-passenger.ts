import { z } from "zod";

import { EMAIL_VERIFICATION_HOURS, emailTokenExpiresAt } from "@/domain/auth/email-token";
import { normalizeMexicanPhone } from "@/domain/auth/phone";

import { InputError, parseInput } from "../shared/input-error";
import type { AuditLogger, Clock } from "../shared/ports";
import { alreadyRegisteredEmail, verificationEmail } from "./emails";
import { emailSchema, newPasswordSchema } from "./password-schema";
import type {
  Mailer,
  PassengerRegistrationRepository,
  PasswordHasher,
  TokenService,
} from "./ports";

export const registerInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre completo.")
    .max(120, "El nombre es demasiado largo."),
  email: emailSchema,
  phone: z.string().transform((value, ctx) => {
    const phone = normalizeMexicanPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Escribe tu celular a 10 dígitos." });
      return z.NEVER;
    }
    return phone;
  }),
  password: newPasswordSchema,
  acceptPrivacy: z.literal(true, "Debes aceptar el aviso de privacidad para crear tu cuenta."),
});

/** Lo que llega del formulario, todavía sin validar. */
export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  acceptPrivacy: boolean;
}
export type RegisterField = keyof RegisterInput;

/** Datos inválidos del registro, con el mensaje de cada campo (es un InputError). */
export const RegistrationInputError = InputError;
export type RegistrationInputError = InputError<RegisterField>;

export interface RegisterDeps {
  accounts: PassengerRegistrationRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  mailer: Mailer;
  audit: AuditLogger;
  clock: Clock;
  appUrl: string;
}

/**
 * Registro de pasajero (RF-001, RF-002). Solo crea pasajeros: no existe forma pública de
 * crear personal (RF-007). La respuesta es la misma aunque el correo ya esté registrado,
 * para no revelar qué correos tienen cuenta; en ese caso se avisa al dueño por correo.
 */
export function createRegisterPassenger(deps: RegisterDeps) {
  return async function registerPassenger(input: RegisterInput): Promise<{ email: string }> {
    const { fullName, email, phone, password } = parseInput<
      RegisterField,
      typeof registerInputSchema
    >(registerInputSchema, input);
    const now = deps.clock.now();

    // Se calcula siempre, exista o no el correo, para que la respuesta tarde parecido.
    const passwordHash = await deps.hasher.hash(password);
    const token = deps.tokens.generate();
    const tokenHash = deps.tokens.hash(token);
    const expiresAt = emailTokenExpiresAt(now, EMAIL_VERIFICATION_HOURS);

    const existing = await deps.accounts.findAccountByEmail(email);
    const created = existing
      ? null
      : await deps.accounts.createPassenger({
          email,
          fullName,
          phone,
          passwordHash,
          privacyAcceptedAt: now,
          verificationTokenHash: tokenHash,
          verificationExpiresAt: expiresAt,
        });

    if (created) {
      await deps.audit.log({
        userId: created.id,
        action: "USER_REGISTERED",
        entity: "user",
        entityId: created.id,
      });
      await deps.mailer.send(
        verificationEmail(email, fullName, deps.appUrl, token, EMAIL_VERIFICATION_HOURS),
      );
      return { email };
    }

    // El correo ya existía (o se registró al mismo tiempo en otra petición).
    const account = existing ?? (await deps.accounts.findAccountByEmail(email));
    if (account?.status === "PENDING_VERIFICATION") {
      // No confirmó a tiempo: se le manda un enlace nuevo, sin cambiar sus datos.
      await deps.accounts.addEmailToken({
        userId: account.id,
        purpose: "EMAIL_VERIFICATION",
        tokenHash,
        expiresAt,
      });
      await deps.mailer.send(
        verificationEmail(email, account.fullName, deps.appUrl, token, EMAIL_VERIFICATION_HOURS),
      );
    } else if (account) {
      await deps.mailer.send(alreadyRegisteredEmail(email, account.fullName, deps.appUrl));
    }
    return { email };
  };
}
