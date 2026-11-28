"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/domain/shared/domain-error";
import { VESSEL_KINDS, type VesselKind } from "@/domain/fleet/vessel";
import { VESSEL_STATUSES, type VesselStatus } from "@/domain/fleet/vessel-status";
import { createChangeVesselStatus } from "@/application/fleet/change-vessel-status";
import { createCreateVessel } from "@/application/fleet/create-vessel";
import { createUpdateVessel } from "@/application/fleet/update-vessel";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaVesselRepository } from "@/infrastructure/fleet/prisma-vessel-repository";
import { PrismaVesselStatusRepository } from "@/infrastructure/fleet/prisma-vessel-status.repository";
import { assertRole } from "@/lib/auth/require-role";

export interface VesselActionState {
  error: string | null;
}

export interface VesselStatusActionState {
  error: string | null;
  success: string | null;
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
  revalidatePath("/admin/flota/" + vesselId);
  redirect("/admin/flota");
}

export async function changeVesselStatusAction(
  vesselId: string,
  _prevState: VesselStatusActionState,
  formData: FormData,
): Promise<VesselStatusActionState> {
  const user = await assertRole("ADMIN", "SUPERADMIN");

  const rawToStatus = String(formData.get("toStatus") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!VESSEL_STATUSES.includes(rawToStatus as VesselStatus)) {
    return {
      error: "Selecciona un estado válido para la embarcación.",
      success: null,
    };
  }

  try {
    const statusRepo = new PrismaVesselStatusRepository(prisma);
    const changeVesselStatus = createChangeVesselStatus(statusRepo);
    const historyEntry = await changeVesselStatus({
      vesselId,
      toStatus: rawToStatus as VesselStatus,
      reason,
      changedById: user.id,
    });

    const auditLogger = prismaAuditLogger(prisma);
    await auditLogger.log({
      userId: user.id,
      action: "VESSEL_STATUS_CHANGED",
      entity: "vessels",
      entityId: vesselId,
      details: {
        fromStatus: historyEntry.fromStatus,
        toStatus: historyEntry.toStatus,
        reason: historyEntry.reason,
        historyId: historyEntry.id,
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message, success: null };
    }
    return {
      error: "Ocurrió un error inesperado al cambiar el estado de la embarcación.",
      success: null,
    };
  }

  revalidatePath("/admin/flota");
  revalidatePath("/admin/flota/" + vesselId);

  return {
    error: null,
    success: "Estado de la embarcación actualizado y registrado en el historial.",
  };
}
