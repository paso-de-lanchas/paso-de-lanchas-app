"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSetFare } from "@/application/fares/set-fare";
import { DomainError } from "@/domain/shared/domain-error";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { prismaFareRepository } from "@/infrastructure/fares/prisma-fare-repository";
import { prisma } from "@/infrastructure/db/prisma";
import { assertRole } from "@/lib/auth/require-role";

export async function setFareAction(formData: FormData) {
  const user = await assertRole("ADMIN");
  const fares = prismaFareRepository(prisma);

  try {
    await createSetFare({
      fares,
      audit: prismaAuditLogger(prisma),
      clock: { now: () => new Date() },
    })(
      {
        vesselKind: formData.get("vesselKind"),
        category: formData.get("category"),
        vehicleTypeId: formData.get("vehicleTypeId") ? Number(formData.get("vehicleTypeId")) : null,
        amount: formData.get("amount"),
      },
      user.id,
    );
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    redirect(`/admin/tarifas?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/tarifas");
  redirect("/admin/tarifas?guardada=1");
}
