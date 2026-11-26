import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LogoutButton } from "@/components/logout-button";
import { SectionLoading } from "@/components/section-loading";
import { homePathFor } from "@/domain/auth/roles";
import { getCurrentUser } from "@/lib/auth/auth";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Cambiar contraseña" };

/**
 * Cambiar contraseña (RF-006), para todos los roles. Con contraseña temporal (RF-013) es la
 * única pantalla permitida: aquí no se usa requireUser, que mandaría de vuelta a esta misma.
 */
export default function ChangePasswordPage() {
  // Leer la sesión (cookie) es un dato de la petición: va dentro de Suspense.
  return (
    <Suspense fallback={<SectionLoading />}>
      <ChangePassword />
    </Suspense>
  );
}

async function ChangePassword() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cuenta/cambiar-contrasena");
  const temporary = user.mustChangePassword;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-4 py-12 text-center">
      <div className="flex w-full items-center justify-between gap-4">
        {temporary ? (
          <span />
        ) : (
          <Link href={homePathFor(user.role)} className="text-brand-accent font-bold underline">
            Volver
          </Link>
        )}
        <LogoutButton />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-brand text-3xl font-bold">Cambia tu contraseña</h1>
        <p className="text-ink-muted">
          {temporary
            ? "Tu contraseña es temporal. Elige una nueva para continuar."
            : `Hola, ${user.fullName}. Escribe tu contraseña actual y la nueva.`}
        </p>
      </div>
      <ChangePasswordForm temporary={temporary} />
    </main>
  );
}
