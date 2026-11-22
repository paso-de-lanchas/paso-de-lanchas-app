import { z } from "zod";

import type { AuthSettingsProvider } from "@/application/auth/ports";
import { DEFAULT_LOCKOUT_MINUTES, DEFAULT_MAX_FAILED_LOGINS } from "@/domain/auth/lockout";
import { DEFAULT_STAFF_IDLE_MINUTES } from "@/domain/auth/session-policy";
import type { PrismaClient } from "@/generated/prisma/client";

const positiveInt = z.coerce.number().int().positive();

/** Lee de `system_settings` las reglas del login; si falta una o es inválida, usa el valor por defecto. */
export function prismaAuthSettings(db: PrismaClient): AuthSettingsProvider {
  return {
    async get() {
      const rows = await db.systemSetting.findMany({
        where: {
          key: { in: ["max_failed_logins", "lockout_minutes", "session_timeout_minutes_staff"] },
        },
      });
      const value = (key: string, fallback: number) => {
        const parsed = positiveInt.safeParse(rows.find((r) => r.key === key)?.value);
        return parsed.success ? parsed.data : fallback;
      };
      return {
        maxFailedLogins: value("max_failed_logins", DEFAULT_MAX_FAILED_LOGINS),
        lockoutMinutes: value("lockout_minutes", DEFAULT_LOCKOUT_MINUTES),
        staffIdleMinutes: value("session_timeout_minutes_staff", DEFAULT_STAFF_IDLE_MINUTES),
      };
    },
  };
}
