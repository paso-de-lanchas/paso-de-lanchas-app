import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import type { DeviceView } from "@/application/devices/ports";
import { SectionLoading } from "@/components/section-loading";
import type { DeviceStatus } from "@/domain/auth/authorized-device";
import { requireRole } from "@/lib/auth/require-role";
import { listDevices } from "@/lib/superadmin/devices";

import { formatDateTime } from "../labels";
import { SuperadminHeader } from "../superadmin-header";
import { ApproveDeviceForm, ApprovedDeviceForms } from "./device-forms";

export const metadata: Metadata = { title: "Computadoras | Superadministrador" };

const TABS: { status: DeviceStatus; label: string }[] = [
  { status: "PENDING", label: "Pendientes" },
  { status: "APPROVED", label: "Aprobadas" },
  { status: "REVOKED", label: "Revocadas" },
];

const REQUESTER_ROLE: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERADMIN: "Superadministrador",
};

/** Solicitudes, computadoras aprobadas y revocadas (RF-120, RF-121). */
export default function DevicesPage({ searchParams }: PageProps<"/superadmin/computadoras">) {
  return (
    <Suspense fallback={<SectionLoading />}>
      <Devices searchParams={searchParams} />
    </Suspense>
  );
}

async function Devices({
  searchParams,
}: Pick<PageProps<"/superadmin/computadoras">, "searchParams">) {
  const user = await requireRole("SUPERADMIN");
  const { estado } = await searchParams;
  const { status, devices, docks } = await listDevices(estado);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <SuperadminHeader userName={user.fullName} back={{ href: "/superadmin", label: "Inicio" }} />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-brand text-3xl font-bold">Computadoras</h1>
        <p className="text-ink-muted">
          El administrador y el superadministrador solo entran desde una computadora aprobada; la
          del administrador, además, debe ser de su muelle.
        </p>
      </div>

      <nav aria-label="Estado de las computadoras" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/superadmin/computadoras?estado=${tab.status}`}
            aria-current={tab.status === status ? "page" : undefined}
            className={
              tab.status === status
                ? "bg-brand rounded-full px-4 py-2 text-sm font-bold text-white"
                : "border-line text-brand rounded-full border bg-white px-4 py-2 text-sm font-bold"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {devices.length === 0 ? (
        <p className="border-line text-ink-muted rounded-2xl border bg-white p-8 text-center">
          {status === "PENDING" ? "No hay solicitudes pendientes." : "No hay computadoras aquí."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {devices.map((device) => (
            <li key={device.id}>
              <DeviceCard device={device}>
                {device.status === "PENDING" && (
                  <ApproveDeviceForm
                    deviceId={device.id}
                    name={device.name}
                    dockId={device.dockId ?? device.requestedBy.dockId}
                    allowOffice={device.requestedBy.role === "SUPERADMIN"}
                    // La de un administrador solo puede ser de su muelle (el servidor también lo exige).
                    docks={
                      device.requestedBy.role === "ADMIN"
                        ? docks.filter((dock) => dock.id === device.requestedBy.dockId)
                        : docks
                    }
                  />
                )}
                {device.status === "APPROVED" && (
                  <ApprovedDeviceForms deviceId={device.id} name={device.name} />
                )}
              </DeviceCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DeviceCard({ device, children }: { device: DeviceView; children: React.ReactNode }) {
  const rows: [string, string][] = [
    [
      "Pedida por",
      `${device.requestedBy.fullName} (${REQUESTER_ROLE[device.requestedBy.role] ?? device.requestedBy.role}) · ${device.requestedBy.email}`,
    ],
    ["Fecha de solicitud", formatDateTime(device.requestedAt)],
  ];
  if (device.status !== "PENDING") rows.push(["Muelle", device.dockName ?? "Oficina (sin muelle)"]);
  if (device.approvedAt) {
    rows.push([
      "Aprobada",
      `${formatDateTime(device.approvedAt)}${device.approvedByName ? ` por ${device.approvedByName}` : ""}`,
    ]);
  }
  if (device.status !== "PENDING") {
    rows.push(["Último uso", device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "Nunca"]);
  }

  return (
    <article
      aria-label={device.name}
      className="border-line flex flex-col gap-4 rounded-2xl border bg-white p-5"
    >
      <h2 className="font-heading text-brand text-lg font-bold">{device.name}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted font-bold">{label}</dt>
            <dd className="text-ink break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </article>
  );
}
