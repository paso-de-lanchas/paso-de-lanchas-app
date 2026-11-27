import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createGetDriverDetail } from "@/application/drivers/list-drivers";
import { PrismaDriverRepository } from "@/infrastructure/drivers/prisma-driver.repository";
import { requireRole } from "@/lib/auth/require-role";
import { DriverDetailClient } from "./driver-detail-client";

export const metadata: Metadata = { title: "Detalle de chofer | Administrador" };

interface ChoferDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChoferDetailPage({ params }: ChoferDetailPageProps) {
  await requireRole("ADMIN", "SUPERADMIN");

  const { id } = await params;
  const getDetail = createGetDriverDetail(new PrismaDriverRepository());
  const { driver, vessels } = await getDetail(id);

  if (!driver) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-ink-muted text-xs font-semibold uppercase">
            Administración de choferes
          </p>
          <h1 className="font-heading text-ink text-2xl font-bold">{driver.fullName}</h1>
        </div>

        <Link
          href="/admin/choferes"
          className="border-line text-ink hover:bg-surface rounded-xl border bg-white px-4 py-2 text-sm font-medium"
        >
          ← Volver a choferes
        </Link>
      </div>

      <DriverDetailClient driver={driver} vessels={vessels} />
    </main>
  );
}
