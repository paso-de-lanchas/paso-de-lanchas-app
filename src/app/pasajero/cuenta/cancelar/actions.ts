"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createCancelAccount } from "@/application/account/cancel-account";
import { systemClock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaAccountCancellationRepository } from "@/infrastructure/account/prisma-account-cancellation-repository";
import { argon2PasswordHasher } from "@/infrastructure/auth/argon2-password-hasher";
import { assertRole } from "@/lib/auth/require-role";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

export interface CancelAccountActionState {
  status: "idle" | "error";
  message?: string;
}

export async function cancelAccountAction(
  _prevState: CancelAccountActionState,
  formData: FormData,
): Promise<CancelAccountActionState> {
  const sessionUser = await assertRole("PASSENGER");
  const repo = new PrismaAccountCancellationRepository();
  const cancelAccount = createCancelAccount({
    repo,
    passwordHasher: argon2PasswordHasher,
    clock: systemClock,
  });

  try {
    await cancelAccount(sessionUser.id, {
      currentPassword: formData.get("currentPassword"),
      confirmationWord: formData.get("confirmationWord"),
      acknowledgeBalanceLoss: formData.get("acknowledgeBalanceLoss") === "on",
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Ocurrió un problema al cancelar tu cuenta. Intenta de nuevo.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
