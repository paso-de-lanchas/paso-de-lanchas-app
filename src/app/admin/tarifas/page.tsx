import type { Metadata } from "next";
import Link from "next/link";

import { createListCurrentFares } from "@/application/fares/list-current-fares";
import { createListFareHistory } from "@/application/fares/list-fare-history";
import { prismaFareRepository } from "@/infrastructure/fares/prisma-fare-repository";
import { prisma } from "@/infrastructure/db/prisma";
import { requireRole } from "@/lib/auth/require-role";

import { setFareAction } from "./actions";

export const metadata: Metadata = { title: "Tarifas" };

const passengerCategories = [
  { value: "GENERAL", label: "General" },
  { value: "STUDENT", label: "Estudiante" },
  { value: "INAPAM", label: "INAPAM" },
] as const;

const fareCategoryLabels: Record<string, string> = {
  GENERAL: "General",
  STUDENT: "Estudiante",
  INAPAM: "INAPAM",
  PEDESTRIAN: "Peatón",
  VEHICLE: "Vehículo",
};

const vesselLabels = { BOAT: "Lancha", FERRY: "Transbordador" };
const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

function FareForm({
  vesselKind,
  category,
  label,
  currentAmount,
  vehicleTypeId,
}: {
  vesselKind: "BOAT" | "FERRY";
  category: string;
  label: string;
  currentAmount?: string;
  vehicleTypeId?: number;
}) {
  return (
    <form action={setFareAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="vesselKind" value={vesselKind} />
      <input type="hidden" name="category" value={category} />
      {vehicleTypeId !== undefined && (
        <input type="hidden" name="vehicleTypeId" value={vehicleTypeId} />
      )}
      <label className="text-ink grid gap-1 text-sm font-bold">
        {label} · nueva tarifa (MXN)
        <input
          aria-label={`Nueva tarifa: ${label}`}
          className="border-line w-40 rounded-lg border bg-white px-3 py-2 font-normal"
          defaultValue={currentAmount}
          inputMode="decimal"
          max="99999999.99"
          min="0"
          name="amount"
          placeholder="0.00"
          required
          step="0.01"
          type="number"
        />
      </label>
      <button
        className="bg-brand hover:bg-brand-accent rounded-lg px-4 py-2 font-bold text-white"
        type="submit"
      >
        Cambiar tarifa
      </button>
    </form>
  );
}

export default async function FaresPage({ searchParams }: PageProps<"/admin/tarifas">) {
  const user = await requireRole("ADMIN");
  const repository = prismaFareRepository(prisma);
  const now = new Date();
  const [currentFares, history, vehicleTypes, params] = await Promise.all([
    createListCurrentFares(repository)(now),
    createListFareHistory(repository)(),
    repository.listVehicleTypes(),
    searchParams,
  ]);
  const current = (vesselKind: "BOAT" | "FERRY", category: string, vehicleTypeId?: number) =>
    currentFares.find(
      (fare) =>
        fare.vesselKind === vesselKind &&
        fare.category === category &&
        fare.vehicleTypeId === (vehicleTypeId ?? null),
    );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link className="text-brand text-sm font-bold hover:underline" href="/admin">
          ← Panel de administración
        </Link>
        <h1 className="font-heading text-3xl font-bold">Tarifas</h1>
        <p className="text-ink-muted max-w-3xl">
          La tarifa nueva entra en vigor al guardarla. El cierre de la anterior y el registro de
          esta tarifa se realizan juntos; el precio es igual en ambos sentidos.
        </p>
        <p className="text-ink-muted text-sm">Sesión de {user.fullName}</p>
      </header>

      {params.error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900" role="alert">
          {params.error}
        </p>
      )}
      {params.guardada && (
        <p className="bg-success-bg text-success-ink rounded-lg p-3" role="status">
          La nueva tarifa quedó registrada.
        </p>
      )}

      <section aria-labelledby="current-fares-heading" className="space-y-4">
        <h2 className="font-heading text-2xl font-bold" id="current-fares-heading">
          Tarifas vigentes
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="border-line space-y-4 rounded-2xl border bg-white p-5">
            <h3 className="font-heading text-xl font-bold">Lancha · pasajeros</h3>
            {passengerCategories.map(({ value, label }) => {
              const fare = current("BOAT", value);
              return (
                <div className="border-line border-t pt-4" key={value}>
                  <p className="text-ink-muted mb-3 text-sm">
                    Vigente:{" "}
                    {fare ? currency.format(Number(fare.amount.toDecimalString())) : "Sin tarifa"}
                    {fare && ` · desde ${dateTime.format(fare.validFrom)}`}
                  </p>
                  <FareForm
                    category={value}
                    currentAmount={fare?.amount.toDecimalString()}
                    label={label}
                    vesselKind="BOAT"
                  />
                </div>
              );
            })}
          </section>

          <section className="border-line space-y-4 rounded-2xl border bg-white p-5">
            <h3 className="font-heading text-xl font-bold">Transbordador</h3>
            {(() => {
              const fare = current("FERRY", "PEDESTRIAN");
              return (
                <div className="border-line border-t pt-4">
                  <p className="text-ink-muted mb-3 text-sm">
                    Vigente:{" "}
                    {fare ? currency.format(Number(fare.amount.toDecimalString())) : "Sin tarifa"}
                    {fare && ` · desde ${dateTime.format(fare.validFrom)}`}
                  </p>
                  <FareForm
                    category="PEDESTRIAN"
                    currentAmount={fare?.amount.toDecimalString()}
                    label="Peatón"
                    vesselKind="FERRY"
                  />
                </div>
              );
            })()}
            <div className="border-line space-y-4 border-t pt-4">
              <h4 className="font-bold">Por tipo de vehículo</h4>
              {vehicleTypes.map((vehicleType) => {
                const fare = current("FERRY", "VEHICLE", vehicleType.id);
                return (
                  <div className="border-line border-t pt-4" key={vehicleType.id}>
                    <p className="text-ink-muted mb-3 text-sm">
                      Vigente:{" "}
                      {fare ? currency.format(Number(fare.amount.toDecimalString())) : "Sin tarifa"}
                      {fare && ` · desde ${dateTime.format(fare.validFrom)}`}
                    </p>
                    <FareForm
                      category="VEHICLE"
                      currentAmount={fare?.amount.toDecimalString()}
                      label={vehicleType.name}
                      vehicleTypeId={vehicleType.id}
                      vesselKind="FERRY"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>

      <section aria-labelledby="fare-history-heading" className="space-y-4">
        <h2 className="font-heading text-2xl font-bold" id="fare-history-heading">
          Historial de tarifas
        </h2>
        <div className="border-line overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="p-3">Servicio</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Vigencia</th>
              </tr>
            </thead>
            <tbody>
              {history.map((fare) => (
                <tr className="border-line border-t" key={fare.id}>
                  <td className="p-3">{vesselLabels[fare.vesselKind]}</td>
                  <td className="p-3">
                    {fare.vehicleTypeName ?? fareCategoryLabels[fare.category]}
                  </td>
                  <td className="p-3 font-bold">
                    {currency.format(Number(fare.amount.toDecimalString()))}
                  </td>
                  <td className="p-3">
                    {dateTime.format(fare.validFrom)} —{" "}
                    {fare.validTo ? dateTime.format(fare.validTo) : "Vigente"}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td className="text-ink-muted p-4" colSpan={4}>
                    Aún no hay tarifas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
