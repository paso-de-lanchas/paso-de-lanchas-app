import { describe, expect, it } from "vitest";

import type { ChangeAudit, Clock } from "@/application/shared/ports";
import { InputError } from "@/application/shared/input-error";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import { applyCredit, applyDebit, DEFAULT_TOP_UP_LIMITS } from "@/domain/wallet/wallet";

import { createAdjustBalance } from "./adjust-balance";
import { createGetBalance } from "./get-balance";
import { createGetTopUpLimits } from "./get-top-up-limits";
import { createGetTransaction } from "./get-transaction";
import { createListTransactions } from "./list-transactions";
import type {
  PassengerWalletSummary,
  WalletMovementInput,
  WalletRepository,
  WalletTransactionItem,
} from "./ports";
import { createSearchPassenger } from "./search-passenger";
import { createTopUpCash } from "./top-up-cash";

const PASSENGER_ID = "00000000-0000-4000-8000-000000000001";
const TRANSACTION_ID = "00000000-0000-4000-8000-000000000002";
const fixedNow = new Date("2026-11-23T12:00:00.000Z");
const clock: Clock = { now: () => fixedNow };

class FakeWalletRepository implements WalletRepository<string> {
  balanceCents = 1000;
  fare: Money | null = Money.fromPesos("12.00");
  passenger: PassengerWalletSummary | null = {
    id: PASSENGER_ID,
    fullName: "Ana Pasajera",
    email: "ana@example.test",
    phone: "9211234567",
    balanceCents: 1000,
  };
  transactions: WalletTransactionItem[] = [];
  topUpLimits = DEFAULT_TOP_UP_LIMITS;
  creditConflicts = 0;
  creditFailure: Error | null = null;
  lastSearchContact: string | null = null;
  shiftCalls = 0;
  creditCalls = 0;
  debitCalls = 0;
  transactionCalls = 0;
  transactionReceipt = null;
  auditEntries: ChangeAudit[] = [];

  async withTransaction<T>(work: (tx: string) => Promise<T>): Promise<T> {
    this.transactionCalls++;
    return work("transaction");
  }

  async findByUserId(userId: string) {
    if (userId !== PASSENGER_ID) return null;
    return { id: "wallet-1", userId, balanceCents: this.balanceCents, version: 0 };
  }

  async findPassengerByContact(contact: string) {
    this.lastSearchContact = contact;
    return this.passenger;
  }

  async findPassengerById(userId: string) {
    return userId === this.passenger?.id ? this.passenger : null;
  }

  async listTransactions(_userId: string, page: number) {
    return {
      items: this.transactions,
      page,
      pageSize: 20,
      totalItems: this.transactions.length,
      totalPages: Math.ceil(this.transactions.length / 20),
    };
  }

  async findTransactionById(id: string) {
    if (id !== TRANSACTION_ID) return null;
    return this.transactionReceipt;
  }

  async getTopUpLimits() {
    return this.topUpLimits;
  }

  async getCurrentGeneralBoatFare() {
    return this.fare;
  }

  async ensureOpenCashShift() {
    this.shiftCalls++;
    return "shift-1";
  }

  async credit(_tx: string, input: WalletMovementInput, audit: ChangeAudit) {
    this.creditCalls++;
    if (this.creditFailure) throw this.creditFailure;
    if (this.creditConflicts > 0) {
      this.creditConflicts--;
      throw new DomainError("CONCURRENT_UPDATE", "Conflicto de prueba.");
    }
    this.balanceCents = applyCredit(Money.fromCents(this.balanceCents), input.amount).cents;
    const transaction = this.createTransaction(input, input.amount.cents);
    this.auditEntries.push(audit);
    return transaction;
  }

  async debit(_tx: string, input: WalletMovementInput, audit: ChangeAudit) {
    this.debitCalls++;
    this.balanceCents = applyDebit(Money.fromCents(this.balanceCents), input.amount).cents;
    const transaction = this.createTransaction(input, -input.amount.cents);
    this.auditEntries.push(audit);
    return transaction;
  }

  private createTransaction(input: WalletMovementInput, amountCents: number) {
    const item = {
      id: TRANSACTION_ID,
      type: input.type,
      amountCents,
      balanceAfterCents: this.balanceCents,
      reason: input.reason,
      createdAt: input.at,
      dockName: "Coatzacoalcos",
      walletUserId: input.userId,
    } as const;
    this.transactions.unshift(item);
    return item;
  }
}

