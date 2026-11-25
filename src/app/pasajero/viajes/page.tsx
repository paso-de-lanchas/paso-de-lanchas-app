import type { Metadata } from "next";
import Link from "next/link";

import { createListMyTrips } from "@/application/passenger-info/list-my-trips";
import { PrismaPassengerInfoRepository } from "@/infrastructure/passenger-info/prisma-passenger-info-repository";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Mis viajes" };

interface MyTripsPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

function formatTripDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTripStatus(status: "BOARDED" | "CANCELLED" | "REASSIGNED"): string {
  if (status === "BOARDED") return "Abordado";
  if (status === "REASSIGNED") return "Reasignado";
  return "Cancelado";
}

export default async function MyTripsPage({ searchParams }: MyTripsPageProps) {
  const sessionUser = await requireRole("PASSENGER");
  const resolvedParams = await searchParams;
  const rawPage = Array.isArray(resolvedParams.page) ? resolvedParams.page[0] : resolvedParams.page;

  const repo = new PrismaPassengerInfoRepository();
  const listMyTrips = createListMyTrips({ repo });
  const result = await listMyTrips(sessionUser.id, rawPage);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Link href="/pasajero" className="text-brand text-xs font-bold hover:underline">
          ← Volver a Muelles
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Mis viajes</h1>
        <p className="text-ink-muted text-xs">
          Historial de cruces realizados del más reciente al más antiguo (RF-087).
        </p>
      </header>

      {result.items.length === 0 ? (
        <div className="border-line text-ink-muted rounded-2xl border bg-white p-6 text-sm shadow-xs">
          Aún no tienes viajes registrados en tu cuenta.
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {result.items.map((trip) => (
              <li
                key={trip.id}
                className="border-line flex flex-col justify-between gap-3 rounded-2xl border bg-white p-4 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink text-sm font-bold">
                      {trip.originDockName} → {trip.destinationDockName}
                    </span>
                    <span className="bg-brand/10 text-brand rounded-md px-2 py-0.5 text-xs font-bold">
                      {formatTripStatus(trip.status)}
                    </span>
                  </div>

                  <p className="text-ink-muted text-xs">
                    {trip.vesselName} ({trip.vesselKind === "FERRY" ? "Transbordador" : "Lancha"}) ·
                    Lugar #{trip.seatNumber}
                    {trip.vehiclePlate ? ` · Placas ${trip.vehiclePlate}` : ""}
                  </p>

                  <p suppressHydrationWarning className="text-ink-muted text-xs">
                    {formatTripDate(trip.createdAtIso)}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-brand font-mono text-base font-bold">{trip.formattedAmount}</p>
                </div>
              </li>
            ))}
          </ul>

          {result.totalPages > 1 ? (
            <nav
              aria-label="Paginación de viajes"
              className="flex items-center justify-between pt-2 text-xs font-bold"
            >
              {result.page > 1 ? (
                <Link
                  href={`/pasajero/viajes?page=${result.page - 1}`}
                  className="border-line text-brand hover:border-brand rounded-xl border bg-white px-4 py-2"
                >
                  ← Anterior
                </Link>
              ) : (
                <span className="border-line text-ink-muted rounded-xl border bg-white/60 px-4 py-2 opacity-50">
                  ← Anterior
                </span>
              )}

              <span className="text-ink-muted">
                Página {result.page} de {result.totalPages} ({result.totalItems} viajes)
              </span>

              {result.page < result.totalPages ? (
                <Link
                  href={`/pasajero/viajes?page=${result.page + 1}`}
                  className="border-line text-brand hover:border-brand rounded-xl border bg-white px-4 py-2"
                >
                  Siguiente →
                </Link>
              ) : (
                <span className="border-line text-ink-muted rounded-xl border bg-white/60 px-4 py-2 opacity-50">
                  Siguiente →
                </span>
              )}
            </nav>
          ) : null}
        </div>
      )}
    </main>
  );
}
