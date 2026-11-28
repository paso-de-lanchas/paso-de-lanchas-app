import type { Metadata } from "next";
import Link from "next/link";

import { createListPassengerNotifications } from "@/application/notifications/list-passenger-notifications";
import { createGetDocksStatus } from "@/application/passenger-info/get-docks-status";
import { systemClock } from "@/application/shared/ports";
import { LogoutButton } from "@/components/logout-button";
import { serializeNotifications } from "@/domain/notifications/notification";
import { createPrismaBoardingQueries } from "@/infrastructure/boarding/prisma-boarding-queries";
import { PrismaNotificationRepository } from "@/infrastructure/notifications/prisma-notification-repository";
import { PrismaPassengerInfoRepository } from "@/infrastructure/passenger-info/prisma-passenger-info-repository";
import { requireRole } from "@/lib/auth/require-role";

import { BoardingNotice } from "./boarding-notice";
import { DocksLiveBoard } from "./docks-live-board";
import { NotificationsCenter } from "./notifications-center";

export const metadata: Metadata = { title: "Pasajero" };

export default async function PassengerPage() {
  const user = await requireRole("PASSENGER");
  const infoRepo = new PrismaPassengerInfoRepository();
  const notifRepo = new PrismaNotificationRepository();
  const getDocksStatus = createGetDocksStatus({ repo: infoRepo, clock: systemClock });
  const listNotifications = createListPassengerNotifications({ repo: notifRepo });

  const [initialStatus, currentBoarding, notifications] = await Promise.all([
    getDocksStatus(),
    createPrismaBoardingQueries().findCurrentPassengerBoarding(user.id),
    listNotifications(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-ink text-2xl font-bold">Pasajero</h1>
          <p className="text-ink text-sm font-medium">Hola, {user.fullName}</p>
          <p className="text-ink-muted text-xs">
            Consulta las embarcaciones en abordaje, tiempos de llegada, horarios, tarifas y tus
            viajes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/cuenta/cambiar-contrasena" className="text-brand font-bold underline">
            Cambiar contraseña
          </Link>
          <LogoutButton />
        </div>
      </header>
      <Link
        href="/pasajero/qr"
        className="bg-brand flex min-h-14 w-full items-center justify-center rounded-xl px-4 text-lg font-semibold text-white"
      >
        Mostrar mi QR
      </Link>
      <BoardingNotice initial={currentBoarding} />

      <NotificationsCenter initial={serializeNotifications(notifications)} />

      <DocksLiveBoard initialStatus={initialStatus} />

      <section aria-labelledby="passenger-shortcuts-heading" className="space-y-3">
        <h2 id="passenger-shortcuts-heading" className="font-heading text-ink text-lg font-bold">
          Accesos rápidos
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/pasajero/horarios-tarifas"
            className="border-brand/20 hover:border-brand flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition"
          >
            <div>
              <p className="font-heading text-brand text-base font-bold">Horarios y tarifas</p>
              <p className="text-ink-muted mt-1 text-xs">
                Apertura, cierre por muelle y precios vigentes (RF-086)
              </p>
            </div>
            <span className="text-brand mt-3 text-xs font-bold">Consultar →</span>
          </Link>

          <Link
            href="/pasajero/viajes"
            className="border-brand/20 hover:border-brand flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition"
          >
            <div>
              <p className="font-heading text-brand text-base font-bold">Mis viajes</p>
              <p className="text-ink-muted mt-1 text-xs">
                Historial de cruces, lugares y tarifas pagadas (RF-087)
              </p>
            </div>
            <span className="text-brand mt-3 text-xs font-bold">Ver historial →</span>
          </Link>

          <Link
            href="/pasajero/saldo"
            className="border-brand/20 hover:border-brand flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition"
          >
            <div>
              <p className="font-heading text-brand text-base font-bold">Mi saldo y movimientos</p>
              <p className="text-ink-muted mt-1 text-xs">
                Consulta tu saldo, historial y comprobantes (RF-021 a RF-031)
              </p>
            </div>
            <span className="text-brand mt-3 text-xs font-bold">Consultar →</span>
          </Link>

          <Link
            href="/pasajero/vehiculos"
            className="border-brand/20 hover:border-brand flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition"
          >
            <div>
              <p className="font-heading text-brand text-base font-bold">Mis vehículos</p>
              <p className="text-ink-muted mt-1 text-xs">
                Registra autos, motos o camionetas para abordar el transbordador (RF-039 a RF-042)
              </p>
            </div>
            <span className="text-brand mt-3 text-xs font-bold">Abrir →</span>
          </Link>

          <Link
            href="/pasajero/descuento"
            className="border-brand/20 hover:border-brand flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition"
          >
            <div>
              <p className="font-heading text-brand text-base font-bold">
                Descuentos Estudiante e INAPAM
              </p>
              <p className="text-ink-muted mt-1 text-xs">
                Solicita o consulta tu tarifa preferencial (RF-019 y RF-020)
              </p>
            </div>
            <span className="text-brand mt-3 text-xs font-bold">Abrir →</span>
          </Link>

          <Link
            href="/pasajero/cuenta"
            className="border-brand/20 hover:border-brand flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition"
          >
            <div>
              <p className="font-heading text-brand text-base font-bold">Mi cuenta</p>
              <p className="text-ink-muted mt-1 text-xs">
                Datos personales, notificaciones, privacidad y baja de cuenta (RF-014 a RF-016,
                RF-109)
              </p>
            </div>
            <span className="text-brand mt-3 text-xs font-bold">Abrir →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
