import { describe, expect, it } from "vitest";

import type { Clock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

import { createCloseAnnouncement } from "./close-announcement";
import { createListPassengerNotices } from "./list-passenger-notices";
import type {
  ActiveDockSuspensionRecord,
  AnnouncementRecord,
  AnnouncementRepository,
  CreateAnnouncementData,
  DockOption,
} from "./ports";
import { createPublishAnnouncement } from "./publish-announcement";

class InMemoryAnnouncementRepository implements AnnouncementRepository {
  docks: DockOption[] = [
    { id: "11111111-1111-4111-8111-111111111111", code: "COA", name: "Coatzacoalcos" },
    { id: "22222222-2222-4222-8222-222222222222", code: "VAL", name: "Villa Allende" },
  ];
  announcements: AnnouncementRecord[] = [];
  suspensions: ActiveDockSuspensionRecord[] = [];
  auditEvents: Array<{ action: string; entityId: string; adminId: string }> = [];

  async listDocks(): Promise<DockOption[]> {
    return this.docks;
  }

  async publish(data: CreateAnnouncementData): Promise<AnnouncementRecord> {
    const dock = data.dockId ? (this.docks.find((d) => d.id === data.dockId) ?? null) : null;
    const created: AnnouncementRecord = {
      id: `33333333-3333-4333-8333-${String(this.announcements.length + 1).padStart(12, "0")}`,
      dockId: data.dockId,
      dockName: dock?.name ?? null,
      title: data.title,
      message: data.message,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      createdById: data.createdById,
      createdByName: "Administrador de prueba",
    };
    this.announcements.unshift(created);
    this.auditEvents.push({
      action: "ANNOUNCEMENT_PUBLISHED",
      entityId: created.id,
      adminId: data.createdById,
    });
    return created;
  }

  async closeEarly(
    announcementId: string,
    adminId: string,
    closedAt: Date,
  ): Promise<AnnouncementRecord> {
    const found = this.announcements.find((item) => item.id === announcementId);
    if (!found) {
      throw new DomainError("ANNOUNCEMENT_NOT_FOUND", "El aviso no existe.");
    }
    if (found.endsAt !== null && found.endsAt.getTime() <= closedAt.getTime()) {
      throw new DomainError("ANNOUNCEMENT_ALREADY_ENDED", "El aviso ya finalizó.");
    }
    found.endsAt = closedAt;
    this.auditEvents.push({
      action: "ANNOUNCEMENT_CLOSED",
      entityId: announcementId,
      adminId,
    });
    return found;
  }

  async listAdminAnnouncements(): Promise<AnnouncementRecord[]> {
    return this.announcements;
  }

  async listActivePassengerNotices(): Promise<{
    announcements: AnnouncementRecord[];
    suspensions: ActiveDockSuspensionRecord[];
  }> {
    return {
      announcements: this.announcements,
      suspensions: this.suspensions,
    };
  }
}

describe("announcements application use cases", () => {
  const fixedNow = new Date("2026-11-28T16:00:00.000Z"); // 10:00 a. m. México
  const fixedClock: Clock = { now: () => fixedNow };
  const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("publica avisos globales y por muelle y registra la acción en bitácora", async () => {
    const repo = new InMemoryAnnouncementRepository();
    const publishAnnouncement = createPublishAnnouncement({ repo, clock: fixedClock });

    const globalNotice = await publishAnnouncement(adminId, {
      title: "Aviso por norte fuerte",
      message: "El cruce puede presentar demoras por rachas de viento.",
      dockId: "ALL",
      startsAtRaw: "",
      endsAtRaw: "2026-11-28T18:00",
    });

    expect(globalNotice.dockId).toBeNull();
    expect(globalNotice.dockName).toBeNull();
    expect(globalNotice.startsAt.toISOString()).toBe("2026-11-28T16:00:00.000Z");
    expect(globalNotice.endsAt?.toISOString()).toBe("2026-11-29T00:00:00.000Z");

    const dockNotice = await publishAnnouncement(adminId, {
      title: "Mantenimiento en rampa",
      message: "Abordaje vehicular por rampa norte.",
      dockId: "11111111-1111-4111-8111-111111111111",
      startsAtRaw: "2026-11-28T10:00",
      endsAtRaw: "",
    });

    expect(dockNotice.dockName).toBe("Coatzacoalcos");
    expect(dockNotice.endsAt).toBeNull();
    expect(repo.auditEvents).toHaveLength(2);
    expect(repo.auditEvents[0]?.action).toBe("ANNOUNCEMENT_PUBLISHED");
  });

  it("rechaza entradas inválidas o rangos de vigencia incoherentes", async () => {
    const repo = new InMemoryAnnouncementRepository();
    const publishAnnouncement = createPublishAnnouncement({ repo, clock: fixedClock });

    await expect(
      publishAnnouncement(adminId, {
        title: "No",
        message: "Texto válido",
        dockId: "ALL",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      publishAnnouncement(adminId, {
        title: "Aviso con rango inválido",
        message: "La fecha fin es anterior al inicio.",
        dockId: "ALL",
        startsAtRaw: "2026-11-28T12:00",
        endsAtRaw: "2026-11-28T11:00",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      publishAnnouncement(adminId, {
        title: "Muelle inexistente",
        message: "Aviso para muelle desconocido.",
        dockId: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("permite finalizar anticipadamente un aviso vigente y rechaza cerrarlo dos veces", async () => {
    const repo = new InMemoryAnnouncementRepository();
    const publishAnnouncement = createPublishAnnouncement({ repo, clock: fixedClock });
    const closeAnnouncement = createCloseAnnouncement({ repo, clock: fixedClock });

    const created = await publishAnnouncement(adminId, {
      title: "Aviso temporal",
      message: "Se restablece en breve.",
      dockId: "ALL",
    });

    const closed = await closeAnnouncement(adminId, { announcementId: created.id });
    expect(closed.endsAt?.toISOString()).toBe("2026-11-28T16:00:00.000Z");
    expect(repo.auditEvents.at(-1)?.action).toBe("ANNOUNCEMENT_CLOSED");

    await expect(closeAnnouncement(adminId, { announcementId: created.id })).rejects.toThrow(
      DomainError,
    );
  });

  it("lista para el pasajero únicamente avisos vigentes y suspensiones activas de muelle", async () => {
    const repo = new InMemoryAnnouncementRepository();
    repo.announcements.push(
      {
        id: "a-active",
        dockId: "11111111-1111-4111-8111-111111111111",
        dockName: "Coatzacoalcos",
        title: "Oleaje moderado",
        message: "Abordar con precaución.",
        startsAt: new Date("2026-11-28T15:00:00.000Z"),
        endsAt: new Date("2026-11-28T19:00:00.000Z"),
        createdById: adminId,
        createdByName: "Admin",
      },
      {
        id: "a-expired",
        dockId: null,
        dockName: null,
        title: "Aviso pasado",
        message: "Ya venció.",
        startsAt: new Date("2026-11-28T10:00:00.000Z"),
        endsAt: new Date("2026-11-28T15:00:00.000Z"),
        createdById: adminId,
        createdByName: "Admin",
      },
      {
        id: "a-future",
        dockId: null,
        dockName: null,
        title: "Aviso futuro",
        message: "Aún no empieza.",
        startsAt: new Date("2026-11-28T18:00:00.000Z"),
        endsAt: null,
        createdById: adminId,
        createdByName: "Admin",
      },
    );

    repo.suspensions.push({
      id: "s-1",
      dockId: "22222222-2222-4222-8222-222222222222",
      dockName: "Villa Allende",
      reason: "Cierre de puerto por Capitanía",
      startsAt: new Date("2026-11-28T15:30:00.000Z"),
      endsAt: null,
    });

    const listPassengerNotices = createListPassengerNotices({ repo, clock: fixedClock });
    const notices = await listPassengerNotices();

    expect(notices.announcements).toHaveLength(1);
    expect(notices.announcements[0]?.title).toBe("Oleaje moderado");
    expect(notices.announcements[0]?.scopeLabel).toBe("Muelle Coatzacoalcos");

    expect(notices.suspensions).toHaveLength(1);
    expect(notices.suspensions[0]?.dockName).toBe("Villa Allende");
    expect(notices.suspensions[0]?.reason).toBe("Cierre de puerto por Capitanía");
  });
});
