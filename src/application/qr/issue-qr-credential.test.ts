import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/infrastructure/qr/secret-cipher";

import { createInMemoryQrRepository } from "./in-memory-qr-repository";
import { issueQrCredential } from "./issue-qr-credential";

const KEY = "clave-de-prueba-larga-y-aleatoria";

function setup() {
  const repository = createInMemoryQrRepository();
  let n = 0;
  const deps = {
    repository,
    newSecret: () => `SECRETO-${++n}`,
    encryptSecret: (plain: string) => encryptSecret(plain, KEY),
    stepSeconds: 30,
  };
  return { repository, deps };
}

describe("issueQrCredential", () => {
  it("devuelve el id, el secreto en claro y el paso", async () => {
    const { deps } = setup();
    const result = await issueQrCredential("user-1", deps);

    expect(result).toEqual({ credentialId: "cred-1", secret: "SECRETO-1", stepSeconds: 30 });
  });

  it("guarda el secreto cifrado, nunca en claro", async () => {
    const { repository, deps } = setup();
    const { secret } = await issueQrCredential("user-1", deps);

    const stored = repository.rows[0].encryptedSecret;
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored, KEY)).toBe(secret);
  });

  it("al emitir otra credencial, la anterior queda revocada", async () => {
    const { repository, deps } = setup();
    const first = await issueQrCredential("user-1", deps);
    const second = await issueQrCredential("user-1", deps);

    expect(await repository.findActiveById(first.credentialId)).toBeNull();
    expect(await repository.findActiveById(second.credentialId)).not.toBeNull();
  });

  it("deja una sola credencial vigente por pasajero", async () => {
    const { repository, deps } = setup();
    await issueQrCredential("user-1", deps);
    await issueQrCredential("user-1", deps);
    await issueQrCredential("user-1", deps);

    expect(repository.rows.filter((r) => !r.revoked)).toHaveLength(1);
  });

  it("no afecta las credenciales de otros pasajeros", async () => {
    const { repository, deps } = setup();
    const other = await issueQrCredential("user-2", deps);
    await issueQrCredential("user-1", deps);

    expect(await repository.findActiveById(other.credentialId)).not.toBeNull();
  });
});
