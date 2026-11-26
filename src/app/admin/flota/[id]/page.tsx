import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaVesselRepository } from "@/infrastructure/fleet/prisma-vessel-repository";
import { requireRole } from "@/lib/auth/require-role";
import { updateVesselAction } from "../actions";
import { VesselForm } from "../vessel-form";

export const metadata: Metadata = {
  title: "Editar embarcación | Administrador",
};

const uuidSchema = z.string().uuid();

interface EditarEmbarcacionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEmbarcacionPage({ params }: EditarEmbarcacionPageProps) {
  await requireRole("ADMIN", "SUPERADMIN");

  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const repo = new PrismaVesselRepository(prisma);
  const [vessel, vehicleTypes] = await Promise.all([
    repo.findById(parsedId.data),
    repo.listVehicleTypes(),
  ]);

  if (!vessel) {
    notFound();
  }

  const boundUpdateAction = updateVesselAction.bind(null, vessel.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ink-muted text-xs font-semibold tracking-wider uppercase">
            Flota · {vessel.code}
          </p>
          <h1 className="font-heading text-ink text-2xl font-bold">Editar {vessel.name}</h1>
        </div>

        <Link href="/admin/flota" className="text-brand text-sm font-medium hover:underline">
          ← Volver a flota
        </Link>
      </div>

      <VesselForm
        mode="edit"
        vehicleTypes={vehicleTypes}
        initialVessel={vessel}
        action={boundUpdateAction}
      />
    </main>
  );
}
