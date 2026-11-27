import { z } from "zod";

import { parseInput } from "@/application/shared/input-error";
import { systemClock, type AuditLogger, type Clock } from "@/application/shared/ports";
import { retryConcurrentUpdate } from "@/application/wallet/retry-concurrent-update";
import {
  assertEnoughBalance,
  assertSeatAvailable,
  assertVehicleSpace,
  BoardingError,
  isFullAfterBoarding,
  nextSeatNumber,
} from "@/domain/boarding/boarding";
import type { FareCategory } from "@/domain/fares/fare";
import { createFareStrategy } from "@/domain/fares/fare-strategy-factory";
import type { DiscountType } from "@/domain/account/discount";

import type { BoardingStore, BoardingVehicle, QrScanVerifier } from "./ports";

/** Lo que llega de la pantalla del admin (el lector "escribe" el QR en un campo). */
export const boardWithQrSchema = z
  .object({
    qr: z.string().trim().min(1, "Escanea el QR del pasajero.").max(200, "El QR no es válido."),
    mode: z.enum(["PEDESTRIAN", "VEHICLE"]).default("PEDESTRIAN"),
    vehicleId: z.string().uuid("Elige un vehículo válido.").optional(),
  })
  .refine((data) => data.mode === "VEHICLE" || data.vehicleId === undefined, {
    message: "Solo se elige vehículo al abordar con vehículo.",
    path: ["vehicleId"],
  });

/** Quién escanea: siempre sale de la sesión del servidor, nunca del formulario. */
export interface BoardingActor {
  adminId: string;
  dockId: string | null;
  deviceId: string | null;
}

export interface BoardingConfirmation {
  boardingId: string;
  saleId: string;
  passengerName: string;
  vesselName: string;
  destinationDockName: string;
  seatNumber: number;
  fareCategory: FareCategory;
  amountCents: number;
  balanceAfterCents: number;
  /** Si se cobró con descuento, para que el admin revise la credencial (RF-050). */
  discountType: DiscountType | null;
  vehicle: { plate: string; vehicleTypeName: string } | null;
  departureClosed: boolean;
}

export interface BoardWithQrDeps<Tx> {
  verifier: QrScanVerifier;
  store: BoardingStore<Tx>;
  auditLogger: AuditLogger;
  clock?: Clock;
}

const vehicleOption = (v: BoardingVehicle) => ({
  id: v.id,
  plate: v.plate,
  description: v.description,
  vehicleTypeName: v.vehicleTypeName,
});

/**
 * Escanear el QR: cobro y lugar en UNA sola transacción (RF-043 a RF-052).
 * El QR se verifica antes (rápido y sin bloquear); dentro de la transacción se bloquea la
 * salida, se revisa el cupo, se calcula la tarifa, se cobra y se crea el abordaje.
 * Si cualquier paso falla, no se aplica ninguno.
 */
