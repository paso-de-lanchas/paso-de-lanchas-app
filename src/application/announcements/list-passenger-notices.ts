import { type Clock, systemClock } from "@/application/shared/ports";
import {
  formatAnnouncementDateTime,
  isAnnouncementActive,
  isSuspensionActive,
} from "@/domain/announcements/announcement";

import type { AnnouncementRepository } from "./ports";

export interface PassengerAnnouncementView {
  id: string;
  scopeLabel: string;
  title: string;
  message: string;
  validUntilLabel: string | null;
}

export interface PassengerSuspensionView {
  id: string;
  dockName: string;
  reason: string;
  untilLabel: string | null;
}

export interface PassengerNoticesResult {
  announcements: PassengerAnnouncementView[];
  suspensions: PassengerSuspensionView[];
}

export interface ListPassengerNoticesDeps {
  repo: AnnouncementRepository;
  clock?: Clock;
}

export function createListPassengerNotices(deps: ListPassengerNoticesDeps) {
  const clock = deps.clock ?? systemClock;

  return async function listPassengerNotices(): Promise<PassengerNoticesResult> {
    const now = clock.now();
    const snapshot = await deps.repo.listActivePassengerNotices(now);

    const announcements: PassengerAnnouncementView[] = snapshot.announcements
      .filter((item) => isAnnouncementActive(item, now))
      .map((item) => ({
        id: item.id,
        scopeLabel: item.dockName ? `Muelle ${item.dockName}` : "Todos los muelles",
        title: item.title,
        message: item.message,
        validUntilLabel: item.endsAt ? formatAnnouncementDateTime(item.endsAt) : null,
      }));

    const suspensions: PassengerSuspensionView[] = snapshot.suspensions
      .filter((item) =>
        isSuspensionActive(
          { type: "SUSPENSION", startsAt: item.startsAt, endsAt: item.endsAt },
          now,
        ),
      )
      .map((item) => ({
        id: item.id,
        dockName: item.dockName,
        reason: item.reason,
        untilLabel: item.endsAt ? formatAnnouncementDateTime(item.endsAt) : null,
      }));

    return {
      announcements,
      suspensions,
    };
  };
}
