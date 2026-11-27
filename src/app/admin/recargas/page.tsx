import Link from "next/link";
import { Suspense } from "react";

import { createGetTopUpLimits } from "@/application/wallet/get-top-up-limits";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";
import { requireRole } from "@/lib/auth/require-role";

import { WalletManager } from "./wallet-manager";

async function AdminTopUpsContent() {
  await requireRole("ADMIN");
  const limits = await createGetTopUpLimits(new PrismaWalletRepository())();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <header className="mb-5">
        <Link href="/admin" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Administración
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Saldo y recargas</h1>
        <p className="text-ink-muted text-xs">
          Busca al pasajero por correo o celular para recargar, reembolsar o ajustar su saldo.
        </p>
      </header>
      <WalletManager minCents={limits.minCents} maxCents={limits.maxCents} />
    </main>
  );
}

export default function AdminTopUpsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-6">
          <p className="text-ink-muted text-sm">Cargando recargas...</p>
        </main>
      }
    >
      <AdminTopUpsContent />
    </Suspense>
  );
}
