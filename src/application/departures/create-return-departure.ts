import { assertDepartureTransition } from "@/domain/departures/departure-state";
import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { CreateDepartureData, DepartureRecord, DepartureRepository } from "./ports";

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
  auditLogger?: AuditLogger,
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
      input.actorDockId &&
      input.actorDockId !== current.destinationDockId &&
      input.actorDockId !== current.originDockId
    ) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "No tienes permisos para finalizar este viaje en tu muelle.",
      );
    }

    assertDepartureTransition(current.status, "FINISHED");

    const now = clock.now();
    const returnOriginDockId = current.destinationDockId;
    const returnDestinationDockId = current.originDockId;

    const executeWork = async (
      tx: unknown,
      markFinished: (
        t: unknown,
        params: { departureId: string; finishedAt: Date; actorUserId: string },
      ) => Promise<DepartureRecord>,
      createQueuedReturn: (t: unknown, data: CreateDepartureData) => Promise<DepartureRecord>,
      getDestinationDepartures: (dockId: string) => Promise<DepartureRecord[]>,
    ): Promise<CreateReturnDepartureResult> => {
      const destDepartures = await getDestinationDepartures(returnOriginDockId);
      const maxQueuePos = destDepartures
        .filter((d) => d.status === "QUEUED" && d.queuePosition !== null)
        .reduce((max, d) => Math.max(max, d.queuePosition ?? 0), 0);

      const finishedDeparture = await markFinished(tx, {
        departureId: current.id,
        finishedAt: now,
        actorUserId: input.actorUserId,
      });

      const returnDeparture = await createQueuedReturn(tx, {
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
    };

    const result = repo.unitOfWork
      ? await repo.unitOfWork.run((tx) =>
          executeWork(
            tx,
            repo.unitOfWork!.markDepartureFinished.bind(repo.unitOfWork),
            repo.unitOfWork!.createReturnQueuedDeparture.bind(repo.unitOfWork),
            (dockId) => repo.listDeparturesByDock(dockId),
          ),
        )
      : await executeWork(
          null,
          async (_t, params) =>
            repo.updateDepartureStatus({
              departureId: params.departureId,
              fromStatus: current.status,
              toStatus: "FINISHED",
              queuePosition: null,
            }),
          (_t, data) => repo.createDeparture(data),
          (dockId) => repo.listDeparturesByDock(dockId),
        );

    if (auditLogger) {
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
    }

    return result;
  };
}

export const createFinishTrip = createReturnDeparture;
