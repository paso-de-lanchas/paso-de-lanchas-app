import { type Clock, systemClock } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import type {
  ActiveVehicleType,
  VehicleFareProvider,
  VehicleRepository,
  VehicleWithFare,
} from "./ports";

export interface ListMyVehiclesDeps {
  vehicles: VehicleRepository;
  fares: VehicleFareProvider;
  clock?: Clock;
}

export function createListMyVehicles(deps: ListMyVehiclesDeps) {
  const clock = deps.clock ?? systemClock;

  return async function listMyVehicles(ownerId: string): Promise<VehicleWithFare[]> {
    const now = clock.now();
    const [records, faresMap] = await Promise.all([
      deps.vehicles.listByOwner(ownerId),
      deps.fares.getCurrentVehicleFaresCents(now),
    ]);

    return records.map((record) => {
      const fareCents = faresMap.get(record.vehicleTypeId) ?? null;
      return {
        ...record,
        fareCents,
        formattedFare: fareCents !== null ? Money.fromCents(fareCents).format() : null,
      };
    });
  };
}

export interface GetMyVehicleDeps {
  vehicles: VehicleRepository;
  fares: VehicleFareProvider;
  clock?: Clock;
}

export function createGetMyVehicle(deps: GetMyVehicleDeps) {
  const clock = deps.clock ?? systemClock;

  return async function getMyVehicle(ownerId: string, vehicleId: string): Promise<VehicleWithFare> {
    const record = await deps.vehicles.findByIdAndOwner(vehicleId, ownerId);
    if (!record) {
      throw new DomainError("VEHICLE_NOT_FOUND", "No encontrado");
    }

    const faresMap = await deps.fares.getCurrentVehicleFaresCents(clock.now());
    const fareCents = faresMap.get(record.vehicleTypeId) ?? null;

    return {
      ...record,
      fareCents,
      formattedFare: fareCents !== null ? Money.fromCents(fareCents).format() : null,
    };
  };
}

export function createListActiveVehicleTypes(deps: { vehicles: VehicleRepository }) {
  return async function listActiveVehicleTypes(): Promise<ActiveVehicleType[]> {
    return deps.vehicles.findActiveTypes();
  };
}
