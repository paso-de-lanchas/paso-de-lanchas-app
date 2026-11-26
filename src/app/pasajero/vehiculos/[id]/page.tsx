import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { systemClock } from "@/application/shared/ports";
import {
  createGetMyVehicle,
  createListActiveVehicleTypes,
} from "@/application/vehicles/list-my-vehicles";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaVehicleFareProvider } from "@/infrastructure/vehicles/prisma-vehicle-fare-provider";
import { PrismaVehicleRepository } from "@/infrastructure/vehicles/prisma-vehicle-repository";
import { requireRole } from "@/lib/auth/require-role";

import { VehicleForm } from "../vehicle-form";
import { DeleteVehicleForm } from "./delete-vehicle-form";

export const metadata: Metadata = { title: "Editar vehículo" };

interface EditVehiclePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditVehiclePage({ params }: EditVehiclePageProps) {
  const sessionUser = await requireRole("PASSENGER");
  const { id } = await params;

  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const vehicleRepo = new PrismaVehicleRepository();
  const fareProvider = new PrismaVehicleFareProvider();

  const getMyVehicle = createGetMyVehicle({
    vehicles: vehicleRepo,
    fares: fareProvider,
    clock: systemClock,
  });
  const listActiveTypes = createListActiveVehicleTypes({ vehicles: vehicleRepo });

  let vehicle;
  try {
    vehicle = await getMyVehicle(sessionUser.id, parsedId.data);
  } catch (error) {
    if (error instanceof DomainError && error.code === "VEHICLE_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const vehicleTypes = await listActiveTypes();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <Link href="/pasajero/vehiculos" className="text-brand text-xs font-bold hover:underline">
          ← Volver a Mis vehículos
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Editar vehículo</h1>
        <p className="text-ink-muted text-xs">
          Tarifa vigente para {vehicle.vehicleTypeName}:{" "}
          <span className="text-brand font-bold">
            {vehicle.formattedFare ?? "Pendiente de configurar"}
          </span>
        </p>
      </header>

      <VehicleForm
        mode="edit"
        vehicleId={vehicle.id}
        vehicleTypes={vehicleTypes}
        initialValues={{
          vehicleTypeId: String(vehicle.vehicleTypeId),
          brand: vehicle.brand,
          model: vehicle.model,
          color: vehicle.color,
          plate: vehicle.plate,
          photoUrl: vehicle.photoUrl ?? "",
        }}
      />

      <DeleteVehicleForm vehicleId={vehicle.id} plate={vehicle.plate} />
    </main>
  );
}
