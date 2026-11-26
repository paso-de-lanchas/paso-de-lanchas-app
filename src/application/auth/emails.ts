import type { EmailMessage } from "./ports";

/** Correos del módulo de autenticación. `appUrl` es la dirección pública de la app. */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** El nombre lo escribe el usuario: se escapa para que no pueda meter HTML en el correo. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function emailLayout(paragraphs: string[], button: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join("");
  const action =
    `<p><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 20px;` +
    `background:#0b3c5d;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:bold">` +
    `${escapeHtml(button.label)}</a></p>`;
  const footer = `<p style="color:#4a5b68;font-size:13px">Paso de Lanchas · Coatzacoalcos ⇄ Villa Allende</p>`;
  return `<div style="font-family:system-ui,sans-serif;color:#0f2433;max-width:480px">${body}${action}${footer}</div>`;
}

export function verificationEmail(
  to: string,
  fullName: string,
  appUrl: string,
  token: string,
  hours: number,
): EmailMessage {
  const url = `${appUrl}/verificar-correo?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Confirma tu correo · Paso de Lanchas",
    text:
      `Hola, ${fullName}.\n\nPara activar tu cuenta abre este enlace (vence en ${hours} horas):\n${url}\n\n` +
      "Si no creaste una cuenta, ignora este correo.",
    html: emailLayout(
      [
        `Hola, ${escapeHtml(fullName)}.`,
        `Para activar tu cuenta confirma tu correo. El enlace vence en ${hours} horas.`,
        "Si no creaste una cuenta, ignora este correo.",
      ],
      { label: "Confirmar mi correo", url },
    ),
  };
}

export function alreadyRegisteredEmail(to: string, fullName: string, appUrl: string): EmailMessage {
  const url = `${appUrl}/login`;
  return {
    to,
    subject: "Ya tienes una cuenta · Paso de Lanchas",
    text:
      `Hola, ${fullName}.\n\nAlguien intentó crear una cuenta con tu correo, pero ya tienes una.\n` +
      `Inicia sesión aquí: ${url}\n\nSi no fuiste tú, puedes ignorar este correo.`,
    html: emailLayout(
      [
        `Hola, ${escapeHtml(fullName)}.`,
        "Alguien intentó crear una cuenta con tu correo, pero ya tienes una.",
        "Si no fuiste tú, puedes ignorar este correo.",
      ],
      { label: "Iniciar sesión", url },
    ),
  };
}

export function passwordResetEmail(
  to: string,
  fullName: string,
  appUrl: string,
  token: string,
  minutes: number,
): EmailMessage {
  const url = `${appUrl}/recuperar/${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Recupera tu contraseña · Paso de Lanchas",
    text:
      `Hola, ${fullName}.\n\nPara elegir una contraseña nueva abre este enlace (vence en ${minutes} minutos y sirve una sola vez):\n${url}\n\n` +
      "Si no lo pediste, ignora este correo: tu contraseña no cambia.",
    html: emailLayout(
      [
        `Hola, ${escapeHtml(fullName)}.`,
        `Para elegir una contraseña nueva usa este enlace. Vence en ${minutes} minutos y sirve una sola vez.`,
        "Si no lo pediste, ignora este correo: tu contraseña no cambia.",
      ],
      { label: "Elegir contraseña nueva", url },
    ),
  };
}

export function passwordChangedEmail(to: string, fullName: string, appUrl: string): EmailMessage {
  const url = `${appUrl}/recuperar`;
  return {
    to,
    subject: "Tu contraseña cambió · Paso de Lanchas",
    text:
      `Hola, ${fullName}.\n\nLa contraseña de tu cuenta acaba de cambiar y se cerraron tus otras sesiones.\n` +
      `Si no fuiste tú, recupérala aquí: ${url}`,
    html: emailLayout(
      [
        `Hola, ${escapeHtml(fullName)}.`,
        "La contraseña de tu cuenta acaba de cambiar y se cerraron tus otras sesiones.",
        "Si no fuiste tú, recupérala de inmediato.",
      ],
      { label: "Recuperar mi contraseña", url },
    ),
  };
}
