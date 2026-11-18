import Link from "next/link";

const sections = [
  { href: "/pasajero", label: "Pasajero" },
  { href: "/chofer", label: "Chofer" },
  { href: "/admin", label: "Administrador (taquilla)" },
  { href: "/superadmin", label: "Superadministrador" },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="font-heading text-brand text-3xl font-bold">Paso de Lanchas</span>
        <span className="text-ink-muted">Coatzacoalcos ⇄ Villa Allende</span>
      </div>
      <nav aria-label="Secciones" className="flex w-full flex-col gap-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-brand flex h-14 items-center justify-center rounded-2xl text-lg font-bold text-white"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <p className="text-ink-muted text-sm">Base del proyecto · Sprint 1</p>
    </main>
  );
}
