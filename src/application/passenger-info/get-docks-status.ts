import { type Clock, systemClock } from "@/application/shared/ports";
import { estimateArrival, estimateDeparture } from "@/domain/passenger-info/eta";

import type {
  ActiveBoardingDepartureRow,
  ActiveInboundDepartureRow,
  BoardingDepartureStatusCode,
  PassengerInfoRepository,
  VesselKindCode,
} from "./ports";

export interface BoardingVesselView {
  departureId: string;
  status: BoardingDepartureStatusCode;
  vesselName: string;
  vesselKind: VesselKindCode;
  vesselColor: string | null;
  vesselPhotoUrl: string | null;
  passengerCapacity: number;
  occupiedSeats: number;
  driverName: string | null;
  estimatedDepartureLabel: string;
  estimatedDepartureIso: string | null;
}

export interface InboundVesselView {
  departureId: string;
  originDockName: string;
  vesselName: string;
  vesselKind: VesselKindCode;
  vesselColor: string | null;
  vesselPhotoUrl: string | null;
  estimatedArrivalLabel: string;
  estimatedArrivalIso: string | null;
}

export interface DockStatusView {
  dockId: string;
  dockCode: string;
  dockName: string;
  boarding: BoardingVesselView[];
  inbound: InboundVesselView[];
}

export interface DocksStatusResult {
  updatedAtIso: string;
  crossingMinutes: number;
  docks: DockStatusView[];
}

export interface GetDocksStatusDeps {
  repo: PassengerInfoRepository;
  clock?: Clock;
}

function toBoardingVesselView(row: ActiveBoardingDepartureRow, now: Date): BoardingVesselView {
  if (row.status === "BOARDING_CLOSED") {
    return {
      departureId: row.id,
      status: row.status,
      vesselName: row.vesselName,
      vesselKind: row.vesselKind,
      vesselColor: row.vesselColor,
      vesselPhotoUrl: row.vesselPhotoUrl,
      passengerCapacity: row.passengerCapacity,
      occupiedSeats: row.occupiedSeats,
      driverName: row.driverName,
      estimatedDepartureLabel: "Abordaje cerrado · por salir",
      estimatedDepartureIso: null,
    };
  }

  const eta = estimateDeparture(
    row.passengerCapacity,
    row.occupiedSeats,
    row.boardingStartedAt,
    now,
  );

  return {
    departureId: row.id,
    status: row.status,
    vesselName: row.vesselName,
    vesselKind: row.vesselKind,
    vesselColor: row.vesselColor,
    vesselPhotoUrl: row.vesselPhotoUrl,
    passengerCapacity: row.passengerCapacity,
    occupiedSeats: row.occupiedSeats,
    driverName: row.driverName,
    estimatedDepartureLabel: eta.label,
    estimatedDepartureIso: eta.estimatedAt ? eta.estimatedAt.toISOString() : null,
  };
}

function toInboundVesselView(
  row: ActiveInboundDepartureRow,
  crossingMinutes: number,
  now: Date,
): InboundVesselView {
  const eta = estimateArrival(row.departedAt, crossingMinutes, now);

  return {
    departureId: row.id,
    originDockName: row.originDockName,
    vesselName: row.vesselName,
    vesselKind: row.vesselKind,
    vesselColor: row.vesselColor,
    vesselPhotoUrl: row.vesselPhotoUrl,
    estimatedArrivalLabel: eta.label,
    estimatedArrivalIso: eta.estimatedAt ? eta.estimatedAt.toISOString() : null,
  };
}

export function createGetDocksStatus(deps: GetDocksStatusDeps) {
  const clock = deps.clock ?? systemClock;

  return async function getDocksStatus(): Promise<DocksStatusResult> {
    const now = clock.now();
    const snapshot = await deps.repo.getDocksLiveSnapshot();

    const docks: DockStatusView[] = snapshot.docks.map((dock) => {
      const dockBoardingRows = snapshot.boardingDepartures.filter(
        (d) => d.originDockId === dock.id,
      );

      const boardingByKind = (["BOAT", "FERRY"] as const)
        .map((kind) => dockBoardingRows.find((d) => d.vesselKind === kind))
        .filter((row): row is ActiveBoardingDepartureRow => Boolean(row))
        .map((row) => toBoardingVesselView(row, now));

      const inbound = snapshot.inboundDepartures
        .filter((d) => d.destinationDockId === dock.id)
        .sort((a, b) => {
          const aTime = a.departedAt ? a.departedAt.getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.departedAt ? b.departedAt.getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        })
        .map((row) => toInboundVesselView(row, snapshot.crossingMinutes, now));

      return {
        dockId: dock.id,
        dockCode: dock.code,
        dockName: dock.name,
        boarding: boardingByKind,
        inbound,
      };
    });

    return {
      updatedAtIso: now.toISOString(),
      crossingMinutes: snapshot.crossingMinutes,
      docks,
    };
  };
}
