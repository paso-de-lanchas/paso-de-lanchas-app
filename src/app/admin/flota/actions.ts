"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/domain/shared/domain-error";
import { VESSEL_KINDS, type VesselKind } from "@/domain/fleet/vessel";
import { createCreateVessel } from "@/application/fleet/create-vessel";
import { createUpdateVessel } from "@/application/fleet/update-vessel";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaVesselRepository } from "@/infrastructure/fleet/prisma-vessel-repository";
import { assertRole } from "@/lib/auth/require-role";

export interface VesselActionState {
  error: string | null;
}

function parseVehicleCapacities(
  formData: FormData,
  kind: VesselKind,
): Array<{ vehicleTypeId: number; capacity: number }> {
  if (kind !== "FERRY") {
    return [];
  }

  const capacities: Array<{ vehicleTypeId: number; capacity: number }> = [];

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("vehicleCapacity_")) continue;

    const vehicleTypeId = Number(key.replace("vehicleCapacity_", ""));
    if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) continue;

    const rawText = String(rawValue).trim();
    const capacity = rawText === "" ? 0 : Number(rawText);

    capacities.push({
      vehicleTypeId,
      capacity,
    });
  }

  return capacities;
}

function parseFormPayload(formData: FormData) {
  const rawKind = String(formData.get("kind") ?? "BOAT");
  const kind: VesselKind = VESSEL_KINDS.includes(rawKind as VesselKind)
    ? (rawKind as VesselKind)
    : "BOAT";

  const rawPassengerCapacity = String(formData.get("passengerCapacity") ?? "").trim();

  return {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    kind,
    registration: String(formData.get("registration") ?? ""),
    color: String(formData.get("color") ?? ""),
    photoUrl: String(formData.get("photoUrl") ?? ""),
    passengerCapacity: rawPassengerCapacity === "" ? NaN : Number(rawPassengerCapacity),
    vehicleCapacities: parseVehicleCapacities(formData, kind),
  };
}

export async function createVesselAction(
  _prevState: VesselActionState,
  formData: FormData,
): Promise<VesselActionState> {
  const user = await assertRole("ADMIN", "SUPERADMIN");

  try {
    const repo = new PrismaVesselRepository(prisma);
    const auditLogger = prismaAuditLogger(prisma);
    const createVessel = createCreateVessel(repo, auditLogger);
    const payload = parseFormPayload(formData);

    await createVessel(payload, user.id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return {
      error: "Ocurrió un error inesperado al registrar la embarcación.",
    };
  }

  revalidatePath("/admin/flota");
  redirect("/admin/flota");
}

export async function updateVesselAction(
  vesselId: string,
  _prevState: VesselActionState,
  formData: FormData,
): Promise<VesselActionState> {
  const user = await assertRole("ADMIN", "SUPERADMIN");

  try {
    const repo = new PrismaVesselRepository(prisma);
    const auditLogger = prismaAuditLogger(prisma);
    const updateVessel = createUpdateVessel(repo, auditLogger);
    const payload = parseFormPayload(formData);

    await updateVessel(vesselId, payload, user.id);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message };
    }
    return {
      error: "Ocurrió un error inesperado al actualizar la embarcación.",
    };
  }

  revalidatePath("/admin/flota");
  revalidatePath(`/admin/flota/${vesselId}`);
  redirect("/admin/flota");
}
