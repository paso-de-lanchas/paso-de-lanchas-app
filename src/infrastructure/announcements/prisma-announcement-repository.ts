import type {
  ActiveDockSuspensionRecord,
  AnnouncementRecord,
  AnnouncementRepository,
  CreateAnnouncementData,
  DockOption,
} from "@/application/announcements/ports";
import { DomainError } from "@/domain/shared/domain-error";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";

const announcementInclude = {
  dock: { select: { name: true } },
  createdBy: { select: { fullName: true } },
} as const;

type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

function toAnnouncementRecord(row: AnnouncementWithRelations): AnnouncementRecord {
  return {
    id: row.id,
    dockId: row.dockId,
    dockName: row.dock?.name ?? null,
    title: row.title,
    message: row.message,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
  };
}

export class PrismaAnnouncementRepository implements AnnouncementRepository {
  async listDocks(): Promise<DockOption[]> {
    return prisma.dock.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
  }

  async publish(data: CreateAnnouncementData): Promise<AnnouncementRecord> {
    const created = await prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          dockId: data.dockId,
          title: data.title,
          message: data.message,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          createdById: data.createdById,
        },
        include: announcementInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: data.createdById,
          action: "ANNOUNCEMENT_PUBLISHED",
          entity: "announcement",
          entityId: announcement.id,
          details: {
            title: announcement.title,
            dockId: announcement.dockId,
            dockName: announcement.dock?.name ?? "Todos los muelles",
            startsAt: announcement.startsAt.toISOString(),
            endsAt: announcement.endsAt ? announcement.endsAt.toISOString() : null,
          },
        },
      });

      return announcement;
    });

    return toAnnouncementRecord(created);
  }

  async closeEarly(
    announcementId: string,
    adminId: string,
    closedAt: Date,
  ): Promise<AnnouncementRecord> {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.announcement.findUnique({
        where: { id: announcementId },
        select: { id: true, title: true, endsAt: true },
      });

      if (!existing) {
        throw new DomainError("ANNOUNCEMENT_NOT_FOUND", "El aviso seleccionado no existe.");
      }

      if (existing.endsAt !== null && existing.endsAt.getTime() <= closedAt.getTime()) {
        throw new DomainError(
          "ANNOUNCEMENT_ALREADY_ENDED",
          "Este aviso ya había finalizado anteriormente.",
        );
      }

      const nextEndsAt =
        existing.endsAt !== null && existing.endsAt < closedAt ? existing.endsAt : closedAt;

      const announcement = await tx.announcement.update({
        where: { id: announcementId },
        data: { endsAt: nextEndsAt },
        include: announcementInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: "ANNOUNCEMENT_CLOSED",
          entity: "announcement",
          entityId: announcement.id,
          details: {
            title: announcement.title,
            closedAt: closedAt.toISOString(),
          },
        },
      });

      return announcement;
    });

    return toAnnouncementRecord(updated);
  }

  async listAdminAnnouncements(): Promise<AnnouncementRecord[]> {
    const rows = await prisma.announcement.findMany({
      include: announcementInclude,
      orderBy: { startsAt: "desc" },
      take: 30,
    });
    return rows.map(toAnnouncementRecord);
  }

  async listActivePassengerNotices(now: Date): Promise<{
    announcements: AnnouncementRecord[];
    suspensions: ActiveDockSuspensionRecord[];
  }> {
    const [announcementRows, suspensionRows] = await Promise.all([
      prisma.announcement.findMany({
        where: {
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        include: announcementInclude,
        orderBy: { startsAt: "desc" },
      }),
      prisma.dockServiceOverride.findMany({
        where: {
          type: "SUSPENSION",
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: {
          id: true,
          dockId: true,
          reason: true,
          startsAt: true,
          endsAt: true,
          dock: { select: { name: true } },
        },
        orderBy: { startsAt: "desc" },
      }),
    ]);

    return {
      announcements: announcementRows.map(toAnnouncementRecord),
      suspensions: suspensionRows.map((row) => ({
        id: row.id,
        dockId: row.dockId,
        dockName: row.dock.name,
        reason: row.reason,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      })),
    };
  }
}
