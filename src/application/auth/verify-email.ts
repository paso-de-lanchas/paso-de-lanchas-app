import { emailTokenState } from "@/domain/auth/email-token";
import { DomainError } from "@/domain/shared/domain-error";

import type { AuditLogger, Clock } from "../shared/ports";
import type { EmailTokenRepository, TokenService } from "./ports";

export interface VerifyEmailDeps {
  emailTokens: EmailTokenRepository;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
}

const INVALID_LINK = new DomainError(
  "INVALID_LINK",
  "El enlace no es válido. Revisa que lo hayas abierto completo desde el correo.",
);
const USED_LINK = new DomainError(
  "LINK_USED",
  "Este enlace ya se usó. Si tu cuenta ya está activa, inicia sesión.",
);

/** Confirmar el correo (RF-002): activa la cuenta con un enlace de un solo uso. */
export function createVerifyEmail(deps: VerifyEmailDeps) {
  return async function verifyEmail(token: string): Promise<void> {
    if (!token || token.length > 200) throw INVALID_LINK;
    const record = await deps.emailTokens.findByHash(deps.tokens.hash(token), "EMAIL_VERIFICATION");
    if (!record) throw INVALID_LINK;

    const now = deps.clock.now();
    const state = emailTokenState(record, now);
    if (state === "USED") throw USED_LINK;
    if (state === "EXPIRED") {
      throw new DomainError(
        "LINK_EXPIRED",
        "El enlace ya venció. Vuelve a registrarte con el mismo correo y te enviaremos uno nuevo.",
      );
    }

    const consumed = await deps.emailTokens.consumeAndVerifyEmail(record.id, record.userId, now);
    if (!consumed) throw USED_LINK;
    await deps.audit.log({
      userId: record.userId,
      action: "EMAIL_VERIFIED",
      entity: "user",
      entityId: record.userId,
    });
  };
}
