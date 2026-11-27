"use server";

import { redirect } from "next/navigation";

import { createStartOnlineTopUp } from "@/application/payments/start-online-top-up";
import { DomainError } from "@/domain/shared/domain-error";
import { createMercadoPagoGateway } from "@/infrastructure/payments/mercado-pago-gateway";
import { PrismaPaymentRepository } from "@/infrastructure/payments/prisma-payment-repository";
import { env } from "@/lib/env";
import { assertRole } from "@/lib/auth/require-role";

export interface OnlineTopUpActionState {
  status: "idle" | "error";
  message?: string;
}

export async function startOnlineTopUpAction(
  _previousState: OnlineTopUpActionState,
  formData: FormData,
): Promise<OnlineTopUpActionState> {
  const passenger = await assertRole("PASSENGER");

  try {
    const result = await createStartOnlineTopUp({
      payments: new PrismaPaymentRepository(),
      gateway: createMercadoPagoGateway({
        accessToken: env.MP_ACCESS_TOKEN,
        webhookSecret: env.MP_WEBHOOK_SECRET,
        appUrl: env.APP_URL,
      }),
      clock: { now: () => new Date() },
    })({ amount: formData.get("amount") }, passenger.id, passenger.email);
    redirect(result.redirectUrl);
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
