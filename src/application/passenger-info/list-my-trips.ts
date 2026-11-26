import { z } from "zod";

import { Money } from "@/domain/shared/money";

import type {
  BoardingStatusCode,
  FareCategoryCode,
  PassengerInfoRepository,
  VesselKindCode,
} from "./ports";

export const TRIPS_PAGE_SIZE = 10;

export const tripsPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export interface PassengerTripView {
  id: string;
  createdAtIso: string;
  originDockName: string;
  destinationDockName: string;
  vesselName: string;
  vesselKind: VesselKindCode;
  seatNumber: number;
  fareCategory: FareCategoryCode;
  vehiclePlate: string | null;
  amountChargedCents: number;
  formattedAmount: string;
  status: BoardingStatusCode;
}

export interface MyTripsListResult {
  items: PassengerTripView[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ListMyTripsDeps {
  repo: PassengerInfoRepository;
  pageSize?: number;
}

export function createListMyTrips(deps: ListMyTripsDeps) {
  const pageSize = deps.pageSize ?? TRIPS_PAGE_SIZE;

  return async function listMyTrips(
    passengerId: string,
    rawPage: unknown = 1,
  ): Promise<MyTripsListResult> {
    const parsed = tripsPageSchema.safeParse({ page: rawPage });
    const page = parsed.success ? parsed.data.page : 1;

    const { rows, totalItems } = await deps.repo.listPassengerTrips(passengerId, page, pageSize);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      items: rows.map((row) => ({
        id: row.id,
        createdAtIso: row.createdAt.toISOString(),
        originDockName: row.originDockName,
        destinationDockName: row.destinationDockName,
        vesselName: row.vesselName,
        vesselKind: row.vesselKind,
        seatNumber: row.seatNumber,
        fareCategory: row.fareCategory,
        vehiclePlate: row.vehiclePlate,
        amountChargedCents: row.amountChargedCents,
        formattedAmount: Money.fromCents(row.amountChargedCents).format(),
        status: row.status,
      })),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  };
}
