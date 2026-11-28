import { describe, expect, it } from "vitest";

import { isCredentialActiveForUser } from "./check-qr-credential";
import { createInMemoryQrRepository } from "./in-memory-qr-repository";

describe("isCredentialActiveForUser", () => {
  it("true para la credencial vigente del mismo usuario", async () => {
    const repo = createInMemoryQrRepository();
    const { id } = await repo.replaceActive("user-1", "x");
    expect(await isCredentialActiveForUser(id, "user-1", repo)).toBe(true);
  });

  it("false si fue revocada por una nueva", async () => {
    const repo = createInMemoryQrRepository();
    const { id } = await repo.replaceActive("user-1", "x");
    await repo.replaceActive("user-1", "y");
    expect(await isCredentialActiveForUser(id, "user-1", repo)).toBe(false);
  });

  it("false si pertenece a otro usuario", async () => {
    const repo = createInMemoryQrRepository();
    const { id } = await repo.replaceActive("user-2", "x");
    expect(await isCredentialActiveForUser(id, "user-1", repo)).toBe(false);
  });

  it("false si no existe", async () => {
    const repo = createInMemoryQrRepository();
    expect(await isCredentialActiveForUser("no-existe", "user-1", repo)).toBe(false);
  });
});
