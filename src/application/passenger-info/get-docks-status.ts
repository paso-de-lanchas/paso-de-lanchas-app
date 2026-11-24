import { type Clock, systemClock } from "@/application/shared/ports";
import { estimateArrival, estimateDeparture } from "@/domain/passenger-info/eta";

import type {
  ActiveBoardingDepartureRow,
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
  inbound: InboundVesselView | null;
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

      const inboundRow =
        snapshot.inboundDepartures.find((d) => d.destinationDockId === dock.id) ?? null;

      let inbound: InboundVesselView | null = null;
      if (inboundRow) {
        const eta = estimateArrival(inboundRow.departedAt, snapshot.crossingMinutes, now);
        inbound = {
          departureId: inboundRow.id,
          originDockName: inboundRow.originDockName,
          vesselName: inboundRow.vesselName,
          vesselKind: inboundRow.vesselKind,
          vesselColor: inboundRow.vesselColor,
          vesselPhotoUrl: inboundRow.vesselPhotoUrl,
          estimatedArrivalLabel: eta.label,
          estimatedArrivalIso: eta.estimatedAt ? eta.estimatedAt.toISOString() : null,
        };
      }

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
