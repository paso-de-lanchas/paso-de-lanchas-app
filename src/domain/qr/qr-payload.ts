const PREFIX = "PL1";

export type QrPayload = { credentialId: string; code: string };

export function buildQrPayload({ credentialId, code }: QrPayload): string {
  return `${PREFIX}.${credentialId}.${code}`;
}

/** Devuelve null si el texto no tiene el formato esperado (nunca lanza). */
export function parseQrPayload(raw: string): QrPayload | null {
  const match = /^PL1\.([A-Za-z0-9_-]+)\.(\d{6})$/.exec(raw.trim());
  if (!match) return null;
  return { credentialId: match[1], code: match[2] };
}

export function timeStepAt(nowMs: number, stepSeconds: number): number {
  return Math.floor(nowMs / 1000 / stepSeconds);
}
