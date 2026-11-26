import type { Metadata } from "next";
import Link from "next/link";

import { getAccountCancellationPreview } from "@/application/account/cancel-account";
import { PrismaAccountCancellationRepository } from "@/infrastructure/account/prisma-account-cancellation-repository";
import { requireRole } from "@/lib/auth/require-role";

import { CancelAccountForm } from "./cancel-account-form";

export const metadata: Metadata = { title: "Cancelar cuenta" };

export default async function CancelAccountPage() {
  const sessionUser = await requireRole("PASSENGER");
  const repo = new PrismaAccountCancellationRepository();
  const preview = await getAccountCancellationPreview(repo, sessionUser.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <header className="mb-5">
        <Link href="/pasajero/cuenta" className="text-brand text-xs font-bold hover:underline">
          ← Volver a Mi cuenta
        </Link>
        <h1 className="font-heading text-ink mt-1 text-2xl font-bold">Cancelar cuenta</h1>
        <p className="text-ink-muted text-xs">
          Solicita la baja definitiva y la eliminación de tus datos personales (RF-016).
        </p>
      </header>

      <CancelAccountForm preview={preview} />
    </main>
  );
}
