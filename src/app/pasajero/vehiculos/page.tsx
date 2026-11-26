import type { Metadata } from "next";
import Link from "next/link";

import { systemClock } from "@/application/shared/ports";
import {
  createListActiveVehicleTypes,
  createListMyVehicles,
} from "@/application/vehicles/list-my-vehicles";
import { PrismaVehicleFareProvider } from "@/infrastructure/vehicles/prisma-vehicle-fare-provider";
import { PrismaVehicleRepository } from "@/infrastructure/vehicles/prisma-vehicle-repository";
import { requireRole } from "@/lib/auth/require-role";

import { VehicleForm } from "./vehicle-form";

export const metadata: Metadata = { title: "Mis vehículos" };

export default async function PassengerVehiclesPage() {
  const sessionUser = await requireRole("PASSENGER");
  const vehicleRepo = new PrismaVehicleRepository();
  const fareProvider = new PrismaVehicleFareProvider();

  const listMyVehicles = createListMyVehicles({
    vehicles: vehicleRepo,
    fares: fareProvider,
    clock: systemClock,
  });
  const listActiveTypes = createListActiveVehicleTypes({ vehicles: vehicleRepo });

  const [vehicles, vehicleTypes] = await Promise.all([
    listMyVehicles(sessionUser.id),
    listActiveTypes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Link href="/pasajero" className="text-brand text-xs font-bold hover:underline">
          ← Volver a Pasajero
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Mis vehículos</h1>
        <p className="text-ink-muted text-xs">
          Registra tus vehículos para abordar el transbordador con su tarifa vigente (RF-039 a
          RF-042).
        </p>
      </header>

      <section aria-labelledby="registered-vehicles-heading" className="space-y-3">
        <h2 id="registered-vehicles-heading" className="font-heading text-ink text-lg font-bold">
          Vehículos registrados ({vehicles.length})
        </h2>

        {vehicles.length === 0 ? (
          <div className="border-line text-ink-muted rounded-2xl border bg-white p-5 text-sm shadow-xs">
            Aún no tienes vehículos registrados. Agrega uno en el formulario de abajo.
          </div>
        ) : (
          <ul className="space-y-3">
            {vehicles.map((vehicle) => (
              <li
                key={vehicle.id}
                className="border-line flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-brand/10 text-brand rounded-lg px-2 py-0.5 font-mono text-xs font-bold">
                      {vehicle.plate}
                    </span>
                    <span className="text-ink-muted text-xs font-semibold">
                      {vehicle.vehicleTypeName}
                    </span>
                  </div>
                  <p className="text-ink truncate text-sm font-bold">
                    {vehicle.brand} {vehicle.model} · {vehicle.color}
                  </p>
                  <p className="text-brand text-xs font-bold">
                    Tarifa vigente: {vehicle.formattedFare ?? "Pendiente de configurar"}
                  </p>
                </div>

                <Link
                  href={`/pasajero/vehiculos/${vehicle.id}`}
                  className="border-line text-brand hover:border-brand shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add-vehicle-heading" className="space-y-3">
        <h2 id="add-vehicle-heading" className="font-heading text-ink text-lg font-bold">
          Registrar nuevo vehículo
        </h2>
        <VehicleForm mode="create" vehicleTypes={vehicleTypes} />
      </section>
    </main>
  );
}
