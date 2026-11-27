"use client";

import { useEffect, useState } from "react";

import type { PassengerBoardingView } from "@/application/boarding/boarding-queries";

const POLL_MS = 5_000;

const STATUS_LABELS: Record<PassengerBoardingView["departureStatus"], string> = {
  BOARDING: "Abordando",
  BOARDING_CLOSED: "Abordaje cerrado, por salir",
  IN_TRANSIT: "En camino",
};

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** Aviso en el celular del pasajero cuando el admin escanea su QR (consulta cada 5 s, RF-051). */
export function BoardingNotice({ initial }: { initial: PassengerBoardingView | null }) {
  const [boarding, setBoarding] = useState(initial);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/pasajero/abordaje", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { boarding: PassengerBoardingView | null };
        if (active) setBoarding(body.boarding);
      } catch {
        // Sin internet: se conserva lo último que se mostró.
      }
    };
    const id = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!boarding) return null;

  return (
    <section
      role="status"
      aria-label="Tu abordaje"
      className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 text-emerald-950"
    >
      <p className="text-xs font-semibold uppercase">Ya abordaste</p>
      <p className="mt-1 text-4xl font-bold">Lugar {boarding.seatNumber}</p>
      <p className="mt-2 text-sm font-semibold">
        {boarding.vesselName}: {boarding.originDockName} → {boarding.destinationDockName}
      </p>
      <p className="text-xs">
        {STATUS_LABELS[boarding.departureStatus]} · Pagaste{" "}
        {currency.format(boarding.amountCents / 100)}
        {boarding.vehiclePlate ? ` · Vehículo ${boarding.vehiclePlate}` : ""}
      </p>
    </section>
  );
}
