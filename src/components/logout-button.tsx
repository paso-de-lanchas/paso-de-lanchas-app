"use client";

import { logoutAction } from "@/app/login/actions";
import { clearStoredQrCredentials } from "@/lib/qr-storage";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        await clearStoredQrCredentials(); // primero borrar el secreto del celular
        await logoutAction(); // luego cerrar sesión en el servidor
      }}
    >
      <button type="submit" className="text-brand-accent font-bold underline">
        Cerrar sesión
      </button>
    </form>
  );
}
