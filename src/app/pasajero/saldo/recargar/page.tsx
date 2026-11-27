import Link from "next/link";
import { Suspense } from "react";

import { createGetOnlinePaymentStatus } from "@/application/payments/get-online-payment-status";
import { PrismaPaymentRepository } from "@/infrastructure/payments/prisma-payment-repository";
import { requireRole } from "@/lib/auth/require-role";

import { PendingPaymentRefresh } from "./pending-payment-refresh";
import { TopUpForm } from "./top-up-form";

interface OnlineTopUpPageProps {
  searchParams: Promise<{ paymentId?: string | string[] }>;
}

async function OnlineTopUpContent({ searchParams }: OnlineTopUpPageProps) {
  const passenger = await requireRole("PASSENGER");
  const { paymentId } = await searchParams;
  const repo = new PrismaPaymentRepository();
  const [limits, paymentStatus] = await Promise.all([
    repo.getTopUpLimits(),
    createGetOnlinePaymentStatus(repo)(paymentId, passenger.id),
  ]);
  const hasPaymentId = typeof paymentId === "string";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <header className="mb-5">
        <Link href="/pasajero/saldo" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Mi saldo
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Recargar en línea</h1>
      </header>

      {hasPaymentId && paymentStatus === "PENDING" && (
        <section
          role="status"
          className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
        >
          <PendingPaymentRefresh />
          <h2 className="font-heading text-base font-bold">Pago en proceso</h2>
          <p className="mt-2">
            Acreditaremos el saldo cuando Mercado Pago confirme tu pago. Esta página se actualizará
            automáticamente.
          </p>
        </section>
      )}

      {hasPaymentId && paymentStatus === "APPROVED" && (
        <section
          role="status"
          className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-950"
        >
          <h2 className="font-heading text-base font-bold">Pago confirmado</h2>
          <p className="mt-2">Tu saldo fue acreditado correctamente.</p>
          <Link href="/pasajero/saldo" className="text-brand mt-3 inline-block font-semibold">
            Ver saldo e historial
          </Link>
        </section>
      )}

      {hasPaymentId && paymentStatus === "REJECTED" && (
        <section
          role="status"
          className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950"
        >
          <h2 className="font-heading text-base font-bold">Pago no aprobado</h2>
          <p className="mt-2">No se hizo ningún cargo a tu saldo. Puedes intentar otra recarga.</p>
        </section>
      )}

      {hasPaymentId && paymentStatus === null && (
        <p role="status" className="mb-5 rounded-2xl bg-slate-100 p-4 text-sm">
          No encontramos esa recarga en tu cuenta.
        </p>
      )}

      <TopUpForm limits={limits} />
    </main>
  );
}

export default function OnlineTopUpPage(props: OnlineTopUpPageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-6">
          <p className="text-ink-muted text-sm">Cargando recarga...</p>
        </main>
      }
    >
      <OnlineTopUpContent {...props} />
    </Suspense>
  );
}
