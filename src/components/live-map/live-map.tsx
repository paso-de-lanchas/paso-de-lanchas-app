"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";

import type { LiveMap as LiveMapData, LiveVessel } from "@/application/map/get-live-map";

const WORKER_PATH = "/vendor/maplibre-gl-worker.mjs";

/** Cada 7 s, dentro del rango de 5 a 10 s que pide RF-078. */
const POLL_MS = 7_000;

/** Mapa de OpenStreetMap (gratuito, sin llave). Su licencia exige mostrar el crédito. */
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© Colaboradores de OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

type MapLibre = typeof import("maplibre-gl");
type MapInstance = InstanceType<MapLibre["Map"]>;
type MarkerInstance = InstanceType<MapLibre["Marker"]>;

function markerElement(kind: "dock" | "BOAT" | "FERRY", label: string, stale = false) {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.title = label;
  el.textContent = kind === "dock" ? "⚓" : kind === "FERRY" ? "⛴" : "🚤";
  el.style.cssText = [
    "display:flex;align-items:center;justify-content:center",
    "width:34px;height:34px;border-radius:9999px;font-size:18px",
    "border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)",
    `background:${kind === "dock" ? "#0b3d5c" : stale ? "#9aa5ae" : "#e07a1f"}`,
  ].join(";");
  return el;
}

function vesselLabel(v: LiveVessel) {
  return `${v.vesselName} rumbo a ${v.destinationDockName}, llega en ${v.arrival.label}`;
}

/**
 * Mapa en vivo (RF-077 a RF-081). MapLibre se carga solo en el navegador; si el equipo no
 * soporta WebGL, la lista de abajo sigue mostrando todo.
 */
export function LiveMap({
  initial,
  showOccupancy,
}: {
  initial: LiveMapData;
  showOccupancy: boolean;
}) {
  const [data, setData] = useState(initial);
  const [mapError, setMapError] = useState(false);
  const [offline, setOffline] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ lib: MapLibre; map: MapInstance } | null>(null);
  const markersRef = useRef<MarkerInstance[]>([]);

  // 1) Consultas periódicas sin recargar la página (RF-078).
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/mapa", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as LiveMapData;
        if (active) {
          setData(body);
          setOffline(false);
        }
      } catch {
        if (active) setOffline(true);
      }
    };
    const id = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // 2) Crear el mapa una sola vez, centrado entre los dos muelles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        // El worker se sirve como archivo estático (scripts/copy-maplibre-worker.mjs): con el
        // empaquetado de Next.js, MapLibre no lo encuentra por su ruta relativa.
        lib.setWorkerUrl(new URL(WORKER_PATH, window.location.origin).href);
        const docks = initial.docks;
        const center: [number, number] = docks.length
          ? [
              docks.reduce((s, d) => s + d.longitude, 0) / docks.length,
              docks.reduce((s, d) => s + d.latitude, 0) / docks.length,
            ]
          : [-94.4396, 18.1466];
        const map = new lib.Map({
          container: containerRef.current,
          style: OSM_STYLE,
          center,
          zoom: 14,
          attributionControl: { compact: true },
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {
          // Un mosaico que no carga no debe tirar la pantalla; el mapa sigue usable.
        });
        mapRef.current = { lib, map };
        setData((current) => ({ ...current })); // pinta los marcadores ya con el mapa listo
      } catch {
        if (!cancelled) setMapError(true);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, [initial.docks]);

  // 3) Redibujar marcadores con cada actualización.
  useEffect(() => {
    const current = mapRef.current;
    if (!current) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [
      ...data.docks.map((dock) =>
        new current.lib.Marker({ element: markerElement("dock", `Muelle ${dock.name}`) })
          .setLngLat([dock.longitude, dock.latitude])
          .addTo(current.map),
      ),
      ...data.vessels
        .filter((v) => v.position)
        .map((v) =>
          new current.lib.Marker({
            element: markerElement(v.vesselKind, vesselLabel(v), v.stale),
          })
            .setLngLat([v.position!.longitude, v.position!.latitude])
            .addTo(current.map),
        ),
    ];
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      {mapError ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          Este equipo no puede mostrar el mapa. Abajo está la misma información en lista.
        </p>
      ) : (
        <div
          ref={containerRef}
          aria-label="Mapa de los muelles y las embarcaciones en tránsito"
          className="border-line h-[55vh] min-h-72 w-full overflow-hidden rounded-2xl border"
        />
      )}

      {offline && (
        <p role="status" className="text-xs text-amber-800">
          Sin conexión: se muestra la última información recibida.
        </p>
      )}

      <section aria-labelledby="in-transit-heading" className="flex flex-col gap-2">
        <h2 id="in-transit-heading" className="font-heading text-ink text-lg font-bold">
          En camino ({data.vessels.length})
        </h2>
        {data.vessels.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Ninguna embarcación está cruzando en este momento.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.vessels.map((v) => (
              <li
                key={v.departureId}
                className="border-line flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3"
              >
                <div>
                  <p className="text-ink font-bold">{v.vesselName}</p>
                  <p className="text-ink-muted text-xs">
                    {v.originDockName} → {v.destinationDockName}
                    {showOccupancy && ` · ${v.occupiedSeats}/${v.passengerCapacity} a bordo`}
                  </p>
                  {v.stale && (
                    <p className="text-xs text-amber-800">
                      {v.lastUpdateLabel
                        ? `Sin señal reciente · última ubicación ${v.lastUpdateLabel}`
                        : "Todavía no llega su ubicación"}
                    </p>
                  )}
                </div>
                <p className="text-brand text-right text-sm font-bold">
                  Llega en
                  <span className="block text-xl">{v.arrival.label}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
