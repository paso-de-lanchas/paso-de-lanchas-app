import { z } from "zod";

import { createFare } from "@/domain/fares/fare";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import type { AuditLogger, Clock } from "../shared/ports";
import type { FareRepository } from "./ports";

const setFareInputSchema = z
  .object({
    vesselKind: z.enum(["BOAT", "FERRY"]),
    category: z.enum(["GENERAL", "STUDENT", "INAPAM", "PEDESTRIAN", "VEHICLE"]),
    vehicleTypeId: z.number().int().positive().nullable(),
    amount: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/, "Escribe un monto válido con hasta dos decimales."),
  })
  .superRefine((input, context) => {
    const boatCategory = ["GENERAL", "STUDENT", "INAPAM"].includes(input.category);
    if (
      (input.vesselKind === "BOAT" && !boatCategory) ||
      (input.vesselKind === "FERRY" && boatCategory)
    ) {
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: "La categoría no corresponde a esta embarcación.",
      });
    }
    if ((input.category === "VEHICLE") !== (input.vehicleTypeId !== null)) {
      context.addIssue({
        code: "custom",
        path: ["vehicleTypeId"],
        message: "Selecciona un tipo de vehículo solo para esta tarifa.",
      });
    }
  });

export interface SetFareDeps {
  fares: FareRepository;
  audit: AuditLogger;
  clock: Clock;
}

export function createSetFare(deps: SetFareDeps) {
  return async function setFare(input: unknown, createdById: string) {
    const parsed = setFareInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_FARE",
        parsed.error.issues[0]?.message ?? "Revisa los datos de la tarifa.",
      );
    }

    const fare = createFare({
      vesselKind: parsed.data.vesselKind,
      category: parsed.data.category,
      vehicleTypeId: parsed.data.vehicleTypeId,
      amount: Money.fromPesos(parsed.data.amount),
      validFrom: deps.clock.now(),
      validTo: null,
      createdById,
    });
    const savedFare = await deps.fares.replaceCurrentFare(fare);

    await deps.audit.log({
      userId: createdById,
      action: "FARE_UPDATED",
      entity: "fare",
      entityId: savedFare.id,
      details: {
        vesselKind: savedFare.vesselKind,
        category: savedFare.category,
        vehicleTypeId: savedFare.vehicleTypeId,
        amount: savedFare.amount.toDecimalString(),
        validFrom: savedFare.validFrom.toISOString(),
      },
    });

    return savedFare;
  };
}
