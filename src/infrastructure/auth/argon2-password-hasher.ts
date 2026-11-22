import { hash, verify } from "@node-rs/argon2";

import type { PasswordHasher } from "@/application/auth/ports";

/** Argon2id con los parámetros por defecto de la librería (recomendados por OWASP). */
export const argon2PasswordHasher: PasswordHasher = {
  hash: (password) => hash(password),
  verify: async (passwordHash, password) => {
    try {
      return await verify(passwordHash, password);
    } catch {
      // Un hash dañado o con otro formato cuenta como contraseña incorrecta.
      return false;
    }
  },
};
