import { createHash, randomBytes } from "node:crypto";

import type { TokenService } from "@/application/auth/ports";

/** 32 bytes aleatorios (256 bits) en base64url; en la base solo se guarda su SHA-256. */
export const cryptoTokenService: TokenService = {
  generate: () => randomBytes(32).toString("base64url"),
  hash: (token) => createHash("sha256").update(token).digest("hex"),
};
