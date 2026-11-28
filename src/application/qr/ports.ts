export type StoredQrCredential = {
  id: string;
  userId: string;
  encryptedSecret: string;
};

export interface QrCredentialRepository {
  /** En UNA transacción: revoca la credencial vigente del pasajero (si hay) y crea la nueva. */
  replaceActive(userId: string, encryptedSecret: string): Promise<{ id: string }>;
  /** Devuelve solo credenciales vigentes (no revocadas). */
  findActiveById(id: string): Promise<StoredQrCredential | null>;
}
