import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { CHANGE_PASSWORD_PATH } from "@/domain/auth/roles";

interface SuperadminHeaderProps {
  userName: string;
  /** Pantalla a la que regresa el enlace «Volver» (ninguno en el inicio). */
  back?: { href: string; label: string };
}

/** Barra superior de las pantallas del superadministrador. */
export function SuperadminHeader({ userName, back }: SuperadminHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {back ? (
        <Link href={back.href} className="text-brand-accent text-sm font-bold underline">
          ← {back.label}
        </Link>
      ) : (
        <p className="text-ink-muted">Hola, {userName}</p>
      )}
      <div className="flex items-center gap-4">
        <Link href={CHANGE_PASSWORD_PATH} className="text-brand-accent text-sm font-bold underline">
          Cambiar contraseña
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
