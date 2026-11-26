import { DomainError } from "@/domain/shared/domain-error";
import { validateVesselRules } from "@/domain/fleet/vessel";
import type { AuditLogger } from "@/application/shared/ports";
import { vesselFormSchema, type VesselFormInput } from "./vessel-input";
import type { VesselDetail, VesselRepository } from "./vessel-ports";

export function createUpdateVessel(repo: VesselRepository, auditLogger?: AuditLogger) {
  return async function updateVessel(
    id: string,
    rawInput: VesselFormInput,
    actorUserId: string | null = null,
  ): Promise<VesselDetail> {
    const cleanId = id.trim();
    if (!cleanId) {
      throw new DomainError(
        "INVALID_VESSEL_ID",
        "El identificador de la embarcación es obligatorio.",
      );
    }

    const existing = await repo.findById(cleanId);
    if (!existing) {
      throw new DomainError("VESSEL_NOT_FOUND", `No se encontró la embarcación con id ${cleanId}.`);
    }

    const parsed = vesselFormSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_VESSEL_INPUT",
        parsed.error.issues[0]?.message ?? "Datos de embarcación inválidos.",
      );
    }

    const valid = validateVesselRules({
      code: parsed.data.code,
      name: parsed.data.name,
      kind: parsed.data.kind,
      registration: parsed.data.registration,
      passengerCapacity: parsed.data.passengerCapacity,
      vehicleCapacities: parsed.data.vehicleCapacities,
    });

    const color = parsed.data.color?.trim() ? parsed.data.color.trim() : null;
    const photoUrl = parsed.data.photoUrl?.trim() ? parsed.data.photoUrl.trim() : null;

    const updated = await repo.update({
      id: existing.id,
      ...valid,
      color,
      photoUrl,
    });

    if (auditLogger) {
      await auditLogger.log({
        userId: actorUserId,
        action: "VESSEL_UPDATED",
        entity: "vessels",
        entityId: updated.id,
        details: {
          before: {
            code: existing.code,
            name: existing.name,
            kind: existing.kind,
            registration: existing.registration,
            passengerCapacity: existing.passengerCapacity,
          },
          after: {
            code: updated.code,
            name: updated.name,
            kind: updated.kind,
            registration: updated.registration,
            passengerCapacity: updated.passengerCapacity,
          },
        },
      });
    }

    return updated;
  };
}
