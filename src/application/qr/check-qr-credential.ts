import type { QrCredentialRepository } from "./ports";

/** true solo si la credencial existe, está vigente y pertenece a ese usuario. */
export async function isCredentialActiveForUser(
  credentialId: string,
  userId: string,
  repository: QrCredentialRepository,
): Promise<boolean> {
  const credential = await repository.findActiveById(credentialId);
  return credential !== null && credential.userId === userId;
}
