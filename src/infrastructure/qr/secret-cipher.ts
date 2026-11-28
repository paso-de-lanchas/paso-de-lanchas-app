import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function deriveKey(signingSecret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", signingSecret, "", "paso-de-lanchas:qr-secret:v1", 32));
}

export function encryptSecret(plain: string, signingSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(signingSecret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string, signingSecret: string): string {
  const [iv, tag, encrypted] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(signingSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
