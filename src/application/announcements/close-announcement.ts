import { type Clock, systemClock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

import { closeAnnouncementSchema } from "./announcement-input";
import type { AnnouncementRecord, AnnouncementRepository } from "./ports";

export interface CloseAnnouncementDeps {
  repo: AnnouncementRepository;
  clock?: Clock;
}

export function createCloseAnnouncement(deps: CloseAnnouncementDeps) {
  const clock = deps.clock ?? systemClock;

  return async function closeAnnouncement(
    adminId: string,
    rawInput: unknown,
  ): Promise<AnnouncementRecord> {
    const parsed = closeAnnouncementSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstMessage =
        parsed.error.issues[0]?.message ?? "El identificador del aviso no es válido.";
      throw new DomainError("INVALID_ANNOUNCEMENT_ID", firstMessage);
    }

    return deps.repo.closeEarly(parsed.data.announcementId, adminId, clock.now());
  };
}
