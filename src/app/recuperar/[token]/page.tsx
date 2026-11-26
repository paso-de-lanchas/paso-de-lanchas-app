import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetForm } from "./reset-form";

// El token va en la dirección: que no se mande a otros sitios en el encabezado Referer.
export const metadata: Metadata = { title: "Contraseña nueva", referrer: "no-referrer" };

async function ResetFormForToken({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}

/** Elegir contraseña nueva con el enlace del correo (RF-005). */
export default function ResetPasswordPage({ params }: PageProps<"/recuperar/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">Elige tu contraseña nueva</h1>
        <p className="text-ink-muted">El enlace sirve una sola vez.</p>
      </div>
      {/* Leer el token de la dirección es un dato de la petición: va dentro de Suspense. */}
      <Suspense>
        <ResetFormForToken params={params} />
      </Suspense>
    </main>
  );
}
