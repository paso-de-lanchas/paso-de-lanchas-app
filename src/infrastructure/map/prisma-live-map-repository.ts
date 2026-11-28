import type {
  InTransitDeparture,
  LiveMapRepository,
  MapDock,
} from "@/application/map/get-live-map";
import type { VesselKind } from "@/domain/fares/fare";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";

interface InTransitRow {
  departure_id: string;
  vessel_name: string;
  vessel_kind: VesselKind;
  origin_dock_id: string;
  destination_dock_id: string;
  departed_at: Date | null;
  occupied_seats: number;
  passenger_capacity: number;
  latitude: string | null;
  longitude: string | null;
  speed_kmh: string | null;
  heading: string | null;
  recorded_at: Date | null;
}

const DEFAULT_CROSSING_MINUTES = 15;

const toNumber = (value: string | null) => (value === null ? null : Number(value));

export function createPrismaLiveMapRepository(db: PrismaClient = prisma): LiveMapRepository {
  return {
    async listDocks(): Promise<MapDock[]> {
      const docks = await db.dock.findMany({
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, latitude: true, longitude: true },
      });
      return docks.map((dock) => ({
        ...dock,
        latitude: Number(dock.latitude),
        longitude: Number(dock.longitude),
      }));
    },

    async listInTransit(): Promise<InTransitDeparture[]> {
      // La ÚLTIMA ubicación de cada salida en tránsito con un solo viaje a la base
      // (LATERAL + índice trip_locations(departure_id, recorded_at)).
      const rows = await db.$queryRaw<InTransitRow[]>`
        SELECT d.id AS departure_id, v.name AS vessel_name, v.kind::text AS vessel_kind,
               d.origin_dock_id, d.destination_dock_id, d.departed_at,
               d.occupied_seats, d.passenger_capacity,
               l.latitude::text AS latitude, l.longitude::text AS longitude,
               l.speed_kmh::text AS speed_kmh, l.heading::text AS heading, l.recorded_at
        FROM departures d
        JOIN vessels v ON v.id = d.vessel_id
        LEFT JOIN LATERAL (
          SELECT latitude, longitude, speed_kmh, heading, recorded_at
          FROM trip_locations t
          WHERE t.departure_id = d.id
          ORDER BY t.recorded_at DESC
          LIMIT 1
        ) l ON TRUE
        WHERE d.status = 'IN_TRANSIT'
        ORDER BY d.departed_at ASC NULLS LAST`;

      return rows.map((row) => ({
        departureId: row.departure_id,
        vesselName: row.vessel_name,
        vesselKind: row.vessel_kind,
        originDockId: row.origin_dock_id,
        destinationDockId: row.destination_dock_id,
        departedAt: row.departed_at,
        occupiedSeats: Number(row.occupied_seats),
        passengerCapacity: Number(row.passenger_capacity),
        lastLocation:
          row.recorded_at && row.latitude !== null && row.longitude !== null
            ? {
                latitude: Number(row.latitude),
                longitude: Number(row.longitude),
                speedKmh: toNumber(row.speed_kmh),
                heading: toNumber(row.heading),
                recordedAt: row.recorded_at,
              }
            : null,
      }));
    },

    async getCrossingMinutes(): Promise<number> {
      const setting = await db.systemSetting.findUnique({ where: { key: "crossing_minutes" } });
      const value = Number(setting?.value);
      return Number.isFinite(value) && value > 0 ? value : DEFAULT_CROSSING_MINUTES;
    },
  };
}
