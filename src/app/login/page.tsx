import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">Paso de Lanchas</h1>
        <p className="text-ink-muted">Coatzacoalcos ⇄ Villa Allende</p>
      </div>
      {/* useSearchParams (para ?next=) necesita un Suspense alrededor. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
