import { assertDepartureTransition } from "@/domain/departures/departure-state";
import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";

export interface CreateReturnDepartureInput {
  departureId: string;
  actorUserId: string;
  actorDockId?: string | null;
}

export interface CreateReturnDepartureResult {
  finishedDeparture: DepartureRecord;
  returnDeparture: DepartureRecord;
}

export function createReturnDeparture(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger: AuditLogger,
) {
  return async function returnDepartureUseCase(
    input: CreateReturnDepartureInput,
  ): Promise<CreateReturnDepartureResult> {
    const departureId = input.departureId.trim();
    if (!departureId) {
      throw new DomainError(
        "INVALID_DEPARTURE_ID",
        "El identificador de la salida es obligatorio.",
      );
    }

    const current = await repo.findDepartureById(departureId);
    if (!current) {
      throw new DomainError("DEPARTURE_NOT_FOUND", "No se encontró la salida indicada.");
    }

    if (
      !input.actorDockId ||
      (input.actorDockId !== current.destinationDockId &&
        input.actorDockId !== current.originDockId)
    ) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y operar únicamente desde tu muelle.",
      );
    }

    assertDepartureTransition(current.status, "FINISHED");

    const now = clock.now();
    const returnOriginDockId = current.destinationDockId;
    const returnDestinationDockId = current.originDockId;
    const uow = repo.unitOfWork;

    const result = await uow.run(async (tx) => {
      const destDepartures = await repo.listDeparturesByDock(returnOriginDockId);
      const maxQueuePos = destDepartures
        .filter((d) => d.status === "QUEUED" && d.queuePosition !== null)
        .reduce((max, d) => Math.max(max, d.queuePosition ?? 0), 0);

      const finishedDeparture = await uow.markDepartureFinished(tx, {
        departureId: current.id,
        finishedAt: now,
        actorUserId: input.actorUserId,
      });

      const returnDeparture = await uow.createReturnQueuedDeparture(tx, {
        vesselId: current.vesselId,
        driverId: current.driverId,
        originDockId: returnOriginDockId,
        destinationDockId: returnDestinationDockId,
        status: "QUEUED",
        queuePosition: maxQueuePos + 1,
        passengerCapacity: current.passengerCapacity,
        returnOfId: current.id,
        boardingStartedAt: null,
        vehicleCapacities: current.vehicleCapacities.map((vc) => ({
          vehicleTypeId: vc.vehicleTypeId,
          capacity: vc.capacity,
        })),
      });

      return { finishedDeparture, returnDeparture };
    });

    await auditLogger.log({
      userId: input.actorUserId,
      action: "TRIP_FINISHED_RETURN_QUEUED",
      entity: "departures",
      entityId: result.returnDeparture.id,
      details: {
        finishedDepartureId: current.id,
        returnDepartureId: result.returnDeparture.id,
        originDockId: returnOriginDockId,
        destinationDockId: returnDestinationDockId,
        queuePosition: result.returnDeparture.queuePosition,
        finishedAt: now.toISOString(),
      },
    });

    return result;
  };
}
