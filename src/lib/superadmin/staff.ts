import { randomInt } from "node:crypto";

import { systemClock } from "@/application/shared/ports";
import { createCreateStaffAccount } from "@/application/staff/create-staff-account";
import {
  createGetStaffAccount,
  createListDocks,
  createListStaff,
} from "@/application/staff/list-staff";
import { createResetStaffPassword } from "@/application/staff/reset-staff-password";
import { createSetStaffStatus } from "@/application/staff/set-staff-status";
import { createUnlockStaffAccount } from "@/application/staff/unlock-staff-account";
import { generateTemporaryPassword } from "@/domain/staff/temporary-password";
import { prismaAuditLogger } from "@/infrastructure/audit/prisma-audit-logger";
import { argon2PasswordHasher } from "@/infrastructure/auth/argon2-password-hasher";
import { prisma } from "@/infrastructure/db/prisma";
import { prismaStaffRepository } from "@/infrastructure/staff/prisma-staff-repository";
import { env } from "@/lib/env";
import { mailer } from "@/lib/mailer";

/**
 * Cuentas del personal (issue #41) armadas con sus implementaciones reales. Solo se usa en el
 * servidor, y siempre después de `assertRole("SUPERADMIN")` o `requireRole("SUPERADMIN")`.
 */
const deps = {
  staff: prismaStaffRepository(prisma),
  audit: prismaAuditLogger(prisma),
  hasher: argon2PasswordHasher,
  // crypto.randomInt es seguro para contraseñas (Math.random no lo es).
  generatePassword: () => generateTemporaryPassword(randomInt),
  mailer,
  clock: systemClock,
  appUrl: env.APP_URL,
};

export const createStaffAccount = createCreateStaffAccount(deps);
export const setStaffStatus = createSetStaffStatus(deps);
export const unlockStaffAccount = createUnlockStaffAccount(deps);
export const resetStaffPassword = createResetStaffPassword(deps);
export const listStaff = createListStaff(deps);
export const getStaffAccount = createGetStaffAccount(deps);
export const listDocks = createListDocks(deps);
