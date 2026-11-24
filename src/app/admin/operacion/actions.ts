"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth/require-role";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaDepartureRepository } from "@/infrastructure/departures/prisma-departure-repository";
import { PrismaScheduleIncidentRepository } from "@/infrastructure/schedule/prisma-schedule-incident-repository";
import { createEnqueueDeparture } from "@/application/departures/enqueue-departure";
import { createReorderQueue } from "@/application/departures/reorder-queue";
import { createCloseBoarding } from "@/application/departures/close-boarding";
import { createAddToWaitlist } from "@/application/departures/add-to-waitlist";
import { createSetExtraService } from "@/application/schedule/set-extra-service";
import { createReportIncident } from "@/application/incidents/report-incident";
import type { AuditLogger } from "@/application/shared/ports";
import { DomainError } from "@/domain/shared/domain-error";

export interface OperationActionState {
  ok: boolean;
  message: string;
}

const systemClock = {
  now: () => new Date(),
};

const prismaAuditLogger: AuditLogger = {
  log: async (entry) => {
    const client = prisma as unknown as {
      auditLog?: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    };
    if (client.auditLog?.create) {
      await client.auditLog.create({
        data: {
          userId: entry.userId,
          deviceId: entry.deviceId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          details: entry.details ?? {},
        },
      });
    }
  },
};

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

const extraServiceSchema = z.object({
  dockId: z.string().uuid(),
  enabled: z.boolean(),
  reason: z.string().trim().min(1, "El motivo es obligatorio.").max(300),
});

const incidentSchema = z.object({
  vesselId: z.string().uuid(),
  departureId: z.string().uuid().optional().nullable(),
  type: z.string().trim().min(1, "El tipo es obligatorio.").max(40),
  description: z.string().trim().min(1, "La descripción es obligatoria.").max(500),
  action: z.enum(["REASSIGN", "REFUND"]),
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
    const enqueue = createEnqueueDeparture(repo, systemClock);
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
    const reorder = createReorderQueue(repo);
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
    const closeBoarding = createCloseBoarding(repo, systemClock);
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
    const addWaitlist = createAddToWaitlist(repo, systemClock);
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

export async function setExtraServiceAction(
  input: z.infer<typeof extraServiceSchema>,
): Promise<OperationActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = extraServiceSchema.parse(input);
    const actorDockId = await getUserDockId(user.id);
    const repo = new PrismaScheduleIncidentRepository(prisma);
    const setExtra = createSetExtraService(repo, systemClock, prismaAuditLogger);
    const res = await setExtra({
      dockId: parsed.dockId,
      enabled: parsed.enabled,
      reason: parsed.reason,
      actorUserId: user.id,
      actorDockId,
    });
    revalidatePath("/admin/operacion");
    return {
      ok: true,
      message: res.enabled
        ? "Servicio extraordinario habilitado."
        : "Servicio extraordinario deshabilitado.",
    };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
}

export async function reportIncidentAction(
  input: z.infer<typeof incidentSchema>,
): Promise<OperationActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = incidentSchema.parse(input);
    const actorDockId = await getUserDockId(user.id);
    const repo = new PrismaScheduleIncidentRepository(prisma);
    const report = createReportIncident(repo, systemClock, prismaAuditLogger);
    const res = await report({
      vesselId: parsed.vesselId,
      departureId: parsed.departureId || null,
      type: parsed.type,
      description: parsed.description,
      action: parsed.action,
      actorUserId: user.id,
      actorDockId,
    });
    revalidatePath("/admin/operacion");
    return {
      ok: true,
      message:
        parsed.action === "REASSIGN"
          ? `Incidente registrado. Abordajes reasignados a lista de espera prioritaria: ${res.reassignedCount}.`
          : `Incidente registrado. Reembolsos a monedero: ${res.refundedBalanceCount} ($${res.totalRefundedBalance} MXN), efectivo en caja: ${res.cashRefundsReadyCount}.`,
    };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
}
