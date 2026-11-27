"use server";

import { revalidatePath } from "next/cache";

import { createBoardWithQr, type BoardingConfirmation } from "@/application/boarding/board-with-qr";
import { createCancelBoarding } from "@/application/boarding/cancel-boarding";
import { createSellTickets } from "@/application/boarding/sell-tickets";
import { InputError } from "@/application/shared/input-error";
import { BoardingError } from "@/domain/boarding/boarding";
import { DomainError } from "@/domain/shared/domain-error";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { PrismaBoardingStore } from "@/infrastructure/boarding/prisma-boarding-store";
import { cryptoTicketCodeGenerator } from "@/infrastructure/boarding/crypto-ticket-code-generator";
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

export interface TicketSaleConfirmation {
  saleId: string;
  departureId: string;
  vesselName: string;
  destinationDockName: string;
  totalCents: number;
  departureClosed: boolean;
  tickets: Array<{
    boardingId: string;
    seatNumber: number;
    ticketCode: string;
    fareCategory: string;
    amountCents: number;
  }>;
}

export type TicketSaleState =
  | { status: "idle" }
  | { status: "success"; confirmation: TicketSaleConfirmation }
  | { status: "error"; message: string };

export type CancelBoardingState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const boardWithQr = createBoardWithQr({
  verifier: createQrScanVerifier(),
  store: new PrismaBoardingStore(),
  auditLogger: prismaAuditLogger(prisma),
});
const store = new PrismaBoardingStore();
const sellTickets = createSellTickets({
  store,
  ticketCodes: cryptoTicketCodeGenerator,
});
const cancelBoarding = createCancelBoarding({ store });

function firstInputError(error: InputError): string {
  return Object.values(error.fieldErrors)[0] ?? error.message;
}

function ticketOfficeActor(adminId: string, dockId: string | null, deviceId: string | null) {
  return { adminId, dockId, deviceId };
}

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
      return { status: "error", code: error.code, message: firstInputError(error) };
    }
    if (error instanceof DomainError) {
      return { status: "error", code: error.code, message: error.message };
    }
    throw error;
  }
}

export async function sellTicketsAction(
  _previous: TicketSaleState,
  formData: FormData,
): Promise<TicketSaleState> {
  const admin = await assertRole("ADMIN");
  const post = await getCurrentStaffPost(admin.id);
  const tickets = formData.getAll("ticket").map((value) => {
    return { fareId: typeof value === "string" ? value : null };
  });

  try {
    const confirmation = await sellTickets(
      { tickets },
      ticketOfficeActor(admin.id, post.dockId, post.deviceId),
    );
    revalidatePath("/admin/taquilla");
    return { status: "success", confirmation };
  } catch (error) {
    if (error instanceof InputError || error instanceof DomainError) {
      return {
        status: "error",
        message: error instanceof InputError ? firstInputError(error) : error.message,
      };
    }
    throw error;
  }
}

export async function cancelBoardingAction(
  _previous: CancelBoardingState,
  formData: FormData,
): Promise<CancelBoardingState> {
  const admin = await assertRole("ADMIN");
  const post = await getCurrentStaffPost(admin.id);
  const input = {
    boardingId: formData.get("boardingId"),
    reason: formData.get("reason"),
  };

  try {
    await cancelBoarding(input, ticketOfficeActor(admin.id, post.dockId, post.deviceId));
    revalidatePath("/admin/taquilla");
    revalidatePath("/pasajero/saldo");
    return { status: "success", message: "Abordaje cancelado y devolución registrada." };
  } catch (error) {
    if (error instanceof InputError || error instanceof DomainError) {
      return {
        status: "error",
        message: error instanceof InputError ? firstInputError(error) : error.message,
      };
    }
    throw error;
  }
}
