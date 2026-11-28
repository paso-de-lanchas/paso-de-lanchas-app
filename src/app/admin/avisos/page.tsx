import type { Metadata } from "next";
import Link from "next/link";

import {
  formatAnnouncementDateTime,
  isAnnouncementActive,
} from "@/domain/announcements/announcement";
import { PrismaAnnouncementRepository } from "@/infrastructure/announcements/prisma-announcement-repository";
import { requireRole } from "@/lib/auth/require-role";

import { type AdminAnnouncementItemView, AnnouncementManager } from "./announcement-manager";

export const metadata: Metadata = { title: "Avisos a pasajeros" };

export default async function AdminAnnouncementsPage() {
  await requireRole("ADMIN");
  const repo = new PrismaAnnouncementRepository();
  const now = new Date();

  const [docks, records] = await Promise.all([repo.listDocks(), repo.listAdminAnnouncements()]);

  const announcements: AdminAnnouncementItemView[] = records.map((item) => {
    const status = isAnnouncementActive(item, now)
      ? "ACTIVE"
      : item.startsAt.getTime() > now.getTime()
        ? "SCHEDULED"
        : "ENDED";

    return {
      id: item.id,
      scopeLabel: item.dockName ? `Muelle ${item.dockName}` : "Todos los muelles",
      title: item.title,
      message: item.message,
      startsAtLabel: formatAnnouncementDateTime(item.startsAt),
      endsAtLabel: item.endsAt ? formatAnnouncementDateTime(item.endsAt) : null,
      createdByName: item.createdByName,
      status,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Link href="/admin" className="text-brand text-xs font-bold hover:underline">
          ← Volver al panel de administrador
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Avisos a pasajeros</h1>
        <p className="text-ink-muted text-xs">
          Publica comunicados operativos o climatológicos visibles al abrir la aplicación (RF-104 y
          RF-105).
        </p>
      </header>

      <AnnouncementManager docks={docks} announcements={announcements} />
    </main>
  );
}