describe("wallet use cases", () => {
  it("returns current balance and warns only when below the general fare", async () => {
    const repo = new FakeWalletRepository();
    const getBalance = createGetBalance({ repo, clock });

    await expect(getBalance(PASSENGER_ID)).resolves.toEqual({
      balanceCents: 1000,
      currentGeneralFareCents: 1200,
      belowGeneralFare: true,
    });

    repo.fare = null;
    await expect(getBalance(PASSENGER_ID)).resolves.toMatchObject({
      balanceCents: 1000,
      belowGeneralFare: false,
    });
    repo.fare = Money.fromPesos("12.00");
    repo.balanceCents = 1500;
    await expect(getBalance(PASSENGER_ID)).resolves.toMatchObject({ belowGeneralFare: false });
    await expect(getBalance("missing")).rejects.toMatchObject({ code: "WALLET_NOT_FOUND" });
  });

  it("validates the page before listing transaction history", async () => {
    const repo = new FakeWalletRepository();
    repo.transactions.push({
      id: TRANSACTION_ID,
      type: "TOPUP_CASH",
      amountCents: 1000,
      balanceAfterCents: 1000,
      reason: "Recarga en efectivo",
      createdAt: fixedNow,
      dockName: "Coatzacoalcos",
    });
    const listTransactions = createListTransactions(repo);

    await expect(listTransactions(PASSENGER_ID, "2")).resolves.toMatchObject({
      page: 2,
      totalItems: 1,
      items: [{ type: "TOPUP_CASH" }],
    });
    await expect(listTransactions(PASSENGER_ID, "0")).rejects.toBeInstanceOf(InputError);
  });

  it("normalizes email and Mexican phone searches and rejects invalid contacts", async () => {
    const repo = new FakeWalletRepository();
    const searchPassenger = createSearchPassenger(repo);

    await searchPassenger({ contact: " ANA@EXAMPLE.TEST " });
    expect(repo.lastSearchContact).toBe("ana@example.test");
    await searchPassenger({ contact: "+52 (921) 123-4567" });
    expect(repo.lastSearchContact).toBe("9211234567");
    await expect(searchPassenger({ contact: "not a contact" })).rejects.toBeInstanceOf(InputError);
  });

  it("returns configured top-up limits in cents", async () => {
    const repo = new FakeWalletRepository();
    await expect(createGetTopUpLimits(repo)()).resolves.toEqual({
      minCents: 1000,
      maxCents: 200000,
    });
  });

  it("performs a cash top-up, opens a shift, and audits the movement", async () => {
    const repo = new FakeWalletRepository();
    const topUpCash = createTopUpCash({ repo, clock });

    const transaction = await topUpCash(
      { passengerId: PASSENGER_ID, amount: "20.50" },
      { adminId: "admin-1", deviceId: "device-1" },
    );

    expect(repo.balanceCents).toBe(3050);
    expect(repo.shiftCalls).toBe(1);
    expect(transaction).toMatchObject({
      type: "TOPUP_CASH",
      amountCents: 2050,
      balanceAfterCents: 3050,
      reason: "Recarga en efectivo",
    });
    expect(repo.auditEntries).toEqual([
      {
        userId: "admin-1",
        action: "WALLET_TOPUP_CASH",
        details: {
          passengerId: PASSENGER_ID,
          amountCents: 2050,
          cashShiftId: "shift-1",
        },
      },
    ]);
  });

  it("retries concurrent updates without duplicating audit entries", async () => {
    const repo = new FakeWalletRepository();
    repo.creditConflicts = 1;
    const topUpCash = createTopUpCash({ repo, clock });

    await topUpCash(
      { passengerId: PASSENGER_ID, amount: "10" },
      {
        adminId: "admin-1",
        deviceId: "device-1",
      },
    );

    expect(repo.transactionCalls).toBe(2);
    expect(repo.balanceCents).toBe(2000);
    expect(repo.auditEntries).toHaveLength(1);
  });

  it("rejects out-of-range cash top-ups and missing passengers", async () => {
    const repo = new FakeWalletRepository();
    const topUpCash = createTopUpCash({ repo, clock });

    await expect(
      topUpCash(
        { passengerId: PASSENGER_ID, amount: "9.99" },
        {
          adminId: "admin-1",
          deviceId: "device-1",
        },
      ),
    ).rejects.toMatchObject({ code: "TOPUP_BELOW_MINIMUM" });

    await expect(
      topUpCash(
        { passengerId: "00000000-0000-4000-8000-000000000099", amount: "10" },
        {
          adminId: "admin-1",
          deviceId: "device-1",
        },
      ),
    ).rejects.toMatchObject({ code: "PASSENGER_NOT_FOUND" });
    expect(repo.shiftCalls).toBe(0);
  });

  it("reports a conflict after exhausting retries", async () => {
    const repo = new FakeWalletRepository();
    repo.creditConflicts = 3;
    const topUpCash = createTopUpCash({ repo, clock });

    await expect(
      topUpCash(
        { passengerId: PASSENGER_ID, amount: "10" },
        {
          adminId: "admin-1",
          deviceId: "device-1",
        },
      ),
    ).rejects.toMatchObject({ code: "CONCURRENT_UPDATE" });
    expect(repo.transactionCalls).toBe(3);
  });

  it("propagates unexpected repository failures instead of retrying", async () => {
    const repo = new FakeWalletRepository();
    const failure = new Error("database unavailable");
    repo.creditFailure = failure;
    const topUpCash = createTopUpCash({ repo, clock });

    await expect(
      topUpCash(
        { passengerId: PASSENGER_ID, amount: "10" },
        {
          adminId: "admin-1",
          deviceId: "device-1",
        },
      ),
    ).rejects.toBe(failure);
    expect(repo.transactionCalls).toBe(1);
  });

  it("credits refunds and debits adjustments with a mandatory reason", async () => {
    const repo = new FakeWalletRepository();
    const adjustBalance = createAdjustBalance({ repo, clock });

    await adjustBalance(
      {
        passengerId: PASSENGER_ID,
        type: "REFUND",
        direction: "CREDIT",
        amount: "5",
        reason: "Reembolso autorizado",
      },
      "admin-1",
    );
    const adjustment = await adjustBalance(
      {
        passengerId: PASSENGER_ID,
        type: "ADJUSTMENT",
        direction: "DEBIT",
        amount: "2.50",
        reason: "Corrección de saldo",
      },
      "admin-1",
    );

    expect(repo.balanceCents).toBe(1250);
    expect(adjustment.amountCents).toBe(-250);
    expect(repo.debitCalls).toBe(1);
    expect(repo.auditEntries).toEqual([
      {
        userId: "admin-1",
        action: "WALLET_REFUND",
        details: {
          passengerId: PASSENGER_ID,
          amountCents: 500,
          reason: "Reembolso autorizado",
        },
      },
      {
        userId: "admin-1",
        action: "WALLET_ADJUSTED",
        details: {
          passengerId: PASSENGER_ID,
          amountCents: -250,
          reason: "Corrección de saldo",
        },
      },
    ]);
  });

  it("rejects a refund debit and an adjustment without a reason", async () => {
    const repo = new FakeWalletRepository();
    const adjustBalance = createAdjustBalance({ repo, clock });

    await expect(
      adjustBalance(
        {
          passengerId: PASSENGER_ID,
          type: "REFUND",
          direction: "DEBIT",
          amount: "5",
          reason: "No válido",
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({ code: "INVALID_REFUND_DIRECTION" });

    await expect(
      adjustBalance(
        {
          passengerId: PASSENGER_ID,
          type: "ADJUSTMENT",
          direction: "CREDIT",
          amount: "5",
          reason: " ",
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("retries concurrent adjustments and rejects missing passengers", async () => {
    const repo = new FakeWalletRepository();
    repo.creditConflicts = 1;
    const adjustBalance = createAdjustBalance({ repo, clock });
    await adjustBalance(
      {
        passengerId: PASSENGER_ID,
        type: "ADJUSTMENT",
        direction: "CREDIT",
        amount: "1",
        reason: "Corrección",
      },
      "admin-1",
    );
    expect(repo.transactionCalls).toBe(2);

    await expect(
      adjustBalance(
        {
          passengerId: "00000000-0000-4000-8000-000000000099",
          type: "ADJUSTMENT",
          direction: "CREDIT",
          amount: "1",
          reason: "Corrección",
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({ code: "PASSENGER_NOT_FOUND" });
  });

  it("propagates unexpected adjustment repository failures", async () => {
    const repo = new FakeWalletRepository();
    const failure = new Error("database unavailable");
    repo.creditFailure = failure;
    const adjustBalance = createAdjustBalance({ repo, clock });

    await expect(
      adjustBalance(
        {
          passengerId: PASSENGER_ID,
          type: "ADJUSTMENT",
          direction: "CREDIT",
          amount: "1",
          reason: "Corrección",
        },
        "admin-1",
      ),
    ).rejects.toBe(failure);
  });

  it("validates transaction identifiers before fetching receipts", async () => {
    const repo = new FakeWalletRepository();
    const getTransaction = createGetTransaction(repo);

    await expect(getTransaction(TRANSACTION_ID)).resolves.toBeNull();
    await expect(getTransaction("invalid")).rejects.toBeInstanceOf(InputError);
  });
});
