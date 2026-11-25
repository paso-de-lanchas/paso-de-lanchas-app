"use server";

import { revalidatePath } from "next/cache";

import { InputError } from "@/application/shared/input-error";
import type { NewStaffField } from "@/application/staff/staff-input";
import { DomainError } from "@/domain/shared/domain-error";
import type { StaffStatusChange } from "@/domain/staff/staff-rules";
import { assertRole } from "@/lib/auth/require-role";
import {
  createStaffAccount,
  resetStaffPassword,
  setStaffStatus,
  unlockStaffAccount,
} from "@/lib/superadmin/staff";

const LIST_PATH = "/superadmin/personal";

export interface CreateStaffState {
  error?: string;
  fieldErrors?: Partial<Record<NewStaffField, string>>;
  values?: Record<NewStaffField, string>;
  created?: {
    id: string;
    fullName: string;
    email: string;
    temporaryPassword: string;
    emailSent: boolean;
  };
}

/** Alta de administrador o chofer (RF-116, RF-117). La contraseña se muestra una vez. */
export async function createStaffAction(
  _prev: CreateStaffState,
  formData: FormData,
): Promise<CreateStaffState> {
  const actor = await assertRole("SUPERADMIN");
  const values: Record<NewStaffField, string> = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? ""),
    dockId: String(formData.get("dockId") ?? ""),
  };
  try {
    const result = await createStaffAccount(actor, values);
    revalidatePath(LIST_PATH);
    return {
      created: {
        id: result.id,
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        temporaryPassword: result.temporaryPassword,
        emailSent: result.emailSent,
      },
    };
  } catch (error) {
    if (error instanceof InputError) return { fieldErrors: error.fieldErrors, values };
    if (error instanceof DomainError) return { error: error.message, values };
    throw error;
  }
}

export interface StaffActionState {
  error?: string;
  done?: string;
  temporaryPassword?: string;
  emailSent?: boolean;
}

function failure(error: unknown): StaffActionState {
  if (error instanceof DomainError) return { error: error.message };
  throw error;
}

/**
 * Desactivar o reactivar (RF-118). `change` viene del botón que se presionó; el caso de uso
 * rechaza cualquier valor que no sea DEACTIVATE o REACTIVATE.
 */
export async function changeStaffStatusAction(
  staffId: string,
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const actor = await assertRole("SUPERADMIN");
  let change: StaffStatusChange;
  try {
    change = await setStaffStatus(actor, staffId, formData.get("change"));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${staffId}`);
  return {
    done:
      change === "DEACTIVATE"
        ? "Cuenta desactivada. Se cerraron sus sesiones."
        : "Cuenta reactivada.",
  };
}

/** Quitar el bloqueo por intentos fallidos (RF-118). */
export async function unlockStaffAction(staffId: string): Promise<StaffActionState> {
  const actor = await assertRole("SUPERADMIN");
  try {
    await unlockStaffAccount(actor, staffId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`${LIST_PATH}/${staffId}`);
  return { done: "Cuenta desbloqueada: ya puede intentar entrar de nuevo." };
}

/** Nueva contraseña temporal (RF-119). Se muestra una sola vez. */
export async function resetStaffPasswordAction(staffId: string): Promise<StaffActionState> {
  const actor = await assertRole("SUPERADMIN");
  try {
    const result = await resetStaffPassword(actor, staffId);
    revalidatePath(`${LIST_PATH}/${staffId}`);
    return { ...result, done: "Contraseña restablecida. Se cerraron sus sesiones." };
  } catch (error) {
    return failure(error);
  }
}
