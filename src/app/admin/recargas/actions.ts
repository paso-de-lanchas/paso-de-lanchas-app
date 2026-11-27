"use server";

import { revalidatePath } from "next/cache";

import { createAdjustBalance } from "@/application/wallet/adjust-balance";
import { createSearchPassenger } from "@/application/wallet/search-passenger";
import { createTopUpCash } from "@/application/wallet/top-up-cash";
import type { PassengerWalletSummary } from "@/application/wallet/ports";
import { DomainError } from "@/domain/shared/domain-error";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";
import { getCurrentSessionDeviceId } from "@/lib/auth/auth";
import { assertRole } from "@/lib/auth/require-role";

export interface WalletActionState {
  status: "idle" | "success" | "error";
  message?: string;
  transactionId?: string;
  balanceAfterCents?: number;
}

export interface PassengerSearchActionState extends WalletActionState {
  passenger?: PassengerWalletSummary;
}

function toActionError(error: unknown): WalletActionState {
  if (error instanceof DomainError) {
    return { status: "error", message: error.message };
  }
  throw error;
}

export async function searchPassengerAction(
  _previousState: PassengerSearchActionState,
  formData: FormData,
): Promise<PassengerSearchActionState> {
  await assertRole("ADMIN");
  try {
    const repo = new PrismaWalletRepository();
    const passenger = await createSearchPassenger(repo)({
      contact: formData.get("contact"),
    });
    if (!passenger) {
      return {
        status: "error",
        message: "No se encontró un pasajero activo con ese correo o celular.",
      };
    }
    return { status: "success", passenger };
  } catch (error) {
    return toActionError(error);
  }
}

export async function topUpCashAction(
  _previousState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const admin = await assertRole("ADMIN");
  try {
    const deviceId = await getCurrentSessionDeviceId(admin.id);
    if (!deviceId) {
      throw new DomainError(
        "AUTHORIZED_DEVICE_REQUIRED",
        "Inicia sesión desde una computadora autorizada para registrar recargas.",
      );
    }
    const repo = new PrismaWalletRepository();
    const transaction = await createTopUpCash({ repo })(
      {
        passengerId: formData.get("passengerId"),
        amount: formData.get("amount"),
      },
      { adminId: admin.id, deviceId },
    );
    revalidatePath("/admin/recargas");
    revalidatePath("/pasajero/saldo");
    return {
      status: "success",
      message: "Recarga aplicada correctamente.",
      transactionId: transaction.id,
      balanceAfterCents: transaction.balanceAfterCents,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function adjustBalanceAction(
  _previousState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> {
  const admin = await assertRole("ADMIN");
  try {
    const transaction = await createAdjustBalance({
      repo: new PrismaWalletRepository(),
    })(
      {
        passengerId: formData.get("passengerId"),
        type: formData.get("type"),
        direction: formData.get("direction"),
        amount: formData.get("amount"),
        reason: formData.get("reason"),
      },
      admin.id,
    );
    revalidatePath("/admin/recargas");
    revalidatePath("/pasajero/saldo");
    return {
      status: "success",
      message: "Movimiento aplicado correctamente.",
      transactionId: transaction.id,
      balanceAfterCents: transaction.balanceAfterCents,
    };
  } catch (error) {
    return toActionError(error);
  }
}
