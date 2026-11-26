import { logoutAction } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-brand-accent font-bold underline">
        Cerrar sesión
      </button>
    </form>
  );
}
