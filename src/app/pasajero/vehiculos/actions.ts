"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { InputError } from "@/application/shared/input-error";
import { systemClock } from "@/application/shared/ports";
import { createAddVehicle } from "@/application/vehicles/add-vehicle";
import { createRemoveVehicle } from "@/application/vehicles/remove-vehicle";
import { createUpdateVehicle } from "@/application/vehicles/update-vehicle";
import type { VehicleField } from "@/application/vehicles/vehicle-input";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaVehicleRepository } from "@/infrastructure/vehicles/prisma-vehicle-repository";
import { assertRole } from "@/lib/auth/require-role";

export interface VehicleFormValues {
  vehicleTypeId?: string;
  brand?: string;
  model?: string;
  color?: string;
  plate?: string;
  photoUrl?: string;
}

export interface VehicleFormState {
  error?: string;
  fieldErrors?: Partial<Record<VehicleField, string>>;
  values?: VehicleFormValues;
}

export interface DeleteVehicleState {
  error?: string;
}

function readVehicleFormValues(formData: FormData): VehicleFormValues {
  return {
    vehicleTypeId: String(formData.get("vehicleTypeId") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    color: String(formData.get("color") ?? ""),
    plate: String(formData.get("plate") ?? ""),
    photoUrl: String(formData.get("photoUrl") ?? ""),
  };
}

export async function addVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const sessionUser = await assertRole("PASSENGER");
  const values = readVehicleFormValues(formData);
  const repo = new PrismaVehicleRepository();
  const addVehicle = createAddVehicle({ vehicles: repo });

  try {
    await addVehicle(sessionUser.id, values);
  } catch (error) {
    if (error instanceof InputError) {
      return {
        fieldErrors: error.fieldErrors as Partial<Record<VehicleField, string>>,
        values,
      };
    }
    if (error instanceof DomainError) {
      return { error: error.message, values };
    }
    return { error: "No se pudo registrar el vehículo. Intenta de nuevo.", values };
  }

  revalidatePath("/pasajero/vehiculos");
  redirect("/pasajero/vehiculos");
}

export async function updateVehicleAction(
  vehicleId: string,
  _prevState: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const sessionUser = await assertRole("PASSENGER");
  const parsedId = z.uuid().safeParse(vehicleId);
  if (!parsedId.success) {
    return { error: "El identificador del vehículo no es válido." };
  }

  const values = readVehicleFormValues(formData);
  const repo = new PrismaVehicleRepository();
  const updateVehicle = createUpdateVehicle({ vehicles: repo });

  try {
    await updateVehicle(sessionUser.id, parsedId.data, values);
  } catch (error) {
    if (error instanceof InputError) {
      return {
        fieldErrors: error.fieldErrors as Partial<Record<VehicleField, string>>,
        values,
      };
    }
    if (error instanceof DomainError) {
      return { error: error.message, values };
    }
    return { error: "No se pudo actualizar el vehículo. Intenta de nuevo.", values };
  }

  revalidatePath("/pasajero/vehiculos");
  revalidatePath(`/pasajero/vehiculos/${parsedId.data}`);
  redirect("/pasajero/vehiculos");
}

export async function removeVehicleAction(
  vehicleId: string,
  _prevState: DeleteVehicleState,
  _formData: FormData,
): Promise<DeleteVehicleState> {
  void _formData;
  const sessionUser = await assertRole("PASSENGER");
  const parsedId = z.uuid().safeParse(vehicleId);
  if (!parsedId.success) {
    return { error: "El identificador del vehículo no es válido." };
  }

  const repo = new PrismaVehicleRepository();
  const removeVehicle = createRemoveVehicle({ vehicles: repo, clock: systemClock });

  try {
    await removeVehicle(sessionUser.id, parsedId.data);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return { error: "No se pudo eliminar el vehículo. Intenta de nuevo." };
  }

  revalidatePath("/pasajero/vehiculos");
  redirect("/pasajero/vehiculos");
}
