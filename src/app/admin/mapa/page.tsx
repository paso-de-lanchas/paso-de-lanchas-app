import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { createGetLiveMap } from "@/application/map/get-live-map";
import { LiveMap } from "@/components/live-map/live-map";
import { createPrismaLiveMapRepository } from "@/infrastructure/map/prisma-live-map-repository";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Mapa en vivo | Administrador" };

async function AdminMap() {
  await requireRole("ADMIN", "SUPERADMIN");
  const initial = await createGetLiveMap({ repo: createPrismaLiveMapRepository() })();
  return <LiveMap initial={initial} showOccupancy />;
}

/** Todas las embarcaciones en tránsito con su ocupación (RF-081). */
export default function AdminMapPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/admin" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Administración
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Mapa en vivo</h1>
        <p className="text-ink-muted text-xs">
          Embarcaciones en tránsito, su ocupación y su llegada estimada.
        </p>
      </header>
      <Suspense fallback={<p className="text-ink-muted text-sm">Cargando mapa…</p>}>
        <AdminMap />
      </Suspense>
    </main>
  );
}
