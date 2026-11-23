import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Confirmar correo" };

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">Confirma tu correo</h1>
        <p className="text-ink-muted">Un paso más para activar tu cuenta.</p>
      </div>
      {/* useSearchParams (para ?token=) necesita un Suspense alrededor. */}
      <Suspense>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
