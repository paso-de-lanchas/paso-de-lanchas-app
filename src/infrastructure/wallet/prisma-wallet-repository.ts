import type { ChangeAudit } from "@/application/shared/ports";
import type {
  OpenCashShiftInput,
  PassengerWalletSummary,
  WalletMovementInput,
  WalletRecord,
  WalletRepository,
  WalletTransactionItem,
  WalletTransactionPage,
  WalletTransactionReceipt,
} from "@/application/wallet/ports";
import { buildRechargeCreditedNotification } from "@/domain/notifications/notification";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import {
  applyCredit,
  applyDebit,
  DEFAULT_TOP_UP_LIMITS,
  validateTopUpLimits,
} from "@/domain/wallet/wallet";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { auditLogData } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { createNotificationInTx } from "@/infrastructure/notifications/prisma-notification-repository";

const PAGE_SIZE = 20;

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  balanceAfter: true,
  reason: true,
  createdAt: true,
  cashShift: {
    select: {
      id: true,
      dock: { select: { name: true } },
    },
  },
  sale: {
    select: {
      cashShift: {
        select: {
          dock: { select: { name: true } },
        },
      },
    },
  },
} as const;

function mapTransaction(row: {
  id: string;
  type: WalletTransactionItem["type"];
  amount: { toString(): string };
  balanceAfter: { toString(): string };
  reason: string | null;
  createdAt: Date;
  cashShift: { id: string; dock: { name: string } } | null;
  sale: { cashShift: { dock: { name: string } } | null } | null;
}): WalletTransactionItem {
  return {
    id: row.id,
    type: row.type,
    amountCents: Money.fromPesos(row.amount).cents,
    balanceAfterCents: Money.fromPesos(row.balanceAfter).cents,
    reason: row.reason,
    createdAt: row.createdAt,
    dockName: row.cashShift?.dock.name ?? row.sale?.cashShift?.dock.name ?? null,
  };
}

function mapPassenger(row: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  wallet: { balance: { toString(): string } } | null;
}): PassengerWalletSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    balanceCents: row.wallet ? Money.fromPesos(row.wallet.balance).cents : 0,
  };
}

function readSettingMoney(value: unknown, key: string): Money {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new DomainError(
      "INVALID_TOPUP_SETTINGS",
      `La configuración ${key} no es un monto válido.`,
    );
  }
  const amount = Money.fromPesos(value);
  if (amount.isNegative()) {
    throw new DomainError(
      "INVALID_TOPUP_SETTINGS",
      `La configuración ${key} no puede ser negativa.`,
    );
  }
  return amount;
}

export class PrismaWalletRepository implements WalletRepository<Prisma.TransactionClient> {
  constructor(private readonly db: PrismaClient = prisma) {}

  withTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(work);
  }

  async findByUserId(userId: string): Promise<WalletRecord | null> {
    const wallet = await this.db.wallet.findUnique({
      where: { userId },
      select: { id: true, userId: true, balance: true, version: true },
    });
    if (!wallet) return null;
    return {
      id: wallet.id,
      userId: wallet.userId,
      balanceCents: Money.fromPesos(wallet.balance).cents,
      version: wallet.version,
    };
  }

  async findPassengerByContact(contact: string): Promise<PassengerWalletSummary | null> {
    const where = {
      role: "PASSENGER" as const,
      status: "ACTIVE" as const,
      deletedAt: null,
      ...(contact.includes("@") ? { email: contact } : { phone: contact }),
    };
    const passenger = await this.db.user.findFirst({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        wallet: { select: { balance: true } },
      },
    });
    return passenger ? mapPassenger(passenger) : null;
  }

  async findPassengerById(userId: string): Promise<PassengerWalletSummary | null> {
    const passenger = await this.db.user.findFirst({
      where: {
        id: userId,
        role: "PASSENGER",
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        wallet: { select: { balance: true } },
      },
    });
    return passenger?.wallet ? mapPassenger(passenger) : null;
  }

  async listTransactions(userId: string, page: number): Promise<WalletTransactionPage> {
    const wallet = await this.db.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!wallet) {
      throw new DomainError("WALLET_NOT_FOUND", "No se encontró el monedero del pasajero.");
    }

    const [rows, totalItems] = await Promise.all([
      this.db.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: transactionSelect,
      }),
      this.db.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      items: rows.map(mapTransaction),
      page,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages: Math.ceil(totalItems / PAGE_SIZE),
    };
  }

  async findTransactionById(id: string): Promise<WalletTransactionReceipt | null> {
    const row = await this.db.walletTransaction.findUnique({
      where: { id },
      select: {
        ...transactionSelect,
        wallet: {
          select: {
            userId: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        performedById: true,
        performedBy: { select: { fullName: true } },
      },
    });
    if (!row) return null;

    return {
      ...mapTransaction(row),
      walletUserId: row.wallet.userId,
      passengerName: row.wallet.user.fullName,
      passengerEmail: row.wallet.user.email,
      performedById: row.performedById,
      performedByName: row.performedBy?.fullName ?? null,
      cashShiftId: row.cashShift?.id ?? null,
    };
  }

  async getTopUpLimits() {
    const settings = await this.db.systemSetting.findMany({
      where: { key: { in: ["topup_min", "topup_max"] } },
      select: { key: true, value: true },
    });
    const values = new Map(settings.map((setting) => [setting.key, setting.value]));
    const limits = {
      min: values.has("topup_min")
        ? readSettingMoney(values.get("topup_min"), "topup_min")
        : DEFAULT_TOP_UP_LIMITS.min,
      max: values.has("topup_max")
        ? readSettingMoney(values.get("topup_max"), "topup_max")
        : DEFAULT_TOP_UP_LIMITS.max,
    };
    validateTopUpLimits(limits);
    return limits;
  }

  async getCurrentGeneralBoatFare(at: Date): Promise<Money | null> {
    const fare = await this.db.fare.findFirst({
      where: {
        vesselKind: "BOAT",
        category: "GENERAL",
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
      },
      orderBy: { validFrom: "desc" },
      select: { amount: true },
    });
    return fare ? Money.fromPesos(fare.amount) : null;
  }

  async ensureOpenCashShift(
    tx: Prisma.TransactionClient,
    input: OpenCashShiftInput,
  ): Promise<string> {
    const admin = await tx.user.findFirst({
      where: { id: input.adminId, role: "ADMIN", status: "ACTIVE", deletedAt: null },
      select: { dockId: true },
    });
    if (!admin?.dockId) {
      throw new DomainError(
        "ADMIN_DOCK_REQUIRED",
        "La cuenta administradora no tiene un muelle asignado.",
      );
    }

    const device = await tx.authorizedDevice.findFirst({
      where: { id: input.deviceId, dockId: admin.dockId, status: "APPROVED" },
      select: { id: true },
    });
    if (!device) {
      throw new DomainError(
        "AUTHORIZED_DEVICE_REQUIRED",
        "La recarga debe hacerse desde una computadora autorizada para este muelle.",
      );
    }

    await tx.$executeRaw`
      INSERT INTO "cash_shifts" ("admin_id", "dock_id", "device_id", "opened_at")
      VALUES (${input.adminId}::uuid, ${admin.dockId}::uuid, ${input.deviceId}::uuid, ${input.at})
      ON CONFLICT ("admin_id") WHERE "closed_at" IS NULL DO NOTHING
    `;

    const cashShift = await tx.cashShift.findFirst({
      where: { adminId: input.adminId, closedAt: null },
      select: { id: true },
    });
    if (!cashShift) {
      throw new Error("No se pudo abrir o recuperar el turno de caja.");
    }
    return cashShift.id;
  }

  credit(
    tx: Prisma.TransactionClient,
    input: WalletMovementInput,
    audit: ChangeAudit,
  ): Promise<WalletTransactionItem & { walletUserId: string }> {
    if (input.type === "FARE_CHARGE") {
      throw new DomainError("INVALID_TRANSACTION_TYPE", "Un cobro de cruce debe ser un débito.");
    }
    if (input.type === "TOPUP_CASH" && !input.cashShiftId) {
      throw new DomainError(
        "CASH_SHIFT_REQUIRED",
        "La recarga en efectivo necesita turno de caja.",
      );
    }
    return this.move(tx, input, "CREDIT", audit);
  }

  debit(
    tx: Prisma.TransactionClient,
    input: WalletMovementInput,
    audit: ChangeAudit,
  ): Promise<WalletTransactionItem & { walletUserId: string }> {
    if (input.type !== "FARE_CHARGE" && input.type !== "ADJUSTMENT") {
      throw new DomainError(
        "INVALID_TRANSACTION_TYPE",
        "Este movimiento no puede debitar el monedero.",
      );
    }
    return this.move(tx, input, "DEBIT", audit);
  }

  private async move(
    tx: Prisma.TransactionClient,
    input: WalletMovementInput,
    direction: "CREDIT" | "DEBIT",
    audit: ChangeAudit,
  ): Promise<WalletTransactionItem & { walletUserId: string }> {
    const wallet = await tx.wallet.findUnique({
      where: { userId: input.userId },
      select: {
        id: true,
        balance: true,
        version: true,
        user: {
          select: {
            role: true,
            status: true,
            deletedAt: true,
            notificationsEnabled: true,
          },
        },
      },
    });
    if (!wallet) {
      throw new DomainError("WALLET_NOT_FOUND", "No se encontró el monedero del pasajero.");
    }
    if (
      wallet.user.role !== "PASSENGER" ||
      wallet.user.status !== "ACTIVE" ||
      wallet.user.deletedAt !== null
    ) {
      throw new DomainError("PASSENGER_NOT_ACTIVE", "El pasajero no tiene una cuenta activa.");
    }

    const currentBalance = Money.fromPesos(wallet.balance);
    const balanceAfter =
      direction === "CREDIT"
        ? applyCredit(currentBalance, input.amount)
        : applyDebit(currentBalance, input.amount);

    const updated = await tx.wallet.updateMany({
      where: { id: wallet.id, version: wallet.version },
      data: {
        balance: balanceAfter.toDecimalString(),
        version: { increment: 1 },
        updatedAt: input.at,
      },
    });
    if (updated.count !== 1) {
      throw new DomainError(
        "CONCURRENT_UPDATE",
        "El saldo cambió al mismo tiempo desde otra operación.",
      );
    }

    const signedAmount =
      direction === "CREDIT" ? input.amount : Money.fromCents(-input.amount.cents);
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: input.type,
        amount: signedAmount.toDecimalString(),
        balanceAfter: balanceAfter.toDecimalString(),
        performedById: input.performedById,
        reason: input.reason,
        cashShiftId: input.cashShiftId ?? null,
        saleId: input.saleId ?? null,
        paymentId: input.paymentId ?? null,
        createdAt: input.at,
      },
      select: { ...transactionSelect, walletId: true },
    });
    await tx.auditLog.create({
      data: auditLogData({
        ...audit,
        entity: "wallet_transactions",
        entityId: transaction.id,
      }),
    });

    if (
      direction === "CREDIT" &&
      (input.type === "TOPUP_CASH" || input.type === "TOPUP_ONLINE") &&
      wallet.user.notificationsEnabled
    ) {
      await createNotificationInTx(tx, {
        userId: input.userId,
        draft: buildRechargeCreditedNotification({
          amountCents: input.amount.cents,
          method: input.type === "TOPUP_CASH" ? "CASH" : "ONLINE",
          balanceAfterCents: balanceAfter.cents,
        }),
        createdAt: input.at,
      });
    }

    return { ...mapTransaction(transaction), walletUserId: input.userId };
  }
}
