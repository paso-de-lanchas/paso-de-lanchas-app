"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth/require-role";
import { prisma } from "@/infrastructure/db/prisma";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { PrismaDepartureRepository } from "@/infrastructure/departures/prisma-departure-repository";
import { systemClock } from "@/application/shared/ports";
import { createEnqueueDeparture } from "@/application/departures/enqueue-departure";
import { createReorderQueue } from "@/application/departures/reorder-queue";
import { createCloseBoarding } from "@/application/departures/close-boarding";
import { createAddToWaitlist } from "@/application/departures/add-to-waitlist";
import { DomainError } from "@/domain/shared/domain-error";

export interface OperationActionState {
  ok: boolean;
  message: string;
}

const enqueueSchema = z.object({
  vesselId: z.string().uuid(),
  originDockId: z.string().uuid(),
  destinationDockId: z.string().uuid(),
});

const reorderSchema = z.object({
  dockId: z.string().uuid(),
  orderedDepartureIds: z.array(z.string().uuid()).min(1),
});

const closeBoardingSchema = z.object({
  departureId: z.string().uuid(),
});

const waitlistSchema = z.object({
  dockId: z.string().uuid(),
  passengerId: z.string().uuid().optional().nullable(),
  label: z.string().trim().max(80).optional().nullable(),
});

function formatError(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof z.ZodError) return "Datos inválidos en la solicitud.";
  return "Ocurrió un error al procesar la operación.";
}

async function getUserDockId(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { dockId: true },
  });
  return row?.dockId ?? null;
}

export async function enqueueDepartureAction(
  input: z.infer<typeof enqueueSchema>,
): Promise<OperationActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = enqueueSchema.parse(input);
    const actorDockId = await getUserDockId(user.id);
    const repo = new PrismaDepartureRepository(prisma);
    const auditLogger = prismaAuditLogger(prisma);
    const enqueue = createEnqueueDeparture(repo, systemClock, auditLogger);
    await enqueue({
      vesselId: parsed.vesselId,
      originDockId: parsed.originDockId,
      destinationDockId: parsed.destinationDockId,
      actorUserId: user.id,
      actorDockId,
    });
    revalidatePath("/admin/operacion");
    return { ok: true, message: "Embarcación agregada a la operación." };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
}

export async function reorderQueueAction(
  input: z.infer<typeof reorderSchema>,
): Promise<OperationActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = reorderSchema.parse(input);
    const actorDockId = await getUserDockId(user.id);
    const repo = new PrismaDepartureRepository(prisma);
    const auditLogger = prismaAuditLogger(prisma);
    const reorder = createReorderQueue(repo, auditLogger);
    await reorder({
      dockId: parsed.dockId,
      orderedDepartureIds: parsed.orderedDepartureIds,
      actorUserId: user.id,
      actorDockId,
    });
    revalidatePath("/admin/operacion");
    return { ok: true, message: "Orden de la fila actualizado." };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
}

export async function closeBoardingAction(
  input: z.infer<typeof closeBoardingSchema>,
): Promise<OperationActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = closeBoardingSchema.parse(input);
    const actorDockId = await getUserDockId(user.id);
    const repo = new PrismaDepartureRepository(prisma);
    const auditLogger = prismaAuditLogger(prisma);
    const closeBoarding = createCloseBoarding(repo, systemClock, auditLogger);
    const result = await closeBoarding({
      departureId: parsed.departureId,
      actorUserId: user.id,
      actorDockId,
    });
    revalidatePath("/admin/operacion");
    return {
      ok: true,
      message: result.nextBoarding
        ? "Abordaje cerrado; la siguiente embarcación ya está abordando."
        : "Abordaje cerrado.",
    };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
}

export async function addToWaitlistAction(
  input: z.infer<typeof waitlistSchema>,
): Promise<OperationActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = waitlistSchema.parse(input);
    const actorDockId = await getUserDockId(user.id);
    const repo = new PrismaDepartureRepository(prisma);
    const auditLogger = prismaAuditLogger(prisma);
    const addWaitlist = createAddToWaitlist(repo, systemClock, auditLogger);
    await addWaitlist({
      dockId: parsed.dockId,
      passengerId: parsed.passengerId ?? null,
      label: parsed.label ?? null,
      actorUserId: user.id,
      actorDockId,
    });
    revalidatePath("/admin/operacion");
    return { ok: true, message: "Registro agregado a la lista de espera." };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
}
