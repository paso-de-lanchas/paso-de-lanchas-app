import { describe, expect, it } from "vitest";

import { buildQrPayload, timeStepAt } from "@/domain/qr/qr-payload";
import { decryptSecret, encryptSecret } from "@/infrastructure/qr/secret-cipher";
import { codeForTimeStep, newSecret } from "@/infrastructure/qr/totp";

import { createInMemoryQrRepository } from "./in-memory-qr-repository";
import { verifyQr, type VerifyQrDeps } from "./verify-qr";

const KEY = "clave-de-prueba-larga-y-aleatoria";
const NOW = 1_700_000_010_000; // reloj fijo, en milisegundos
const STEP = 30;
const CURRENT = timeStepAt(NOW, STEP);

async function setup() {
  const repository = createInMemoryQrRepository();
  const secret = newSecret();
  const { id } = await repository.replaceActive("user-1", encryptSecret(secret, KEY));

  const deps: VerifyQrDeps = {
    repository,
    decryptSecret: (stored) => decryptSecret(stored, KEY),
    codeFor: codeForTimeStep,
    now: () => NOW,
    stepSeconds: STEP,
  };

  // Arma el texto del QR con el código de (paso actual + offset).
  const payloadAt = async (offset: number) =>
    buildQrPayload({
      credentialId: id,
      code: await codeForTimeStep(secret, CURRENT + offset, STEP),
    });

  return { repository, deps, id, secret, payloadAt };
}

describe("verifyQr", () => {
  it("acepta el código del paso actual", async () => {
    const { deps, id, payloadAt } = await setup();
    const result = await verifyQr(await payloadAt(0), deps);
    expect(result).toEqual({ valid: true, userId: "user-1", credentialId: id, timeStep: CURRENT });
  });

  it("acepta el paso anterior y el siguiente (±1)", async () => {
    const { deps, payloadAt } = await setup();
    expect(await verifyQr(await payloadAt(-1), deps)).toMatchObject({
      valid: true,
      timeStep: CURRENT - 1,
    });
    expect(await verifyQr(await payloadAt(1), deps)).toMatchObject({
      valid: true,
      timeStep: CURRENT + 1,
    });
  });

  it("rechaza códigos a dos pasos o más", async () => {
    const { deps, payloadAt } = await setup();
    expect(await verifyQr(await payloadAt(-2), deps)).toEqual({ valid: false });
    expect(await verifyQr(await payloadAt(2), deps)).toEqual({ valid: false });
  });

  it("rechaza un código de otra credencial", async () => {
    const { deps, id } = await setup();
    const otherSecret = newSecret();
    const code = await codeForTimeStep(otherSecret, CURRENT, STEP);
    expect(await verifyQr(buildQrPayload({ credentialId: id, code }), deps)).toEqual({
      valid: false,
    });
  });

  it("rechaza una credencial que no existe", async () => {
    const { deps } = await setup();
    expect(await verifyQr("PL1.no-existe.123456", deps)).toEqual({ valid: false });
  });

  it("rechaza una credencial revocada", async () => {
    const { repository, deps, payloadAt } = await setup();
    const payload = await payloadAt(0);
    await repository.replaceActive("user-1", "otro-secreto-cifrado"); // revoca la anterior
    expect(await verifyQr(payload, deps)).toEqual({ valid: false });
  });

  it("rechaza entradas con formato roto, sin lanzar errores", async () => {
    const { deps } = await setup();
    for (const bad of [
      "",
      "hola",
      "PL2.abc.123456",
      "PL1.abc.12345",
      null,
      undefined,
      42,
      "x".repeat(500),
    ]) {
      expect(await verifyQr(bad, deps)).toEqual({ valid: false });
    }
  });

  it("rechaza si el secreto guardado no se puede descifrar", async () => {
    const { repository, deps } = await setup();
    const { id } = await repository.replaceActive("user-2", "texto-corrupto");
    expect(await verifyQr(`PL1.${id}.123456`, deps)).toEqual({ valid: false });
  });

  it("nunca devuelve el secreto", async () => {
    const { deps, secret, payloadAt } = await setup();
    const result = await verifyQr(await payloadAt(0), deps);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
