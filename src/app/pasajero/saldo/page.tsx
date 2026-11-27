import Link from "next/link";
import { Suspense } from "react";

import { createGetBalance } from "@/application/wallet/get-balance";
import { createListTransactions } from "@/application/wallet/list-transactions";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";
import { requireRole } from "@/lib/auth/require-role";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

const transactionLabels = {
  TOPUP_CASH: "Recarga en efectivo",
  TOPUP_ONLINE: "Recarga en línea",
  FARE_CHARGE: "Cobro de cruce",
  REFUND: "Reembolso",
  ADJUSTMENT: "Ajuste",
} as const;

function formatAmount(cents: number): string {
  const amount = currency.format(Math.abs(cents) / 100);
  return `${cents >= 0 ? "+" : "−"}${amount}`;
}

interface PassengerWalletPageProps {
  searchParams: Promise<{ page?: string }>;
}

async function PassengerWalletContent({ searchParams }: PassengerWalletPageProps) {
  const passenger = await requireRole("PASSENGER");
  const { page = "1" } = await searchParams;
  const repo = new PrismaWalletRepository();
  const [balance, history] = await Promise.all([
    createGetBalance({ repo })(passenger.id),
    createListTransactions(repo)(passenger.id, page),
  ]);
  const displayedPageCount = Math.max(history.totalPages, 1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <header className="mb-5">
        <Link href="/pasajero" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Pasajero
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Mi saldo</h1>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-ink-muted text-xs font-medium">Saldo disponible</p>
        <p className="font-heading text-ink mt-1 text-3xl font-bold">
          {currency.format(balance.balanceCents / 100)}
        </p>
        {balance.belowGeneralFare && balance.currentGeneralFareCents !== null && (
          <p
            role="status"
            className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"
          >
            Tu saldo es menor que la tarifa general vigente de{" "}
            <strong>{currency.format(balance.currentGeneralFareCents / 100)}</strong>. Recarga antes
            de abordar.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-ink text-lg font-bold">Movimientos</h2>
        {history.items.length === 0 ? (
          <p className="text-ink-muted rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm">
            Aún no tienes movimientos.
          </p>
        ) : (
          <ol className="space-y-2">
            {history.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/movimientos/${item.id}`}
                  className="hover:border-brand/40 flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <span className="min-w-0">
                    <span className="font-heading text-ink block text-sm font-bold">
                      {transactionLabels[item.type]}
                    </span>
                    <span className="text-ink-muted mt-1 block text-xs">
                      {dateTime.format(item.createdAt)}
                    </span>
                    <span className="text-ink-muted mt-1 block text-xs">
                      {item.reason ?? "Sin concepto"} · Muelle: {item.dockName ?? "No registrado"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      item.amountCents >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatAmount(item.amountCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <nav aria-label="Paginación del historial" className="mt-5 flex items-center justify-between">
        {history.page > 1 ? (
          <Link
            href={`/pasajero/saldo?page=${history.page - 1}`}
            className="text-brand text-sm font-semibold hover:underline"
          >
            ← Más recientes
          </Link>
        ) : (
          <span />
        )}
        <span className="text-ink-muted text-xs">
          Página {history.page} de {displayedPageCount}
        </span>
        {history.page < history.totalPages ? (
          <Link
            href={`/pasajero/saldo?page=${history.page + 1}`}
            className="text-brand text-sm font-semibold hover:underline"
          >
            Más antiguos →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}

export default function PassengerWalletPage(props: PassengerWalletPageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-6">
          <p className="text-ink-muted text-sm">Cargando saldo...</p>
        </main>
      }
    >
      <PassengerWalletContent {...props} />
    </Suspense>
  );
}
