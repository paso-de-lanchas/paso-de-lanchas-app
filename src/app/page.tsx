import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="font-heading text-brand text-3xl font-bold">Paso de Lanchas</span>
        <span className="text-ink-muted">Coatzacoalcos ⇄ Villa Allende</span>
      </div>
      <Link
        href="/login"
        className="bg-brand flex h-14 w-full items-center justify-center rounded-2xl text-lg font-bold text-white"
      >
        Iniciar sesión
      </Link>
      <Link
        href="/registro"
        className="border-brand text-brand flex h-14 w-full items-center justify-center rounded-2xl border-2 text-lg font-bold"
      >
        Crear cuenta de pasajero
      </Link>
      <p className="text-ink-muted text-sm">
        Cada cuenta entra a su sección: pasajero, chofer, administrador o superadministrador.
      </p>
    </main>
  );
}
