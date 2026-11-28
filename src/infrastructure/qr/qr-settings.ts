import { z } from "zod";

import { prisma } from "@/infrastructure/db/prisma";

const DEFAULT_STEP_SECONDS = 30;

/** Lee `qr_step_seconds` de system_settings; si falta o es inválido, usa 30. */
export async function getQrStepSeconds(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "qr_step_seconds" } });
  const parsed = z.number().int().min(5).max(300).safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_STEP_SECONDS;
}
