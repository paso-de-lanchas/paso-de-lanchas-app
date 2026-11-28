import type { QrCredentialRepository } from "./ports";

export type IssueQrCredentialDeps = {
  repository: QrCredentialRepository;
  newSecret: () => string;
  /** Ya viene con la clave aplicada: (plain) => encryptSecret(plain, QR_SIGNING_SECRET) */
  encryptSecret: (plain: string) => string;
  stepSeconds: number;
};

export type IssuedQrCredential = {
  credentialId: string;
  secret: string;
  stepSeconds: number;
};

export async function issueQrCredential(
  userId: string,
  deps: IssueQrCredentialDeps,
): Promise<IssuedQrCredential> {
  const secret = deps.newSecret();
  const { id } = await deps.repository.replaceActive(userId, deps.encryptSecret(secret));

  // Esta es la ÚNICA vez que el secreto en claro sale del servidor.
  return { credentialId: id, secret, stepSeconds: deps.stepSeconds };
}
