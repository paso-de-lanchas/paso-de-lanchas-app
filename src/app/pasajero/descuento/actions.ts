"use server";

import { revalidatePath } from "next/cache";

import { requestDiscount } from "@/application/account/request-discount";
import { DomainError } from "@/domain/shared/domain-error";
import {
  deletePrivateCredentialFile,
  PrismaDiscountRepository,
  savePrivateCredentialFile,
} from "@/infrastructure/account/prisma-discount-repository";
import { assertRole } from "@/lib/auth/require-role";

export interface DiscountRequestActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function submitDiscountRequestAction(
  _prevState: DiscountRequestActionState,
  formData: FormData,
): Promise<DiscountRequestActionState> {
  const passenger = await assertRole("PASSENGER");

  const fileEntry = formData.get("credentialPhoto");
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return {
      status: "error",
      message: "Selecciona una fotografía de tu credencial vigente.",
    };
  }

  let savedRelativePath: string | null = null;

  try {
    savedRelativePath = await savePrivateCredentialFile(fileEntry);
    const repo = new PrismaDiscountRepository();
    await requestDiscount(repo, passenger.id, {
      discountType: formData.get("discountType"),
      credentialPhotoPath: savedRelativePath,
    });

    revalidatePath("/pasajero/descuento");
    revalidatePath("/admin/descuentos");
    return {
      status: "success",
      message: "Tu solicitud de descuento fue enviada y está en revisión.",
    };
  } catch (error) {
    if (savedRelativePath) {
      await deletePrivateCredentialFile(savedRelativePath);
    }
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Ocurrió un problema al enviar tu solicitud. Intenta nuevamente.",
    };
  }
}
