import type { StaffRole } from "@/domain/staff/staff-rules";

import { emailLayout, escapeHtml } from "../auth/emails";
import type { EmailMessage } from "../auth/ports";

/** Correos de las cuentas del personal. La contraseña temporal se debe cambiar al entrar. */

const ROLE_LABEL: Record<StaffRole, string> = { ADMIN: "administrador", DRIVER: "chofer" };

function temporaryPasswordEmail(
  to: string,
  fullName: string,
  appUrl: string,
  temporaryPassword: string,
  intro: string,
  subject: string,
): EmailMessage {
  const url = `${appUrl}/login`;
  return {
    to,
    subject,
    text:
      `Hola, ${fullName}.\n\n${intro}\n\nContraseña temporal: ${temporaryPassword}\n\n` +
      `Inicia sesión aquí: ${url}\nAl entrar tendrás que elegir una contraseña nueva.`,
    html: emailLayout(
      [
        `Hola, ${escapeHtml(fullName)}.`,
        escapeHtml(intro),
        `Contraseña temporal: <strong style="font-family:monospace;font-size:18px">${escapeHtml(temporaryPassword)}</strong>`,
        "Al entrar tendrás que elegir una contraseña nueva.",
      ],
      { label: "Iniciar sesión", url },
    ),
  };
}

export function staffWelcomeEmail(
  to: string,
  fullName: string,
  role: StaffRole,
  appUrl: string,
  temporaryPassword: string,
): EmailMessage {
  return temporaryPasswordEmail(
    to,
    fullName,
    appUrl,
    temporaryPassword,
    `El superadministrador creó tu cuenta de ${ROLE_LABEL[role]} en Paso de Lanchas.`,
    "Tu cuenta del personal · Paso de Lanchas",
  );
}

export function staffPasswordResetEmail(
  to: string,
  fullName: string,
  appUrl: string,
  temporaryPassword: string,
): EmailMessage {
  return temporaryPasswordEmail(
    to,
    fullName,
    appUrl,
    temporaryPassword,
    "El superadministrador restableció tu contraseña y cerró tus sesiones abiertas.",
    "Tu contraseña fue restablecida · Paso de Lanchas",
  );
}
