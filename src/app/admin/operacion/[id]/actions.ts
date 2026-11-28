"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth/require-role";
import { prisma } from "@/infrastructure/db/prisma";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { PrismaDepartureRepository } from "@/infrastructure/departures/prisma-departure-repository";
import { createCancelDeparture } from "@/application/departures/cancel-departure";
import { DomainError } from "@/domain/shared/domain-error";

export interface CancelDepartureActionState {
  ok: boolean;
  message: string;
}

const systemClock = {
  now: () => new Date(),
};

const cancelSchema = z.object({
  departureId: z.string().uuid(),
  cancelReason: z.string().trim().min(1, "El motivo es obligatorio.").max(300),
});

function formatCancelError(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof z.ZodError) {
    return "Debes ingresar un motivo válido y un identificador de salida correcto.";
  }
  return "No se pudo cancelar la salida.";
}

export async function cancelDepartureAction(
  input: z.infer<typeof cancelSchema>,
): Promise<CancelDepartureActionState> {
  const user = await assertRole("ADMIN");
  try {
    const parsed = cancelSchema.parse(input);
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { dockId: true },
    });
    const actorDockId = dbUser?.dockId ?? null;

    const repo = new PrismaDepartureRepository(prisma);
    const audit = prismaAuditLogger(prisma);
    const cancelUseCase = createCancelDeparture(repo, systemClock, audit);
    const result = await cancelUseCase({
      departureId: parsed.departureId,
      cancelReason: parsed.cancelReason,
      actorUserId: user.id,
      actorDockId,
    });

    revalidatePath("/admin/operacion");
    revalidatePath(`/admin/operacion/${parsed.departureId}`);

    return {
      ok: true,
      message: `Salida cancelada. Abordajes cancelados: ${result.cancelledBoardingsCount}, reembolsos a monedero: ${result.refundedBalanceCount} ($${result.totalRefundedBalance} MXN), devoluciones en caja: ${result.cashRefundsReady.length}.`,
    };
  } catch (err) {
    return { ok: false, message: formatCancelError(err) };
  }
}
