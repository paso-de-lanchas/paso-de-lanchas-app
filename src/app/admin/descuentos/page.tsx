import Link from "next/link";

import { listPendingDiscounts } from "@/application/account/list-pending-discounts";
import { PrismaDiscountRepository } from "@/infrastructure/account/prisma-discount-repository";
import { requireRole } from "@/lib/auth/require-role";

import { PendingDiscountsReviewList } from "./review-list";

export default async function AdminDiscountsPage() {
  await requireRole("ADMIN");
  const repo = new PrismaDiscountRepository();
  const pending = await listPendingDiscounts(repo);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <header className="mb-5">
        <Link href="/admin" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Administración
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Descuentos pendientes</h1>
        <p className="text-ink-muted text-xs">
          Verifica credenciales de Estudiante o INAPAM, asigna vigencia o indica motivo de rechazo.
        </p>
      </header>
      <PendingDiscountsReviewList items={pending} />
    </main>
  );
}
