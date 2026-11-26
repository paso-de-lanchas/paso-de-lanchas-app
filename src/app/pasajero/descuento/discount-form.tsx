"use client";

import { useActionState, useState } from "react";

import {
  type DiscountRequest,
  getDiscountStatusLabel,
  getDiscountTypeLabel,
  isDiscountActive,
} from "@/domain/account/discount";

import { type DiscountRequestActionState, submitDiscountRequestAction } from "./actions";

interface DiscountFormProps {
  passengerName: string;
  latestRequest: DiscountRequest | null;
}

function formatDate(date: Date | null): string {
  if (!date) return "Sin definir";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function DiscountForm({ passengerName, latestRequest }: DiscountFormProps) {
  const [state, formAction, isPending] = useActionState<DiscountRequestActionState, FormData>(
    submitDiscountRequestAction,
    { status: "idle" },
  );
  const [fileName, setFileName] = useState("");

  const hasPending = latestRequest?.status === "PENDING";
  const hasActive = latestRequest ? isDiscountActive(latestRequest) : false;
  const canSubmitNew = !hasPending && !hasActive;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-ink-muted text-xs font-medium">Pasajero titular</p>
        <p className="font-heading text-ink text-base font-bold">{passengerName}</p>
      </section>

      {latestRequest && (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-ink text-sm font-bold">Estado de solicitud</h2>
            <span className="text-ink rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
              {getDiscountStatusLabel(latestRequest.status)}
            </span>
          </div>
          <p className="text-ink-muted text-xs">
            Modalidad:{" "}
            <strong className="text-ink">{getDiscountTypeLabel(latestRequest.discountType)}</strong>
          </p>
          <p className="text-ink-muted text-xs">
            Solicitado el:{" "}
            <strong className="text-ink">{formatDate(latestRequest.createdAt)}</strong>
          </p>
          {latestRequest.validUntil && (
            <p className="text-ink-muted text-xs">
              Vigente hasta:{" "}
              <strong className="text-ink">{formatDate(latestRequest.validUntil)}</strong>
            </p>
          )}
          {latestRequest.status === "REJECTED" && latestRequest.rejectionReason && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
              <strong>Motivo del rechazo:</strong> {latestRequest.rejectionReason}
            </p>
          )}
        </section>
      )}

      {state.status === "success" && state.message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900"
        >
          {state.message}
        </p>
      )}
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900"
        >
          {state.message}
        </p>
      )}

      {canSubmitNew ? (
        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="font-heading text-ink text-base font-bold">
            Solicitar tarifa preferencial
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-ink flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 p-3 text-xs font-semibold">
              <input
                type="radio"
                name="discountType"
                value="STUDENT"
                defaultChecked
                className="accent-brand"
              />
              <span>Estudiante</span>
            </label>
            <label className="text-ink flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 p-3 text-xs font-semibold">
              <input type="radio" name="discountType" value="INAPAM" className="accent-brand" />
              <span>INAPAM</span>
            </label>
          </div>
          <div className="space-y-1">
            <label htmlFor="credentialPhoto" className="text-ink block text-xs font-bold">
              Fotografía de credencial vigente (JPG, PNG o WebP, máx. 5 MB)
            </label>
            <input
              id="credentialPhoto"
              name="credentialPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              className="text-ink block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
            />
            {fileName && <p className="text-ink-muted text-[11px]">Archivo: {fileName}</p>}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="bg-brand w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isPending ? "Enviando solicitud..." : "Enviar solicitud de descuento"}
          </button>
        </form>
      ) : (
        <p className="text-ink-muted rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
          {hasPending
            ? "Ya tienes una solicitud en revisión."
            : "Ya cuentas con un descuento aprobado y vigente."}
        </p>
      )}
    </div>
  );
}
