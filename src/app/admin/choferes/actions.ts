"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@/domain/shared/domain-error";
import { InputError } from "@/application/shared/input-error";
import { createAssignDriverToVessel } from "@/application/drivers/assign-driver-to-vessel";
import { createUpdateDriver } from "@/application/drivers/update-driver";
import { createUnassignDriver } from "@/application/drivers/unassign-driver";
import { PrismaDriverRepository } from "@/infrastructure/drivers/prisma-driver.repository";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { assertRole } from "@/lib/auth/require-role";

export interface DriverActionState {
  error: string | null;
  success: string | null;
}

export async function updateDriverAction(
  driverId: string,
  _prevState: DriverActionState,
  formData: FormData,
): Promise<DriverActionState> {
  const actor = await assertRole("ADMIN", "SUPERADMIN");

  try {
    const repo = new PrismaDriverRepository();
    const audit = prismaAuditLogger(prisma);
    const updateDriver = createUpdateDriver(repo);

    const updated = await updateDriver({
      driverId,
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      photoUrl: String(formData.get("photoUrl") ?? ""),
    });

    await audit.log({
      userId: actor.id,
      action: "DRIVER_UPDATED",
      entity: "user",
      entityId: driverId,
      details: { fullName: updated.fullName, phone: updated.phone },
    });
  } catch (err) {
    if (err instanceof InputError || err instanceof DomainError) {
      return { error: err.message, success: null };
    }
    return { error: "No se pudieron guardar los datos del chofer.", success: null };
  }

  revalidatePath("/admin/choferes");
  revalidatePath(`/admin/choferes/${driverId}`);
  return { error: null, success: "Datos del chofer actualizados correctamente." };
}

export async function assignDriverAction(
  driverId: string,
  _prevState: DriverActionState,
  formData: FormData,
): Promise<DriverActionState> {
  const actor = await assertRole("ADMIN", "SUPERADMIN");
  const vesselId = String(formData.get("vesselId") ?? "").trim();

  if (!vesselId) {
    return { error: "Selecciona una embarcación para asignar.", success: null };
  }

  try {
    const repo = new PrismaDriverRepository();
    const audit = prismaAuditLogger(prisma);
    const assignDriver = createAssignDriverToVessel(repo);

    const assignment = await assignDriver({ driverId, vesselId });

    await audit.log({
      userId: actor.id,
      action: "DRIVER_ASSIGNED_TO_VESSEL",
      entity: "vessel_driver",
      entityId: assignment.id,
      details: { driverId, vesselId },
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return { error: err.message, success: null };
    }
    return { error: "No se pudo asignar el chofer a la embarcación.", success: null };
  }

  revalidatePath("/admin/choferes");
  revalidatePath(`/admin/choferes/${driverId}`);
  revalidatePath(`/admin/flota/${vesselId}`);
  revalidatePath("/admin/operacion");
  return { error: null, success: "Chofer asignado a la embarcación." };
}

export async function unassignDriverAction(
  driverId: string,
  assignmentId: string,
): Promise<void> {
  const actor = await assertRole("ADMIN", "SUPERADMIN");
  const repo = new PrismaDriverRepository();
  const audit = prismaAuditLogger(prisma);
  const unassign = createUnassignDriver(repo);

  const record = await unassign({ assignmentId });

  await audit.log({
    userId: actor.id,
    action: "DRIVER_UNASSIGNED_FROM_VESSEL",
    entity: "vessel_driver",
    entityId: record.id,
    details: {
      driverId,
      vesselId: record.vesselId,
      unassignedAt: record.unassignedAt,
    },
  });

  revalidatePath("/admin/choferes");
  revalidatePath(`/admin/choferes/${driverId}`);
  revalidatePath(`/admin/flota/${record.vesselId}`);
  revalidatePath("/admin/operacion");
}