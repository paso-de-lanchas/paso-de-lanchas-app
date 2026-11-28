import { describe, expect, it } from "vitest";

import {
  createGetLiveMap,
  type InTransitDeparture,
  type LiveMapRepository,
  type MapDock,
} from "./get-live-map";

const NOW = new Date("2026-11-27T18:00:00.000Z");
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);

const docks: MapDock[] = [
  { id: "coa", code: "COA", name: "Coatzacoalcos", latitude: 18.1497, longitude: -94.4349 },
  { id: "val", code: "VAL", name: "Villa Allende", latitude: 18.1435, longitude: -94.4443 },
];

function departure(overrides: Partial<InTransitDeparture>): InTransitDeparture {
  return {
    departureId: "dep",
    vesselName: "Lancha 1",
    vesselKind: "BOAT",
    originDockId: "coa",
    destinationDockId: "val",
    departedAt: secondsAgo(5 * 60),
    occupiedSeats: 12,
    passengerCapacity: 20,
    lastLocation: null,
    ...overrides,
  };
}

function getLiveMap(departures: InTransitDeparture[]) {
  const repo: LiveMapRepository = {
    listDocks: async () => docks,
    listInTransit: async () => departures,
    getCrossingMinutes: async () => 15,
  };
  return createGetLiveMap({ repo, clock: { now: () => NOW } })();
}

describe("mapa en vivo", () => {
  it("muestra los dos muelles aunque no haya embarcaciones en tránsito", async () => {
    const map = await getLiveMap([]);
    expect(map.docks).toHaveLength(2);
    expect(map.vessels).toEqual([]);
    expect(map.generatedAt).toBe(NOW.toISOString());
  });

  it("con ubicación reciente: posición, ocupación y llegada por distancia", async () => {
    const map = await getLiveMap([
      departure({
        lastLocation: {
          latitude: 18.1466,
          longitude: -94.4396,
          speedKmh: 12,
          heading: 230,
          recordedAt: secondsAgo(4),
        },
      }),
    ]);
    const [vessel] = map.vessels;
    expect(vessel).toMatchObject({
      vesselName: "Lancha 1",
      originDockName: "Coatzacoalcos",
      destinationDockName: "Villa Allende",
      occupiedSeats: 12,
      passengerCapacity: 20,
      position: { latitude: 18.1466, longitude: -94.4396, heading: 230 },
      stale: false,
      lastUpdateLabel: "hace 4 s",
    });
    expect(vessel?.arrival.basis).toBe("DISTANCE");
  });

  it("sin ubicación reciente avisa hace cuánto fue la última (RF-080)", async () => {
    const map = await getLiveMap([
      departure({
        lastLocation: {
          latitude: 18.1466,
          longitude: -94.4396,
          speedKmh: 12,
          heading: null,
          recordedAt: secondsAgo(240),
        },
      }),
    ]);
    expect(map.vessels[0]).toMatchObject({
      stale: true,
      lastUpdateLabel: "hace 4 min",
      arrival: { basis: "SCHEDULE", minutes: 10 },
    });
  });

  it("sin ninguna ubicación no pone un punto en el mapa, pero sí estima la llegada", async () => {
    const map = await getLiveMap([departure({ lastLocation: null })]);
    expect(map.vessels[0]).toMatchObject({
      position: null,
      stale: true,
      lastUpdateLabel: null,
      arrival: { basis: "SCHEDULE", minutes: 10 },
    });
  });

  it("descarta coordenadas basura del celular", async () => {
    const map = await getLiveMap([
      departure({
        lastLocation: {
          latitude: 999,
          longitude: -94.4,
          speedKmh: 10,
          heading: null,
          recordedAt: secondsAgo(2),
        },
      }),
    ]);
    expect(map.vessels[0]?.position).toBeNull();
  });

  it("ordena por la que llega primero y no truena si falta el muelle de destino", async () => {
    const map = await getLiveMap([
      departure({ departureId: "tarde", departedAt: secondsAgo(60) }),
      departure({ departureId: "pronto", departedAt: secondsAgo(14 * 60) }),
      departure({ departureId: "sin-muelle", destinationDockId: "borrado" }),
    ]);
    expect(map.vessels.map((v) => v.departureId)).toEqual(["pronto", "tarde", "sin-muelle"]);
    expect(map.vessels[2]).toMatchObject({
      destinationDockName: "—",
      arrival: { minutes: null, basis: "NONE" },
    });
  });
});
