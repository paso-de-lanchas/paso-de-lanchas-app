import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaDepartureRepository } from "@/infrastructure/departures/prisma-departure-repository";
import { createListDepartureBoardings } from "@/application/departures/list-departure-boardings";
import { DepartureDetailClient } from "./detail-client";

const idSchema = z.string().uuid();

export default async function AdminDepartureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("ADMIN");
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { dockId: true },
  });
  const actorDockId = dbUser?.dockId ?? null;

  const repo = new PrismaDepartureRepository(prisma);
  const departure = await repo.findDepartureById(parsedId.data);
  if (!departure) {
    notFound();
  }

  if (actorDockId && actorDockId !== departure.originDockId) {
    notFound();
  }

  const [docks, boardings] = await Promise.all([
    repo.listDocks(),
    createListDepartureBoardings(repo)({
      departureId: departure.id,
      actorDockId,
    }),
  ]);

  const dockMap = new Map(docks.map((d) => [d.id, d.name]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <DepartureDetailClient
        departure={{
          id: departure.id,
          originDockName: dockMap.get(departure.originDockId) ?? departure.originDockId,
          destinationDockName:
            dockMap.get(departure.destinationDockId) ?? departure.destinationDockId,
          status: departure.status,
          passengerCapacity: departure.passengerCapacity,
          occupiedSeats: departure.occupiedSeats,
          cancelReason: departure.cancelReason ?? null,
        }}
        boardings={boardings}
      />
    </main>
  );
}
