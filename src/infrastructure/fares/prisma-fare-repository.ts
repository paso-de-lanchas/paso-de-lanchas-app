import type { FareRepository } from "@/application/fares/ports";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

const fareRelations = { vehicleType: { select: { name: true } } } as const;

function toFare(row: Prisma.FareGetPayload<{ include: typeof fareRelations }>) {
  return {
    id: row.id,
    vesselKind: row.vesselKind,
    category: row.category,
    vehicleTypeId: row.vehicleTypeId,
    vehicleTypeName: row.vehicleType?.name ?? null,
    amount: Money.fromPesos(row.amount),
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdById: row.createdById,
  };
}

function isFareOverlapError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    const record = current as Record<string, unknown>;
    const meta =
      typeof record.meta === "object" && record.meta !== null
        ? (record.meta as Record<string, unknown>)
        : null;
    const details = [record.message, record.database_error, meta?.database_error]
      .filter((value): value is string => typeof value === "string")
      .join(" ");

    if (record.code === "23P01" || meta?.code === "23P01" || details.includes("fares_no_overlap")) {
      return true;
    }
    current = record.cause ?? meta?.cause;
  }
  return false;
}

export function prismaFareRepository(db: PrismaClient): FareRepository {
  return {
    async replaceCurrentFare(fare) {
      try {
        const row = await db.$transaction(async (tx) => {
          if (fare.vehicleTypeId !== null) {
            const vehicleType = await tx.vehicleType.findFirst({
              where: { id: fare.vehicleTypeId, active: true },
              select: { id: true },
            });
            if (!vehicleType) {
              throw new DomainError(
                "INVALID_VEHICLE_TYPE",
                "El tipo de vehículo no existe o está inactivo.",
              );
            }
          }

          const key = {
            vesselKind: fare.vesselKind,
            category: fare.category,
            vehicleTypeId: fare.vehicleTypeId,
          };
          await tx.fare.updateMany({
            where: { ...key, validTo: null },
            data: { validTo: fare.validFrom },
          });
          return tx.fare.create({
            data: {
              vesselKind: fare.vesselKind,
              category: fare.category,
              vehicleTypeId: fare.vehicleTypeId,
              amount: fare.amount.toDecimalString(),
              validFrom: fare.validFrom,
              validTo: null,
              createdById: fare.createdById,
            },
            include: fareRelations,
          });
        });
        return toFare(row);
      } catch (error) {
        if (!isFareOverlapError(error)) throw error;
        throw new DomainError(
          "FARE_OVERLAP",
          "No se pudo registrar la tarifa porque se traslapa con otra vigente. Actualiza la página e inténtalo de nuevo.",
        );
      }
    },
    async listCurrentFares(at) {
      const rows = await db.fare.findMany({
        where: {
          validFrom: { lte: at },
          OR: [{ validTo: null }, { validTo: { gt: at } }],
        },
        include: fareRelations,
        orderBy: [{ vesselKind: "asc" }, { category: "asc" }, { vehicleTypeId: "asc" }],
      });
      return rows.map(toFare);
    },
    async listFareHistory() {
      const rows = await db.fare.findMany({
        include: fareRelations,
        orderBy: [{ validFrom: "desc" }, { vesselKind: "asc" }, { category: "asc" }],
      });
      return rows.map(toFare);
    },
    listVehicleTypes: () =>
      db.vehicleType.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
  };
}
