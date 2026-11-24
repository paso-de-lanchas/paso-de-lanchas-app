import type { Metadata } from "next";
import Link from "next/link";

import { createGetScheduleAndFares } from "@/application/passenger-info/get-schedule-and-fares";
import { systemClock } from "@/application/shared/ports";
import { PrismaPassengerInfoRepository } from "@/infrastructure/passenger-info/prisma-passenger-info-repository";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Horarios y tarifas" };

export default async function ScheduleAndFaresPage() {
  await requireRole("PASSENGER");
  const repo = new PrismaPassengerInfoRepository();
  const getScheduleAndFares = createGetScheduleAndFares({ repo, clock: systemClock });
  const { schedules, fares } = await getScheduleAndFares();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Link href="/pasajero" className="text-brand text-xs font-bold hover:underline">
          ← Volver a Muelles
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Horarios y tarifas</h1>
        <p className="text-ink-muted text-xs">
          Horarios de servicio por muelle y tarifas vigentes para lancha y transbordador (RF-086).
        </p>
      </header>

      <section aria-labelledby="fares-heading" className="space-y-3">
        <h2 id="fares-heading" className="font-heading text-ink text-lg font-bold">
          Tarifas vigentes
        </h2>

        {fares.length === 0 ? (
          <p className="border-line text-ink-muted rounded-2xl border bg-white p-5 text-sm shadow-xs">
            Aún no hay tarifas vigentes registradas.
          </p>
        ) : (
          <div className="border-line overflow-hidden rounded-2xl border bg-white shadow-xs">
            <ul className="divide-line divide-y">
              {fares.map((fare) => (
                <li
                  key={fare.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
                >
                  <span className="text-ink font-medium">{fare.label}</span>
                  <span className="text-brand font-mono font-bold">{fare.formattedAmount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="schedules-heading" className="space-y-3">
        <h2 id="schedules-heading" className="font-heading text-ink text-lg font-bold">
          Horarios por muelle
        </h2>

        {schedules.length === 0 ? (
          <p className="border-line text-ink-muted rounded-2xl border bg-white p-5 text-sm shadow-xs">
            No hay horarios de servicio configurados.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {schedules.map((dock) => (
              <article
                key={dock.dockId}
                className="border-line rounded-2xl border bg-white p-5 shadow-xs"
              >
                <div className="border-line mb-3 flex items-center justify-between border-b pb-2">
                  <h3 className="font-heading text-ink text-base font-bold">{dock.dockName}</h3>
                  <span className="bg-brand/10 text-brand rounded px-2 py-0.5 font-mono text-xs font-bold">
                    {dock.dockCode}
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs">
                  {dock.days.map((day) => (
                    <li key={day.weekday} className="flex items-center justify-between">
                      <span className="text-ink font-medium">{day.weekdayName}</span>
                      <span className="text-ink-muted font-mono">
                        {day.opensAt} – {day.closesAt}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
