import { systemClock, type Clock } from "@/application/shared/ports";
import type { VesselKind } from "@/domain/fares/fare";
import {
  ageLabel,
  estimateArrivalFromPosition,
  isStale,
  isValidPoint,
  type ArrivalEstimate,
} from "@/domain/map/live-position";

export interface MapDock {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface InTransitDeparture {
  departureId: string;
  vesselName: string;
  vesselKind: VesselKind;
  originDockId: string;
  destinationDockId: string;
  departedAt: Date | null;
  occupiedSeats: number;
  passengerCapacity: number;
  lastLocation: {
    latitude: number;
    longitude: number;
    speedKmh: number | null;
    heading: number | null;
    recordedAt: Date;
  } | null;
}

export interface LiveMapRepository {
  listDocks(): Promise<MapDock[]>;
  /** Salidas "En tránsito" con su ÚLTIMA ubicación (sin datos personales). */
  listInTransit(): Promise<InTransitDeparture[]>;
  getCrossingMinutes(): Promise<number>;
}

export interface LiveVessel {
  departureId: string;
  vesselName: string;
  vesselKind: VesselKind;
  originDockName: string;
  destinationDockName: string;
  occupiedSeats: number;
  passengerCapacity: number;
  position: { latitude: number; longitude: number; heading: number | null } | null;
  /** Sin ubicación reciente: se muestra "Última ubicación hace…" (RF-080). */
  stale: boolean;
  lastUpdateLabel: string | null;
  arrival: ArrivalEstimate;
}

export interface LiveMap {
  docks: MapDock[];
  vessels: LiveVessel[];
  generatedAt: string;
}

/** Mapa en vivo: muelles y embarcaciones en tránsito con su llegada estimada (RF-077 a RF-081). */
export function createGetLiveMap(deps: { repo: LiveMapRepository; clock?: Clock }) {
  const clock = deps.clock ?? systemClock;

  return async function getLiveMap(): Promise<LiveMap> {
    const [docks, departures, crossingMinutes] = await Promise.all([
      deps.repo.listDocks(),
      deps.repo.listInTransit(),
      deps.repo.getCrossingMinutes(),
    ]);
    const now = clock.now();
    const dockById = new Map(docks.map((dock) => [dock.id, dock]));

    const vessels = departures.map((d): LiveVessel => {
      const destination = dockById.get(d.destinationDockId);
      const location = d.lastLocation && isValidPoint(d.lastLocation) ? d.lastLocation : null;
      const stale = !location || isStale(location.recordedAt, now);
      return {
        departureId: d.departureId,
        vesselName: d.vesselName,
        vesselKind: d.vesselKind,
        originDockName: dockById.get(d.originDockId)?.name ?? "—",
        destinationDockName: destination?.name ?? "—",
        occupiedSeats: d.occupiedSeats,
        passengerCapacity: d.passengerCapacity,
        position: location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              heading: location.heading,
            }
          : null,
        stale,
        lastUpdateLabel: location ? ageLabel(location.recordedAt, now) : null,
        arrival: destination
          ? estimateArrivalFromPosition({
              position: location,
              destination,
              departedAt: d.departedAt,
              crossingMinutes,
              now,
            })
          : { minutes: null, label: "Calculando…", basis: "NONE" },
      };
    });

    // Primero las que llegan antes.
    vessels.sort(
      (a, b) =>
        (a.arrival.minutes ?? Number.MAX_SAFE_INTEGER) -
        (b.arrival.minutes ?? Number.MAX_SAFE_INTEGER),
    );

    return { docks, vessels, generatedAt: now.toISOString() };
  };
}
