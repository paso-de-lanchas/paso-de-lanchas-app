"use server";

import { revalidatePath } from "next/cache";

import { reviewDiscount } from "@/application/account/review-discount";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaDiscountRepository } from "@/infrastructure/account/prisma-discount-repository";
import { assertRole } from "@/lib/auth/require-role";

export interface ReviewDiscountActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function reviewDiscountAction(
  _prevState: ReviewDiscountActionState,
  formData: FormData,
): Promise<ReviewDiscountActionState> {
  const admin = await assertRole("ADMIN");

  const decision = formData.get("decision");
  const requestId = formData.get("requestId");

  try {
    const repo = new PrismaDiscountRepository();
    if (decision === "APPROVE") {
      await reviewDiscount(repo, admin.id, {
        requestId,
        decision: "APPROVE",
        validUntil: formData.get("validUntil"),
      });
    } else {
      await reviewDiscount(repo, admin.id, {
        requestId,
        decision: "REJECT",
        rejectionReason: formData.get("rejectionReason"),
      });
    }

    revalidatePath("/admin/descuentos");
    revalidatePath("/pasajero/descuento");
    return {
      status: "success",
      message: decision === "APPROVE" ? "Solicitud aprobada." : "Solicitud rechazada.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Error al procesar la revisión." };
  }
}
