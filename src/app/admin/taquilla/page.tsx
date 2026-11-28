import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { createPrismaBoardingQueries } from "@/infrastructure/boarding/prisma-boarding-queries";
import { getCurrentStaffPost } from "@/lib/auth/auth";
import { requireRole } from "@/lib/auth/require-role";

import { ScanPanel } from "./scan-panel";

export const metadata: Metadata = { title: "Taquilla · Escanear QR" };

async function TaquillaContent() {
  const admin = await requireRole("ADMIN");
  const post = await getCurrentStaffPost(admin.id);
  const boarding = post.dockId
    ? await createPrismaBoardingQueries().findDockBoarding(post.dockId)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/admin" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Administración
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Taquilla · Escanear QR</h1>
        <p className="text-ink-muted text-xs">
          Escanea el QR del pasajero con la cámara o con el lector USB: se cobra del saldo y se
          asigna su lugar en un solo paso.
        </p>
      </header>

      {!post.dockId ? (
        <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm">
          Tu cuenta no tiene un muelle asignado. Pide al superadministrador que te asigne uno.
        </p>
      ) : !post.deviceId ? (
        <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm">
          Esta computadora no está autorizada para tu muelle. Entra desde la computadora de la
          taquilla.
        </p>
      ) : (
        <>
          <section
            aria-label="Embarcación abordando"
            className="border-line rounded-2xl border bg-white p-4 shadow-xs"
          >
            {boarding ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-ink-muted text-xs font-semibold uppercase">Abordando ahora</p>
                  <p className="font-heading text-ink text-lg font-bold">
                    {boarding.vesselName} → {boarding.destinationDockName}
                  </p>
                  {boarding.vehicleSpaces.length > 0 && (
                    <p className="text-ink-muted text-xs">
                      {boarding.vehicleSpaces
                        .map((v) => `${v.vehicleTypeName}: ${v.occupied}/${v.capacity}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <p className="text-ink text-2xl font-bold" aria-label="Lugares ocupados">
                  {boarding.occupiedSeats}/{boarding.passengerCapacity}
                </p>
              </div>
            ) : (
              <p className="text-ink-muted text-sm">
                No hay ninguna embarcación abordando en este muelle. Inicia el abordaje en Operación
                del muelle.
              </p>
            )}
          </section>

          <ScanPanel isFerry={boarding?.vesselKind === "FERRY"} disabled={!boarding} />
        </>
      )}
    </main>
  );
}

export default function TaquillaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-6">
          <p className="text-ink-muted text-sm">Cargando taquilla…</p>
        </main>
      }
    >
      <TaquillaContent />
    </Suspense>
  );
}
