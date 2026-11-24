import { smtpMailer } from "@/infrastructure/auth/smtp-mailer";
import { env } from "@/lib/env";

/** Correo de la app por SMTP (Mailpit en local). Solo se usa en el servidor. */
export const mailer = smtpMailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  user: env.SMTP_USER,
  password: env.SMTP_PASSWORD,
  from: env.MAIL_FROM,
});
