"use server";

import { revalidatePath } from "next/cache";

import { createCloseAnnouncement } from "@/application/announcements/close-announcement";
import { createPublishAnnouncement } from "@/application/announcements/publish-announcement";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaAnnouncementRepository } from "@/infrastructure/announcements/prisma-announcement-repository";
import { assertRole } from "@/lib/auth/require-role";

export interface AnnouncementActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function publishAnnouncementAction(
  _prevState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const admin = await assertRole("ADMIN");

  try {
    const repo = new PrismaAnnouncementRepository();
    const publishAnnouncement = createPublishAnnouncement({ repo });

    await publishAnnouncement(admin.id, {
      title: formData.get("title"),
      message: formData.get("message"),
      dockId: formData.get("dockId"),
      startsAtRaw: formData.get("startsAt"),
      endsAtRaw: formData.get("endsAt"),
    });

    revalidatePath("/admin/avisos");
    revalidatePath("/pasajero");
    return { status: "success", message: "Aviso publicado correctamente." };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "No se pudo publicar el aviso." };
  }
}

export async function closeAnnouncementAction(
  _prevState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const admin = await assertRole("ADMIN");

  try {
    const repo = new PrismaAnnouncementRepository();
    const closeAnnouncement = createCloseAnnouncement({ repo });

    await closeAnnouncement(admin.id, {
      announcementId: formData.get("announcementId"),
    });

    revalidatePath("/admin/avisos");
    revalidatePath("/pasajero");
    return { status: "success", message: "El aviso se marcó como finalizado." };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "No se pudo finalizar el aviso." };
  }
}
