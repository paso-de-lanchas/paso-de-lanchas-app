import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { createGetLiveMap } from "@/application/map/get-live-map";
import { LiveMap } from "@/components/live-map/live-map";
import { createPrismaLiveMapRepository } from "@/infrastructure/map/prisma-live-map-repository";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Mapa en vivo" };

async function PassengerMap() {
  await requireRole("PASSENGER");
  const initial = await createGetLiveMap({ repo: createPrismaLiveMapRepository() })();
  return <LiveMap initial={initial} showOccupancy={false} />;
}

/** Mapa en vivo para el pasajero (RF-077 a RF-080). */
export default function PassengerMapPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/pasajero" className="text-brand text-xs font-semibold hover:underline">
          ← Volver al inicio
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Mapa en vivo</h1>
        <p className="text-ink-muted text-xs">
          Dónde vienen las embarcaciones y cuánto les falta para llegar. Se actualiza solo.
        </p>
      </header>
      <Suspense fallback={<p className="text-ink-muted text-sm">Cargando mapa…</p>}>
        <PassengerMap />
      </Suspense>
    </main>
  );
}
