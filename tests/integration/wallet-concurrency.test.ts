/**
 * Verifica que dos recargas simultáneas actualicen el saldo y el libro de movimientos sin
 * perder ninguna operación. Requiere `docker compose up -d` y `npm run db:test:prepare`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ChangeAudit } from "@/application/shared/ports";
import { createTopUpCash } from "@/application/wallet/top-up-cash";
import type { WalletMovementInput } from "@/application/wallet/ports";
import { Money } from "@/domain/shared/money";
import type { Prisma } from "@/generated/prisma/client";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";

const url = process.env.DATABASE_URL_TEST;
const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

class AnonymousAuditWalletRepository extends PrismaWalletRepository {
  override credit(tx: Prisma.TransactionClient, input: WalletMovementInput, audit: ChangeAudit) {
    return super.credit(tx, input, { ...audit, userId: null });
  }
}

describe.skipIf(!prisma)("recargas de monedero concurrentes", () => {
  const db = prisma!;
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const passengerEmail = `wallet-passenger-${suffix}@pasolanchas.test`;
  const adminEmail = `wallet-admin-${suffix}@pasolanchas.test`;
  const dockCode = `WT${suffix.slice(0, 7)}`;
  let passengerId: string | null = null;
  let adminId: string | null = null;
  let dockId: string | null = null;
  let deviceId: string | null = null;

  beforeAll(async () => {
    const dock = await db.dock.create({
      data: {
        code: dockCode,
        name: "Muelle de prueba",
        latitude: "18.149700",
        longitude: "-94.434900",
      },
    });
    dockId = dock.id;
    const admin = await db.user.create({
      data: {
        email: adminEmail,
        fullName: "Admin de prueba",
        passwordHash: "test-hash",
        role: "ADMIN",
        status: "ACTIVE",
        dockId: dock.id,
      },
    });
    adminId = admin.id;
    const device = await db.authorizedDevice.create({
      data: {
        dockId: dock.id,
        name: "Equipo de prueba",
        deviceTokenHash: `wallet-device-${suffix}`,
        status: "APPROVED",
        requestedById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    });
    deviceId = device.id;
    const passenger = await db.user.create({
      data: {
        email: passengerEmail,
        fullName: "Pasajero de prueba",
        passwordHash: "test-hash",
        role: "PASSENGER",
        status: "ACTIVE",
      },
    });
    passengerId = passenger.id;
    await db.wallet.create({ data: { userId: passenger.id } });
  });

  afterAll(async () => {
    if (passengerId) {
      const wallet = await db.wallet.findUnique({
        where: { userId: passengerId },
        select: { id: true },
      });
      if (wallet) {
        await db.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
        await db.cashShift.deleteMany({ where: { adminId: adminId ?? "" } });
        await db.wallet.delete({ where: { id: wallet.id } });
      }
    }
    if (deviceId) await db.authorizedDevice.delete({ where: { id: deviceId } });
    if (passengerId) await db.user.delete({ where: { id: passengerId } });
    if (adminId) await db.user.delete({ where: { id: adminId } });
    if (dockId) await db.dock.delete({ where: { id: dockId } });
    await db.$disconnect();
  });

  it("preserva ambas recargas, el saldo acumulado y un solo turno de caja", async () => {
    const repo = new AnonymousAuditWalletRepository(db);
    const topUpCash = createTopUpCash({ repo });
    const actor = { adminId: adminId!, deviceId: deviceId! };

    const topUps = await Promise.all([
      topUpCash({ passengerId, amount: "10.00" }, actor),
      topUpCash({ passengerId, amount: "10.00" }, actor),
    ]);

    const wallet = await db.wallet.findUniqueOrThrow({ where: { userId: passengerId! } });
    const transactions = await db.walletTransaction.findMany({
      where: { walletId: wallet.id },
    });
    const shifts = await db.cashShift.findMany({ where: { adminId: adminId! } });
    const auditEntries = await db.auditLog.findMany({
      where: {
        entity: "wallet_transactions",
        entityId: { in: topUps.map(({ id }) => id) },
      },
    });

    expect(wallet.balance.toString()).toBe("20");
    expect(wallet.version).toBe(2);
    expect(transactions).toHaveLength(2);
    expect(transactions.every((item) => item.type === "TOPUP_CASH")).toBe(true);
    expect(transactions.every((item) => item.cashShiftId === shifts[0]?.id)).toBe(true);
    expect(shifts).toHaveLength(1);
    expect(auditEntries).toHaveLength(2);
    expect(auditEntries.every((entry) => entry.action === "WALLET_TOPUP_CASH")).toBe(true);
    expect(auditEntries.every((entry) => entry.userId === null)).toBe(true);
  });

  it("rolls back the movement when inserting its audit entry fails", async () => {
    const repo = new AnonymousAuditWalletRepository(db);
    const walletBefore = await db.wallet.findUniqueOrThrow({
      where: { userId: passengerId! },
    });
    const transactionCountBefore = await db.walletTransaction.count({
      where: { walletId: walletBefore.id },
    });
    const shiftCountBefore = await db.cashShift.count({ where: { adminId: adminId! } });

    await expect(
      repo.withTransaction(async (tx) => {
        const at = new Date();
        const cashShiftId = await repo.ensureOpenCashShift(tx, {
          adminId: adminId!,
          deviceId: deviceId!,
          at,
        });
        return repo.credit(
          tx,
          {
            userId: passengerId!,
            amount: Money.fromPesos("5.00"),
            type: "TOPUP_CASH",
            performedById: adminId!,
            at,
            reason: "Prueba de rollback",
            cashShiftId,
          },
          {
            userId: null,
            action: "A".repeat(61),
            details: { passengerId },
          },
        );
      }),
    ).rejects.toThrow();

    const walletAfter = await db.wallet.findUniqueOrThrow({
      where: { userId: passengerId! },
    });
    expect(walletAfter.balance.toString()).toBe(walletBefore.balance.toString());
    expect(walletAfter.version).toBe(walletBefore.version);
    expect(await db.walletTransaction.count({ where: { walletId: walletBefore.id } })).toBe(
      transactionCountBefore,
    );
    expect(await db.cashShift.count({ where: { adminId: adminId! } })).toBe(shiftCountBefore);
  });
});
