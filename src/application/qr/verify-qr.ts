import { z } from "zod";

import { parseQrPayload, timeStepAt } from "@/domain/qr/qr-payload";

import type { QrCredentialRepository } from "./ports";

const TOLERANCE = 1; // pasos hacia cada lado (±30 s con ventanas de 30 s)

// Entrada de la función: texto no vacío y de largo acotado.
const rawSchema = z.string().min(1).max(200);

export type VerifyQrDeps = {
  repository: QrCredentialRepository;
  /** Ya viene con la clave aplicada: (stored) => decryptSecret(stored, QR_SIGNING_SECRET) */
  decryptSecret: (stored: string) => string;
  codeFor: (secret: string, timeStep: number, stepSeconds: number) => Promise<string>;
  /** Reloj inyectado, en milisegundos (en producción: Date.now). */
  now: () => number;
  stepSeconds: number;
};

export type VerifyQrResult =
  { valid: true; userId: string; credentialId: string; timeStep: number } | { valid: false };

const INVALID: VerifyQrResult = { valid: false };

/**
 * Verifica el contenido de un QR escaneado.
 *
 * NO marca el código como usado: el "QR de un solo uso" lo hace el abordaje (Cova)
 * guardando `credentialId` + `timeStep` dentro de su transacción.
 * El resultado inválido es genérico a propósito: no revela qué falló.
 */
export async function verifyQr(raw: unknown, deps: VerifyQrDeps): Promise<VerifyQrResult> {
  const input = rawSchema.safeParse(raw);
  if (!input.success) return INVALID;

  const payload = parseQrPayload(input.data);
  if (!payload) return INVALID;

  const credential = await deps.repository.findActiveById(payload.credentialId);
  if (!credential) return INVALID;

  let secret: string;
  try {
    secret = deps.decryptSecret(credential.encryptedSecret);
  } catch {
    return INVALID; // dato corrupto o clave equivocada
  }

  const current = timeStepAt(deps.now(), deps.stepSeconds);
  let matched: number | null = null;

  // Siempre se calculan los tres candidatos (el trabajo no depende de si hay coincidencia).
  for (let offset = -TOLERANCE; offset <= TOLERANCE; offset++) {
    const candidate = current + offset;
    const expected = await deps.codeFor(secret, candidate, deps.stepSeconds);
    if (expected === payload.code && matched === null) matched = candidate;
  }

  if (matched === null) return INVALID;
  return { valid: true, userId: credential.userId, credentialId: credential.id, timeStep: matched };
}