export function createBoardWithQr<Tx>(deps: BoardWithQrDeps<Tx>) {
  const clock = deps.clock ?? systemClock;

  return async function boardWithQr(
    rawInput: unknown,
    actor: BoardingActor,
  ): Promise<BoardingConfirmation> {
    const dockId = actor.dockId;
    if (!dockId) {
      throw new BoardingError(
        "NO_DOCK_ASSIGNED",
        "Tu cuenta no tiene un muelle asignado; pide al superadministrador que te asigne uno.",
      );
    }
    const deviceId = actor.deviceId;
    if (!deviceId) {
      throw new BoardingError(
        "AUTHORIZED_DEVICE_REQUIRED",
        "Escanea desde una computadora autorizada del muelle.",
      );
    }

    const input = parseInput<"qr" | "mode" | "vehicleId", typeof boardWithQrSchema>(
      boardWithQrSchema,
      rawInput,
    );

    const scanned = await deps.verifier.verify(input.qr);
    if (!scanned) {
      await deps.auditLogger.log({
        userId: actor.adminId,
        deviceId,
        action: "BOARDING_QR_REJECTED",
        entity: "boardings",
        details: { dockId, reason: "INVALID_QR" },
      });
      throw new BoardingError(
        "QR_REJECTED",
        "QR no válido o vencido. Pide al pasajero que abra su QR de nuevo.",
      );
    }

    // Reintento solo si el saldo cambió al mismo tiempo (bloqueo optimista del monedero):
    // la transacción completa se repite desde cero, así que nunca hay cobro doble.
    return retryConcurrentUpdate(() =>
      deps.store.run(async (tx) => {
        const at = clock.now();

        const departure = await deps.store.lockBoardingDeparture(tx, dockId);
        if (!departure) {
          throw new BoardingError(
            "NO_DEPARTURE_BOARDING",
            "No hay ninguna embarcación abordando en este muelle.",
          );
        }
        assertSeatAvailable(departure);

        const passenger = await deps.store.findPassenger(tx, scanned.userId);
        if (!passenger || !passenger.active) {
          throw new BoardingError("PASSENGER_NOT_ACTIVE", "La cuenta del pasajero no está activa.");
        }

        if (await deps.store.hasActiveBoarding(tx, departure.id, passenger.id)) {
          throw new BoardingError(
            "ALREADY_BOARDED",
            `${passenger.fullName} ya abordó esta embarcación.`,
            { passengerName: passenger.fullName },
          );
        }

        let vehicle: BoardingVehicle | null = null;
        if (input.mode === "VEHICLE") {
          if (departure.vesselKind !== "FERRY") {
            throw new BoardingError(
              "VEHICLE_NOT_ALLOWED",
              "Esta embarcación es una lancha: solo lleva pasajeros sin vehículo.",
            );
          }
          const vehicles = await deps.store.listPassengerVehicles(tx, passenger.id);
          if (vehicles.length === 0) {
            throw new BoardingError(
              "VEHICLE_NOT_FOUND",
              `${passenger.fullName} no tiene vehículos registrados en su cuenta.`,
            );
          }
          if (!input.vehicleId) {
            throw new BoardingError(
              "VEHICLE_CHOICE_REQUIRED",
              `Elige con qué vehículo cruza ${passenger.fullName}.`,
              { passengerName: passenger.fullName, vehicles: vehicles.map(vehicleOption) },
            );
          }
          vehicle = vehicles.find((v) => v.id === input.vehicleId) ?? null;
          if (!vehicle) {
            throw new BoardingError(
              "VEHICLE_NOT_FOUND",
              "Ese vehículo no pertenece al pasajero o ya no está registrado.",
            );
          }
          assertVehicleSpace(
            await deps.store.getVehicleSpace(tx, departure.id, vehicle.vehicleTypeId),
            vehicle.vehicleTypeName,
          );
        }

        const fare = createFareStrategy(departure.vesselKind).resolve(
          { vehicleTypeId: vehicle?.vehicleTypeId ?? null, discount: passenger.discount },
          await deps.store.listFares(tx, departure.vesselKind, at),
          at,
        );

        const balance = await deps.store.getBalance(tx, passenger.id);
        if (!balance) {
          throw new BoardingError("PASSENGER_NOT_ACTIVE", "El pasajero no tiene monedero.");
        }
        assertEnoughBalance(balance, fare.amount);

        const seatNumber = nextSeatNumber(departure.highestSeat);
        const created = await deps.store.createBoarding(
          tx,
          {
            departureId: departure.id,
            passengerId: passenger.id,
            vehicleId: vehicle?.id ?? null,
            seatNumber,
            fareId: fare.fareId,
            fareCategory: fare.category,
            amount: fare.amount,
            qrCredentialId: scanned.credentialId,
            qrTimeStep: scanned.timeStep,
            registeredById: actor.adminId,
            deviceId,
            at,
          },
          {
            userId: actor.adminId,
            action: "BOARDING_QR",
            details: {
              departureId: departure.id,
              passengerId: passenger.id,
              seatNumber,
              fareId: fare.fareId,
              fareCategory: fare.category,
              amountCents: fare.amount.cents,
              vehicleId: vehicle?.id ?? null,
              dockId,
              deviceId,
            },
          },
        );

        const occupied = await deps.store.occupySeat(tx, {
          departureId: departure.id,
          vehicleTypeId: vehicle?.vehicleTypeId ?? null,
          closeWhenFull: isFullAfterBoarding(departure),
          at,
        });

        const discountType =
          fare.category === "STUDENT" || fare.category === "INAPAM" ? fare.category : null;

        return {
          boardingId: created.boardingId,
          saleId: created.saleId,
          passengerName: passenger.fullName,
          vesselName: departure.vesselName,
          destinationDockName: departure.destinationDockName,
          seatNumber,
          fareCategory: fare.category,
          amountCents: fare.amount.cents,
          balanceAfterCents: created.balanceAfter.cents,
          discountType,
          vehicle: vehicle
            ? { plate: vehicle.plate, vehicleTypeName: vehicle.vehicleTypeName }
            : null,
          departureClosed: occupied.departureClosed,
        };
      }),
    );
  };
}
