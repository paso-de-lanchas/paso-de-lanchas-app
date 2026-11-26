import type { Metadata } from "next";

import { RequestResetForm } from "./request-reset-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RequestResetPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">Recupera tu contraseña</h1>
        <p className="text-ink-muted">Te enviaremos un enlace a tu correo.</p>
      </div>
      <RequestResetForm />
    </main>
  );
}
