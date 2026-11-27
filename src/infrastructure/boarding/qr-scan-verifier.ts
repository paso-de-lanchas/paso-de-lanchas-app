import type { QrScanVerifier } from "@/application/boarding/ports";
import { verifyQr } from "@/application/qr/verify-qr";
import { createPrismaQrRepository } from "@/infrastructure/qr/prisma-qr-repository";
import { getQrSigningSecret } from "@/infrastructure/qr/qr-key";
import { getQrStepSeconds } from "@/infrastructure/qr/qr-settings";
import { decryptSecret } from "@/infrastructure/qr/secret-cipher";
import { codeForTimeStep } from "@/infrastructure/qr/totp";

/** Verifica el QR con la firma TOTP de la credencial vigente (módulo QR de Diego, #20). */
export function createQrScanVerifier(): QrScanVerifier {
  return {
    async verify(raw) {
      const signingSecret = getQrSigningSecret();
      const result = await verifyQr(raw, {
        repository: createPrismaQrRepository(),
        decryptSecret: (stored) => decryptSecret(stored, signingSecret),
        codeFor: codeForTimeStep,
        now: Date.now,
        stepSeconds: await getQrStepSeconds(),
      });
      return result.valid
        ? { userId: result.userId, credentialId: result.credentialId, timeStep: result.timeStep }
        : null;
    },
  };
}
