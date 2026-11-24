import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaDepartureRepository } from "@/infrastructure/departures/prisma-departure-repository";
import { OperationClient } from "./operation-client";

interface OperacionPageProps {
  searchParams: Promise<{ dockId?: string }>;
}

export default async function OperacionPage({ searchParams }: OperacionPageProps) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const repo = new PrismaDepartureRepository(prisma);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { dockId: true },
  });
  const userDockId = dbUser?.dockId ?? null;

  const docks = await repo.listDocks();
  const lockDock = Boolean(userDockId);
  const selectedDockId =
    userDockId ??
    (params.dockId && docks.some((d) => d.id === params.dockId)
      ? params.dockId
      : (docks[0]?.id ?? ""));

  const [vessels, departures, waitlist] = selectedDockId
    ? await Promise.all([
        repo.listEligibleVessels(),
        repo.listDeparturesByDock(selectedDockId),
        repo.listWaitlistByDock(selectedDockId),
      ])
    : [[], [], []];

  const boarding = departures.find((d) => d.status === "BOARDING") ?? null;
  const queued = departures.filter((d) => d.status === "QUEUED");

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operación del muelle</h1>
        <p className="text-sm text-slate-600">
          Gestión de fila de embarcaciones, apertura/cierre de abordaje y lista de espera.
        </p>
      </div>

      {selectedDockId ? (
        <OperationClient
          docks={docks}
          selectedDockId={selectedDockId}
          lockDock={lockDock}
          vessels={vessels}
          boarding={boarding}
          queued={queued}
          waitlist={waitlist}
        />
      ) : (
        <p className="text-sm text-slate-500">No hay muelles configurados en el sistema.</p>
      )}
    </main>
  );
}
