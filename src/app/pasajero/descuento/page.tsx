import Link from "next/link";

import { getMyDiscount } from "@/application/account/get-my-discount";
import { PrismaDiscountRepository } from "@/infrastructure/account/prisma-discount-repository";
import { requireRole } from "@/lib/auth/require-role";

import { DiscountForm } from "./discount-form";

export default async function PassengerDiscountPage() {
  const passenger = await requireRole("PASSENGER");
  const repo = new PrismaDiscountRepository();
  const latestRequest = await getMyDiscount(repo, passenger.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <header className="mb-5">
        <Link href="/pasajero" className="text-brand text-xs font-semibold hover:underline">
          ← Volver a Pasajero
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Descuentos</h1>
        <p className="text-ink-muted text-xs">
          Solicita o consulta tu tarifa preferencial de Estudiante o INAPAM.
        </p>
      </header>
      <DiscountForm passengerName={passenger.fullName} latestRequest={latestRequest} />
    </main>
  );
}
