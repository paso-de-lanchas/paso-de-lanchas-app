"use server";

import { revalidatePath } from "next/cache";

import { createBoardWithQr, type BoardingConfirmation } from "@/application/boarding/board-with-qr";
import { InputError } from "@/application/shared/input-error";
import { BoardingError } from "@/domain/boarding/boarding";
import { DomainError } from "@/domain/shared/domain-error";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { PrismaBoardingStore } from "@/infrastructure/boarding/prisma-boarding-store";
import { createQrScanVerifier } from "@/infrastructure/boarding/qr-scan-verifier";
import { prisma } from "@/infrastructure/db/prisma";
import { getCurrentStaffPost } from "@/lib/auth/auth";
import { assertRole } from "@/lib/auth/require-role";

export interface VehicleChoice {
  id: string;
  plate: string;
  description: string;
  vehicleTypeName: string;
}

export type ScanState =
  | { status: "idle" }
  | { status: "success"; confirmation: BoardingConfirmation }
  | {
      status: "error";
      code: string;
      message: string;
      shortfallCents?: number;
      /** Para elegir el vehículo y reintentar con el mismo QR (sigue vigente unos segundos). */
      vehicleChoice?: { qr: string; passengerName: string; vehicles: VehicleChoice[] };
    };

const boardWithQr = createBoardWithQr({
  verifier: createQrScanVerifier(),
  store: new PrismaBoardingStore(),
  auditLogger: prismaAuditLogger(prisma),
});

/** Escaneo del QR (RF-043 a RF-052). El muelle y la computadora salen de la sesión. */
export async function scanQrAction(_previous: ScanState, formData: FormData): Promise<ScanState> {
  const admin = await assertRole("ADMIN");
  const post = await getCurrentStaffPost(admin.id);
  const qr = formData.get("qr");
  const vehicleId = formData.get("vehicleId");

  try {
    const confirmation = await boardWithQr(
      {
        qr,
        mode: formData.get("mode") ?? undefined,
        vehicleId: typeof vehicleId === "string" && vehicleId !== "" ? vehicleId : undefined,
      },
      { adminId: admin.id, dockId: post.dockId, deviceId: post.deviceId },
    );
    revalidatePath("/admin/taquilla");
    return { status: "success", confirmation };
  } catch (error) {
    if (error instanceof BoardingError) {
      const state: ScanState = { status: "error", code: error.code, message: error.message };
      if (error.code === "INSUFFICIENT_BALANCE") {
        state.shortfallCents = Number(error.details.shortfallCents);
      }
      if (error.code === "VEHICLE_CHOICE_REQUIRED" && typeof qr === "string") {
        state.vehicleChoice = {
          qr,
          passengerName: String(error.details.passengerName ?? ""),
          vehicles: (error.details.vehicles as VehicleChoice[]) ?? [],
        };
      }
      return state;
    }
    if (error instanceof InputError) {
      const first = Object.values(error.fieldErrors)[0];
      return { status: "error", code: error.code, message: first ?? error.message };
    }
    if (error instanceof DomainError) {
      return { status: "error", code: error.code, message: error.message };
    }
    throw error;
  }
}
