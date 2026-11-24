"use server";

import { revalidatePath } from "next/cache";

import type { ApproveDeviceField } from "@/application/devices/device-use-cases";
import { InputError } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { assertRole } from "@/lib/auth/require-role";
import { approveDevice, renameDevice, revokeDevice } from "@/lib/superadmin/devices";

const PATH = "/superadmin/computadoras";

export interface DeviceActionState {
  error?: string;
  fieldErrors?: Partial<Record<ApproveDeviceField, string>>;
  done?: string;
}

function failure(error: unknown): DeviceActionState {
  if (error instanceof InputError) return { fieldErrors: error.fieldErrors };
  if (error instanceof DomainError) return { error: error.message };
  throw error;
}

/** Aprobar asignando muelle (o la oficina del superadmin) y nombre (RF-121). */
export async function approveDeviceAction(
  deviceId: string,
  _prev: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const actor = await assertRole("SUPERADMIN");
  try {
    await approveDevice(actor, deviceId, {
      name: String(formData.get("name") ?? ""),
      dockId: String(formData.get("dockId") ?? ""),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { done: "Computadora aprobada." };
}

/** Revocar una aprobada o rechazar una solicitud (RF-121): sus sesiones se cierran. */
export async function revokeDeviceAction(deviceId: string): Promise<DeviceActionState> {
  const actor = await assertRole("SUPERADMIN");
  try {
    await revokeDevice(actor, deviceId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { done: "Computadora revocada. Se cerraron sus sesiones." };
}

export async function renameDeviceAction(
  deviceId: string,
  _prev: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const actor = await assertRole("SUPERADMIN");
  try {
    await renameDevice(actor, deviceId, String(formData.get("name") ?? ""));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { done: "Nombre actualizado." };
}
