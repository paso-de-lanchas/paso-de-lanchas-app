import { type Clock, systemClock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

import { parseAnnouncementSchedule, publishAnnouncementSchema } from "./announcement-input";
import type { AnnouncementRecord, AnnouncementRepository } from "./ports";

export interface PublishAnnouncementDeps {
  repo: AnnouncementRepository;
  clock?: Clock;
}

export function createPublishAnnouncement(deps: PublishAnnouncementDeps) {
  const clock = deps.clock ?? systemClock;

  return async function publishAnnouncement(
    adminId: string,
    rawInput: unknown,
  ): Promise<AnnouncementRecord> {
    const parsed = publishAnnouncementSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstMessage =
        parsed.error.issues[0]?.message ?? "Revisa los datos del aviso antes de publicar.";
      throw new DomainError("INVALID_ANNOUNCEMENT_INPUT", firstMessage);
    }

    const now = clock.now();
    const schedule = parseAnnouncementSchedule(parsed.data.startsAtRaw, parsed.data.endsAtRaw, now);
    if (!schedule.ok) {
      throw new DomainError("INVALID_ANNOUNCEMENT_SCHEDULE", schedule.message);
    }

    if (parsed.data.dockId !== null) {
      const docks = await deps.repo.listDocks();
      const exists = docks.some((dock) => dock.id === parsed.data.dockId);
      if (!exists) {
        throw new DomainError("INVALID_DOCK", "El muelle seleccionado no existe.");
      }
    }

    return deps.repo.publish({
      dockId: parsed.data.dockId,
      title: parsed.data.title,
      message: parsed.data.message,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      createdById: adminId,
    });
  };
}
