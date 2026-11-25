import { systemClock } from "@/application/shared/ports";
import { createListMyVehicles } from "@/application/vehicles/list-my-vehicles";
import { PrismaVehicleFareProvider } from "@/infrastructure/vehicles/prisma-vehicle-fare-provider";
import { PrismaVehicleRepository } from "@/infrastructure/vehicles/prisma-vehicle-repository";
import { requireApiRole } from "@/lib/auth/require-role";

export async function GET() {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) {
    return auth.response;
  }

  const vehicleRepo = new PrismaVehicleRepository();
  const fareProvider = new PrismaVehicleFareProvider();
  const listMyVehicles = createListMyVehicles({
    vehicles: vehicleRepo,
    fares: fareProvider,
    clock: systemClock,
  });

  const vehicles = await listMyVehicles(auth.user.id);

  return Response.json(
    {
      vehicles: vehicles.map((v) => ({
        id: v.id,
        vehicleTypeId: v.vehicleTypeId,
        vehicleTypeName: v.vehicleTypeName,
        brand: v.brand,
        model: v.model,
        color: v.color,
        plate: v.plate,
        photoUrl: v.photoUrl,
        fareCents: v.fareCents,
        formattedFare: v.formattedFare,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
