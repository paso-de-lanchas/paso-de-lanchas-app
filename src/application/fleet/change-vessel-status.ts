import { z } from "zod";
import { DomainError } from "@/domain/shared/domain-error";
import { transitionVesselStatus, VESSEL_STATUSES } from "@/domain/fleet/vessel-status";
import type {
  ChangeVesselStatusInput,
  VesselStatusHistoryEntry,
  VesselStatusRepository,
} from "./ports";

export const changeVesselStatusSchema = z.object({
  vesselId: z.string().trim().min(1, "El identificador de la embarcación es obligatorio."),
  toStatus: z.enum(VESSEL_STATUSES),
  reason: z
    .string()
    .trim()
    .min(3, "El motivo del cambio de estado es obligatorio.")
    .max(500, "El motivo no puede exceder 500 caracteres."),
  changedById: z.string().trim().min(1, "El usuario que realiza el cambio es obligatorio."),
});

export class VesselNotFoundError extends DomainError {
  constructor(vesselId: string) {
    super("VESSEL_NOT_FOUND", `No se encontró la embarcación con id ${vesselId}.`);
    this.name = "VesselNotFoundError";
  }
}

export function createChangeVesselStatus(repo: VesselStatusRepository) {
  return async function changeVesselStatus(
    rawInput: ChangeVesselStatusInput,
  ): Promise<VesselStatusHistoryEntry> {
    const parsed = changeVesselStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new DomainError(
        "INVALID_VESSEL_STATUS_INPUT",
        firstIssue?.message ?? "Datos inválidos para cambiar el estado.",
      );
    }

    const input = parsed.data;
    const vessel = await repo.findVesselById(input.vesselId);
    if (!vessel) {
      throw new VesselNotFoundError(input.vesselId);
    }

    const nextStatus = transitionVesselStatus(vessel.status, input.toStatus);

    return repo.changeStatusWithHistory({
      vesselId: vessel.id,
      fromStatus: vessel.status,
      toStatus: nextStatus,
      reason: input.reason,
      changedById: input.changedById,
    });
  };
}
