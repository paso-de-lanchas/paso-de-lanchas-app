import { z } from "zod";

import { createConfirmOnlinePayment } from "@/application/payments/confirm-online-payment";
import { systemClock } from "@/application/shared/ports";
import { createMercadoPagoGateway } from "@/infrastructure/payments/mercado-pago-gateway";
import { PrismaPaymentRepository } from "@/infrastructure/payments/prisma-payment-repository";
import { env } from "@/lib/env";

const webhookBodySchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    data: z.object({ id: z.union([z.string(), z.number()]).optional() }).optional(),
  })
  .passthrough();

export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsedBody = webhookBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return Response.json({ error: "INVALID_WEBHOOK_BODY" }, { status: 400 });
  }

  const url = new URL(request.url);
  const eventType =
    url.searchParams.get("type") ??
    parsedBody.data.type ??
    parsedBody.data.action?.split(".")[0] ??
    null;
  if (eventType !== "payment") return Response.json({ received: true });

  const confirmOnlinePayment = createConfirmOnlinePayment({
    payments: new PrismaPaymentRepository(),
    gateway: createMercadoPagoGateway({
      accessToken: env.MP_ACCESS_TOKEN,
      webhookSecret: env.MP_WEBHOOK_SECRET,
      appUrl: env.APP_URL,
    }),
    clock: systemClock,
  });
  const result = await confirmOnlinePayment({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId:
      url.searchParams.get("data.id") ??
      (parsedBody.data.data?.id === undefined ? null : String(parsedBody.data.data.id)),
  });

  return Response.json({ received: true, result });
}
