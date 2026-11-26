import type { Metadata } from "next";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

/** Registro público: solo crea cuentas de pasajero (RF-007). */
export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">Crea tu cuenta</h1>
        <p className="text-ink-muted">Tu celular será tu boleto para cruzar el río.</p>
      </div>
      <RegisterForm />
    </main>
  );
}
