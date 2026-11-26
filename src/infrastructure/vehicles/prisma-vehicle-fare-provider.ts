import type { VehicleFareProvider, VehicleFaresMap } from "@/application/vehicles/ports";
import { Money } from "@/domain/shared/money";
import { prisma } from "@/infrastructure/db/prisma";

export class PrismaVehicleFareProvider implements VehicleFareProvider {
  async getCurrentVehicleFaresCents(at: Date): Promise<VehicleFaresMap> {
    const rows = await prisma.fare.findMany({
      where: {
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: { not: null },
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
      },
      select: {
        vehicleTypeId: true,
        amount: true,
      },
      orderBy: { validFrom: "desc" },
    });

    const map: VehicleFaresMap = new Map();
    for (const row of rows) {
      if (row.vehicleTypeId !== null && !map.has(row.vehicleTypeId)) {
        map.set(row.vehicleTypeId, Money.fromPesos(row.amount).cents);
      }
    }
    return map;
  }
}
