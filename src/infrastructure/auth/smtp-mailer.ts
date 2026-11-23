import nodemailer from "nodemailer";

import type { Mailer } from "@/application/auth/ports";

/**
 * Envía correos por SMTP. En local va a Mailpit (http://localhost:8025): ningún correo sale
 * a internet. En producción usa el proveedor configurado en las variables SMTP_*.
 */
export function smtpMailer(config: {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, ...message });
    },
  };
}
