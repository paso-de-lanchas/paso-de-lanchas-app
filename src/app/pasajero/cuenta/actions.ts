"use server";

import { revalidatePath } from "next/cache";

import { updateProfile } from "@/application/account/update-profile";
import { createUpdateNotificationPreferences } from "@/application/notifications/update-notification-preferences";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaAccountRepository } from "@/infrastructure/account/prisma-account-repository";
import { PrismaNotificationRepository } from "@/infrastructure/notifications/prisma-notification-repository";
import { assertRole } from "@/lib/auth/require-role";

export interface ProfileActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export interface NotificationPreferencesActionState {
  status: "idle" | "success" | "error";
  enabled: boolean;
  message?: string;
}

export async function updatePassengerProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const sessionUser = await assertRole("PASSENGER");
  const repo = new PrismaAccountRepository();

  try {
    await updateProfile(repo, sessionUser.id, {
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
    });

    revalidatePath("/pasajero/cuenta");
    return {
      status: "success",
      message: "Tus datos personales se actualizaron correctamente.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Ocurrió un problema al guardar los cambios. Intenta de nuevo.",
    };
  }
}

export async function updateNotificationPreferencesAction(
  enabled: boolean,
): Promise<NotificationPreferencesActionState> {
  const sessionUser = await assertRole("PASSENGER");
  const repo = new PrismaNotificationRepository();

  try {
    const saved = await createUpdateNotificationPreferences({ repo })({ enabled }, sessionUser.id);
    revalidatePath("/pasajero/cuenta");
    revalidatePath("/pasajero");
    return {
      status: "success",
      enabled: saved,
      message: saved
        ? "Notificaciones activadas. Recibirás avisos de saldo y viajes."
        : "Notificaciones desactivadas. Ya no recibirás nuevos avisos.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", enabled: !enabled, message: error.message };
    }
    return {
      status: "error",
      enabled: !enabled,
      message: "No se pudo actualizar tu preferencia de notificaciones.",
    };
  }
}
