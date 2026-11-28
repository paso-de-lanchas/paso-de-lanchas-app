import type { QrCredentialRepository, StoredQrCredential } from "./ports";

type Row = StoredQrCredential & { revoked: boolean };

export function createInMemoryQrRepository(): QrCredentialRepository & { rows: Row[] } {
  const rows: Row[] = [];
  let counter = 0;

  return {
    rows,
    async replaceActive(userId, encryptedSecret) {
      for (const row of rows) {
        if (row.userId === userId) row.revoked = true;
      }
      const id = `cred-${++counter}`;
      rows.push({ id, userId, encryptedSecret, revoked: false });
      return { id };
    },
    async findActiveById(id) {
      const row = rows.find((r) => r.id === id && !r.revoked);
      return row ? { id: row.id, userId: row.userId, encryptedSecret: row.encryptedSecret } : null;
    },
  };
}
