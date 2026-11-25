import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";
import { createStartNextBoarding } from "./start-next-boarding";

export interface EnqueueDepartureInput {
  vesselId: string;
  originDockId: string;
  destinationDockId: string;
  actorUserId: string;
  actorDockId?: string | null;
}

export function createEnqueueDeparture(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
  const startNextBoarding = createStartNextBoarding(repo, clock, auditLogger);

  return async function enqueueDeparture(input: EnqueueDepartureInput): Promise<DepartureRecord> {
    const vesselId = input.vesselId.trim();
    const originDockId = input.originDockId.trim();
    const destinationDockId = input.destinationDockId.trim();

    if (!vesselId || !originDockId || !destinationDockId) {
      throw new DomainError(
        "INVALID_DEPARTURE_INPUT",
        "La embarcación, el muelle de origen y el muelle de destino son obligatorios.",
      );
    }

    if (input.actorDockId && input.actorDockId !== originDockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Solo puedes operar salidas desde tu muelle asignado.",
      );
    }

    if (originDockId === destinationDockId) {
      throw new DomainError(
        "SAME_ORIGIN_DESTINATION_DOCK",
        "El muelle de origen y el muelle de destino deben ser distintos.",
      );
    }

    const [originDock, destDock] = await Promise.all([
      repo.findDockById(originDockId),
      repo.findDockById(destinationDockId),
    ]);

    if (!originDock || !destDock) {
      throw new DomainError("DOCK_NOT_FOUND", "No se encontró el muelle de origen o destino.");
    }

    if (repo.isServiceOpenAt) {
      const scheduleStatus = await repo.isServiceOpenAt(originDockId, clock.now());
      if (!scheduleStatus.open) {
        throw new DomainError(
          "SERVICE_CLOSED",
          scheduleStatus.reason ?? "El servicio del muelle está cerrado fuera de horario.",
        );
      }
    }

    const vessel = await repo.findEligibleVessel(vesselId);
    if (!vessel) {
      throw new DomainError("VESSEL_NOT_FOUND", "No se encontró la embarcación indicada.");
    }

    if (vessel.status !== "ACTIVE") {
      throw new DomainError(
        "VESSEL_NOT_ACTIVE",
        "Solo se pueden encolar embarcaciones con estado ACTIVA.",
      );
    }

    if (!vessel.activeDriverId) {
      throw new DomainError(
        "VESSEL_WITHOUT_DRIVER",
        "La embarcación debe tener un chofer asignado para formar la fila.",
      );
    }

    const existingDepartures = await repo.listDeparturesByDock(originDockId);
    const activeInDock = existingDepartures.filter(
      (d) =>
        d.vesselId === vessel.id &&
        (d.status === "QUEUED" ||
          d.status === "BOARDING" ||
          d.status === "BOARDING_CLOSED" ||
          d.status === "IN_TRANSIT"),
    );
    if (activeInDock.length > 0) {
      throw new DomainError(
        "VESSEL_ALREADY_IN_OPERATION",
        "La embarcación ya tiene una salida activa o en fila.",
      );
    }

    const queued = existingDepartures.filter((d) => d.status === "QUEUED");
    const nextPosition = queued.length + 1;
    const now = clock.now();

    const created = await repo.createDeparture({
      vesselId: vessel.id,
      driverId: vessel.activeDriverId,
      originDockId,
      destinationDockId,
      status: "QUEUED",
      queuePosition: nextPosition,
      passengerCapacity: vessel.passengerCapacity,
      boardingStartedAt: null,
      vehicleCapacities: vessel.kind === "FERRY" ? vessel.vehicleCapacities : [],
    });

    if (auditLogger) {
      await auditLogger.log({
        userId: input.actorUserId,
        action: "DEPARTURE_ENQUEUED",
        entity: "departures",
        entityId: created.id,
        details: {
          vesselId: vessel.id,
          driverId: vessel.activeDriverId,
          originDockId,
          destinationDockId,
          queuePosition: nextPosition,
          passengerCapacity: vessel.passengerCapacity,
          timestamp: now.toISOString(),
        },
      });
    }

    const started = await startNextBoarding(originDockId, input.actorUserId);
    if (started && started.id === created.id) {
      return started;
    }

    return created;
  };
}
