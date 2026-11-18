import Link from "next/link";

interface ModuleItem {
  name: string;
  owner: string;
  requirements: string;
}

interface ModulePlaceholderProps {
  role: string;
  modules: ModuleItem[];
}

/**
 * Pantalla temporal de cada rol mientras se programan sus módulos.
 * Cada responsable la reemplaza por las pantallas reales del prototipo.
 */
export function ModulePlaceholder({ role, modules }: ModulePlaceholderProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-brand-accent font-bold">
        ← Inicio
      </Link>
      <h1 className="font-heading text-brand text-3xl font-bold">{role}</h1>
      <p className="text-ink-muted">En construcción. Módulos de esta sección y su responsable:</p>
      <ul className="flex flex-col gap-3">
        {modules.map((m) => (
          <li key={m.name} className="border-line rounded-2xl border bg-white p-4">
            <p className="font-bold">{m.name}</p>
            <p className="text-ink-muted text-sm">
              {m.requirements} · Responsable: {m.owner}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
