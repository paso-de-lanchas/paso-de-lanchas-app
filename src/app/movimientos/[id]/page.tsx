import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createGetTransaction } from "@/application/wallet/get-transaction";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";
import { requireRole } from "@/lib/auth/require-role";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

const transactionLabels = {
  TOPUP_CASH: "Recarga en efectivo",
  TOPUP_ONLINE: "Recarga en línea",
  FARE_CHARGE: "Cobro de cruce",
  REFUND: "Reembolso",
  ADJUSTMENT: "Ajuste de saldo",
} as const;

async function WalletTransactionReceiptContent({ params }: PageProps<"/movimientos/[id]">) {
  const viewer = await requireRole("PASSENGER", "ADMIN");
  const { id } = await params;
  const transaction = await createGetTransaction(new PrismaWalletRepository())(id);

  if (!transaction) notFound();
  if (viewer.role === "PASSENGER" && transaction.walletUserId !== viewer.id) notFound();
  if (
    viewer.role === "ADMIN" &&
    (transaction.type !== "TOPUP_CASH" || transaction.performedById !== viewer.id)
  ) {
    notFound();
  }

  const amount = Math.abs(transaction.amountCents) / 100;
  const returnPath = viewer.role === "ADMIN" ? "/admin/recargas" : "/pasajero/saldo";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
      <Link href={returnPath} className="text-brand text-xs font-semibold hover:underline">
        ← Volver
      </Link>
      <article className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
            Comprobante de movimiento
          </p>
          <h1 className="font-heading text-ink mt-1 text-xl font-bold">
            {transactionLabels[transaction.type]}
          </h1>
          <p className="text-ink mt-3 text-2xl font-bold">
            {transaction.amountCents >= 0 ? "+" : "−"}
            {currency.format(amount)}
          </p>
        </header>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Pasajero</dt>
            <dd className="text-ink text-right font-semibold">{transaction.passengerName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Fecha y hora</dt>
            <dd className="text-ink text-right font-semibold">
              {dateTime.format(transaction.createdAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Concepto</dt>
            <dd className="text-ink text-right font-semibold">
              {transaction.reason ?? "Sin concepto"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Muelle</dt>
            <dd className="text-ink text-right font-semibold">
              {transaction.dockName ?? "No registrado"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Atendió</dt>
            <dd className="text-ink text-right font-semibold">
              {transaction.performedByName ?? "Sistema"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-3">
            <dt className="text-ink-muted">Saldo después del movimiento</dt>
            <dd className="text-ink text-right font-bold">
              {currency.format(transaction.balanceAfterCents / 100)}
            </dd>
          </div>
        </dl>
        <p className="text-ink-muted border-t border-dashed border-slate-300 pt-3 text-center text-[11px] break-all">
          Folio: {transaction.id}
        </p>
      </article>
    </main>
  );
}

export default function WalletTransactionReceiptPage(props: PageProps<"/movimientos/[id]">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-6">
          <p className="text-ink-muted text-sm">Cargando comprobante...</p>
        </main>
      }
    >
      <WalletTransactionReceiptContent {...props} />
    </Suspense>
  );
}
