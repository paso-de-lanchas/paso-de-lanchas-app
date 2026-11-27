"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { scanQrAction, type ScanState } from "./actions";

const CAMERA_ELEMENT_ID = "qr-camera";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const pesos = (cents: number) => currency.format(cents / 100);

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General",
  STUDENT: "Estudiante",
  INAPAM: "INAPAM",
  PEDESTRIAN: "Peatón",
  VEHICLE: "Vehículo",
};

/** Lector de cámara: se carga solo cuando el admin lo abre (html5-qrcode pesa bastante). */
type CameraScanner = { stop(): Promise<void>; clear(): void };

export function ScanPanel({ isFerry, disabled }: { isFerry: boolean; disabled: boolean }) {
  const [state, formAction, pending] = useActionState<ScanState, FormData>(scanQrAction, {
    status: "idle",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"PEDESTRIAN" | "VEHICLE">("PEDESTRIAN");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<CameraScanner | null>(null);

  // Después de cada escaneo, el campo queda vacío y con el foco para el lector USB.
  useEffect(() => {
    if (pending) return;
    if (state.status !== "error" || state.code !== "VEHICLE_CHOICE_REQUIRED") {
      if (qrInputRef.current) qrInputRef.current.value = "";
    }
    qrInputRef.current?.focus();
  }, [state, pending]);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let lastText = "";

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(CAMERA_ELEMENT_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            // La cámara lee el mismo QR varias veces por segundo: solo se envía una vez.
            if (text === lastText || !qrInputRef.current || !formRef.current) return;
            lastText = text;
            qrInputRef.current.value = text;
            formRef.current.requestSubmit();
            setTimeout(() => (lastText = ""), 3000);
          },
          () => {},
        );
      } catch {
        if (!cancelled) {
          setCameraError("No se pudo abrir la cámara. Revisa el permiso o usa el lector USB.");
          setCameraOn(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      scanner
        ?.stop()
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, [cameraOn]);

  const vehicleChoice = state.status === "error" ? state.vehicleChoice : undefined;

  return (
    <section className="flex flex-col gap-4">
      <form
        ref={formRef}
        action={formAction}
        className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs"
      >
        {isFerry && (
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="text-ink mb-1 text-xs font-bold">El pasajero cruza</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="PEDESTRIAN"
                checked={mode === "PEDESTRIAN"}
                onChange={() => setMode("PEDESTRIAN")}
              />
              A pie
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="VEHICLE"
                checked={mode === "VEHICLE"}
                onChange={() => setMode("VEHICLE")}
              />
              Con vehículo
            </label>
          </fieldset>
        )}
        {!isFerry && <input type="hidden" name="mode" value="PEDESTRIAN" />}

        <label htmlFor="qr" className="text-ink text-xs font-bold">
          Código QR (el lector USB lo escribe aquí y presiona Enter)
        </label>
        <div className="flex gap-2">
          <input
            ref={qrInputRef}
            id="qr"
            name="qr"
            autoComplete="off"
            autoFocus
            maxLength={200}
            disabled={disabled}
            className="text-ink w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={disabled || pending}
            className="bg-brand rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Cobrando…" : "Cobrar"}
          </button>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCameraError(null);
            setCameraOn((on) => !on);
          }}
          className="border-brand text-brand self-start rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          {cameraOn ? "Cerrar cámara" : "Escanear con la cámara"}
        </button>
        {cameraError && (
          <p role="alert" className="text-xs text-rose-800">
            {cameraError}
          </p>
        )}
        {cameraOn && <div id={CAMERA_ELEMENT_ID} className="w-full max-w-sm" />}
      </form>

      {vehicleChoice && (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-2xl border border-sky-300 bg-sky-50 p-4"
        >
          <p className="text-ink text-sm font-bold">
            ¿Con qué vehículo cruza {vehicleChoice.passengerName}?
          </p>
          <input type="hidden" name="qr" value={vehicleChoice.qr} />
          <input type="hidden" name="mode" value="VEHICLE" />
          <div className="flex flex-col gap-2">
            {vehicleChoice.vehicles.map((v) => (
              <button
                key={v.id}
                type="submit"
                name="vehicleId"
                value={v.id}
                disabled={pending}
                className="rounded-xl border border-sky-400 bg-white px-4 py-3 text-left text-sm disabled:opacity-60"
              >
                <span className="font-bold">{v.plate}</span> · {v.vehicleTypeName} · {v.description}
              </button>
            ))}
          </div>
          <p className="text-ink-muted text-xs">
            Si el QR venció, pide al pasajero que lo muestre de nuevo y escanéalo otra vez.
          </p>
        </form>
      )}

      <ScanResult state={state} />
    </section>
  );
}

function ScanResult({ state }: { state: ScanState }) {
  if (state.status === "idle") return null;

  if (state.status === "success") {
    const c = state.confirmation;
    return (
      <article
        role="status"
        aria-label="Abordaje registrado"
        className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 text-emerald-950"
      >
        <p className="text-xs font-semibold uppercase">Abordaje registrado</p>
        <p className="font-heading mt-1 text-2xl font-bold">{c.passengerName}</p>
        <p className="mt-2 text-5xl font-bold" aria-label="Número de lugar">
          Lugar {c.seatNumber}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="font-semibold">Embarcación</dt>
          <dd>
            {c.vesselName} → {c.destinationDockName}
          </dd>
          <dt className="font-semibold">Tarifa</dt>
          <dd>
            {CATEGORY_LABELS[c.fareCategory] ?? c.fareCategory} · {pesos(c.amountCents)}
          </dd>
          <dt className="font-semibold">Saldo restante</dt>
          <dd>{pesos(c.balanceAfterCents)}</dd>
          {c.vehicle && (
            <>
              <dt className="font-semibold">Vehículo</dt>
              <dd>
                {c.vehicle.plate} · {c.vehicle.vehicleTypeName}
              </dd>
            </>
          )}
        </dl>
        {c.discountType && (
          <p className="mt-3 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-950">
            Descuento {CATEGORY_LABELS[c.discountType]}: revisa su credencial antes de dejarlo
            pasar.
          </p>
        )}
        {c.departureClosed && (
          <p className="mt-3 text-sm font-bold">La embarcación se llenó y se cerró su abordaje.</p>
        )}
      </article>
    );
  }

  if (state.code === "VEHICLE_CHOICE_REQUIRED") return null;

  return (
    <article
      role="alert"
      aria-label="Escaneo rechazado"
      className="rounded-2xl border-2 border-rose-400 bg-rose-50 p-5 text-rose-950"
    >
      <p className="text-xs font-semibold uppercase">No se cobró</p>
      <p className="mt-1 text-lg font-bold">{state.message}</p>
      {state.code === "INSUFFICIENT_BALANCE" && state.shortfallCents !== undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm">Faltan {pesos(state.shortfallCents)}.</p>
          <Link
            href="/admin/recargas"
            className="bg-brand rounded-xl px-4 py-2 text-sm font-bold text-white"
          >
            Recargar en efectivo
          </Link>
        </div>
      )}
    </article>
  );
}
