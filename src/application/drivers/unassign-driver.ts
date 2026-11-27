import { DomainError } from "@/domain/shared/domain-error";
import { unassignDriver } from "@/domain/drivers/driver-assignment";
import { systemClock, type Clock } from "@/application/shared/ports";
import type { DriverAssignmentRepository, DriverAssignmentRecord } from "./ports";

export interface UnassignDriverInput {
  assignmentId: string;
}

export function createUnassignDriver(
  repository: DriverAssignmentRepository,
  clock: Clock = systemClock,
) {
  return async function execute(input: UnassignDriverInput): Promise<DriverAssignmentRecord> {
    const existing = await repository.findAssignmentById(input.assignmentId);
    if (!existing) {
      throw new DomainError("ASSIGNMENT_NOT_FOUND", "La asignación de chofer no existe.");
    }

    const updated = unassignDriver(existing, clock.now());
    return repository.updateUnassignedAt(existing.id, updated.unassignedAt!);
  };
}
