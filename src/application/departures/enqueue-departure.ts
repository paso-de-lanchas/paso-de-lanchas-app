import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { DepartureRecord, DepartureRepository } from "./ports";

const enqueueDepartureSchema = z.object({
  vesselId: z.string().trim().min(1),
  originDockId: z.string().trim().min(1),
  destinationDockId: z.string().trim().min(1),
  actorUserId: z.string().trim().min(1),
  actorDockId: z.string().trim().min(1).nullable().optional(),
});

export type EnqueueDepartureInput = z.infer<typeof enqueueDepartureSchema>;

export function createEnqueueDeparture(
  repo: DepartureRepository,
  clock: Clock,
  auditLogger: AuditLogger,
) {
  return async function enqueueDeparture(input: EnqueueDepartureInput): Promise<DepartureRecord> {
    const parsedResult = enqueueDepartureSchema.safeParse(input);
    if (!parsedResult.success) {
      throw new DomainError(
        "INVALID_DEPARTURE_INPUT",
        "Los datos de la salida son inválidos o incompletos.",
      );
    }
    const parsed = parsedResult.data;

    if (!parsed.actorDockId || parsed.actorDockId !== parsed.originDockId) {
      throw new DomainError(
        "DOCK_ACCESS_DENIED",
        "Debes tener un muelle asignado y operar únicamente desde tu muelle.",
      );
    }

    if (parsed.originDockId === parsed.destinationDockId) {
      throw new DomainError(
        "SAME_ORIGIN_DESTINATION_DOCK",
        "El muelle de origen y el muelle de destino deben ser distintos.",
      );
    }

    const [originDock, destDock] = await Promise.all([
      repo.findDockById(parsed.originDockId),
      repo.findDockById(parsed.destinationDockId),
    ]);

    if (!originDock || !destDock) {
      throw new DomainError("DOCK_NOT_FOUND", "No se encontró el muelle de origen o destino.");
    }

    const vessel = await repo.findEligibleVessel(parsed.vesselId);
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

    const activeElsewhere = await repo.findActiveDepartureByVessel(vessel.id);
    if (activeElsewhere) {
      throw new DomainError(
        "VESSEL_ALREADY_IN_OPERATION",
        "La embarcación ya tiene una salida activa o en fila en algún muelle.",
      );
    }

    const now = clock.now();

    const created = await repo.enqueueDepartureInTx({
      vesselId: vessel.id,
      driverId: vessel.activeDriverId,
      originDockId: parsed.originDockId,
      destinationDockId: parsed.destinationDockId,
      passengerCapacity: vessel.passengerCapacity,
      vehicleCapacities: vessel.kind === "FERRY" ? vessel.vehicleCapacities : [],
      startedAt: now,
    });

    await auditLogger.log({
      userId: parsed.actorUserId,
      action: "DEPARTURE_ENQUEUED",
      entity: "departures",
      entityId: created.id,
      details: {
        vesselId: vessel.id,
        driverId: vessel.activeDriverId,
        originDockId: parsed.originDockId,
        destinationDockId: parsed.destinationDockId,
        status: created.status,
        queuePosition: created.queuePosition,
        passengerCapacity: vessel.passengerCapacity,
        timestamp: now.toISOString(),
      },
    });

    if (created.status === "BOARDING") {
      await auditLogger.log({
        userId: parsed.actorUserId,
        action: "DEPARTURE_BOARDING_STARTED",
        entity: "departures",
        entityId: created.id,
        details: {
          dockId: parsed.originDockId,
          vesselId: created.vesselId,
          startedAt: now.toISOString(),
        },
      });
    }

    return created;
  };
}
