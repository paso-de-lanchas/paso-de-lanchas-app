"use client";

import { useActionState } from "react";

import type { PendingDiscountItem } from "@/application/account/discount-repository";
import { getDiscountTypeLabel } from "@/domain/account/discount";

import { type ReviewDiscountActionState, reviewDiscountAction } from "./actions";

function PendingRequestCard({ item }: { item: PendingDiscountItem }) {
  const [state, formAction, isPending] = useActionState<ReviewDiscountActionState, FormData>(
    reviewDiscountAction,
    { status: "idle" },
  );

  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading text-ink text-base font-bold">{item.passengerName}</p>
          <p className="text-ink-muted text-xs">{item.passengerEmail}</p>
        </div>
        <span className="text-brand rounded-full bg-sky-100 px-3 py-1 text-xs font-bold">
          {getDiscountTypeLabel(item.discountType)}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/admin/descuentos/${item.id}/credencial`}
          alt={`Credencial de ${item.passengerName}`}
          className="max-h-64 w-full object-contain"
        />
      </div>

      {state.message && (
        <p className="text-ink rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-medium">
          {state.message}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <form
          action={formAction}
          className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
        >
          <input type="hidden" name="requestId" value={item.id} />
          <input type="hidden" name="decision" value="APPROVE" />
          <label
            htmlFor={`validUntil-${item.id}`}
            className="block text-xs font-bold text-emerald-950"
          >
            Fecha de vencimiento
          </label>
          <input
            id={`validUntil-${item.id}`}
            name="validUntil"
            type="date"
            min="2026-01-01"
            max="2099-12-31"
            required
            className="text-ink w-full rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
          >
            {isPending ? "Procesando..." : "Aprobar descuento"}
          </button>
        </form>

        <form
          action={formAction}
          className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3"
        >
          <input type="hidden" name="requestId" value={item.id} />
          <input type="hidden" name="decision" value="REJECT" />
          <label htmlFor={`reason-${item.id}`} className="block text-xs font-bold text-rose-950">
            Motivo del rechazo
          </label>
          <input
            id={`reason-${item.id}`}
            name="rejectionReason"
            type="text"
            placeholder="Ej. Credencial vencida"
            required
            className="text-ink w-full rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white"
          >
            {isPending ? "Procesando..." : "Rechazar solicitud"}
          </button>
        </form>
      </div>
    </article>
  );
}

export function PendingDiscountsReviewList({ items }: { items: PendingDiscountItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-ink-muted rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs">
        No hay solicitudes pendientes de revisión.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <PendingRequestCard key={item.id} item={item} />
      ))}
    </div>
  );
}
