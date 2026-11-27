import type { ChangeAudit } from "@/application/shared/ports";
import type { Money } from "@/domain/shared/money";
import type { TopUpLimits } from "@/domain/wallet/wallet";

export type WalletTransactionType =
  "TOPUP_CASH" | "TOPUP_ONLINE" | "FARE_CHARGE" | "REFUND" | "ADJUSTMENT";

export type WalletAdjustmentDirection = "CREDIT" | "DEBIT";

export interface WalletRecord {
  id: string;
  userId: string;
  balanceCents: number;
  version: number;
}

export interface PassengerWalletSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  balanceCents: number;
}

export interface WalletTransactionItem {
  id: string;
  type: WalletTransactionType;
  amountCents: number;
  balanceAfterCents: number;
  reason: string | null;
  createdAt: Date;
  dockName: string | null;
}

export interface WalletTransactionPage {
  items: WalletTransactionItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface WalletTransactionReceipt extends WalletTransactionItem {
  walletUserId: string;
  passengerName: string;
  passengerEmail: string;
  performedById: string | null;
  performedByName: string | null;
  cashShiftId: string | null;
}

export interface WalletMovementInput {
  userId: string;
  amount: Money;
  type: WalletTransactionType;
  performedById: string;
  at: Date;
  reason: string | null;
  cashShiftId?: string | null;
  saleId?: string | null;
  paymentId?: string | null;
}

export interface OpenCashShiftInput {
  adminId: string;
  deviceId: string;
  at: Date;
}

export interface WalletRepository<TransactionContext = unknown> {
  withTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
  findByUserId(userId: string): Promise<WalletRecord | null>;
  findPassengerByContact(contact: string): Promise<PassengerWalletSummary | null>;
  findPassengerById(userId: string): Promise<PassengerWalletSummary | null>;
  listTransactions(userId: string, page: number): Promise<WalletTransactionPage>;
  findTransactionById(id: string): Promise<WalletTransactionReceipt | null>;
  getTopUpLimits(): Promise<TopUpLimits>;
  getCurrentGeneralBoatFare(at: Date): Promise<Money | null>;
  ensureOpenCashShift(tx: TransactionContext, input: OpenCashShiftInput): Promise<string>;
  credit(
    tx: TransactionContext,
    input: WalletMovementInput,
    audit: ChangeAudit,
  ): Promise<WalletTransactionItem & { walletUserId: string }>;
  debit(
    tx: TransactionContext,
    input: WalletMovementInput,
    audit: ChangeAudit,
  ): Promise<WalletTransactionItem & { walletUserId: string }>;
}
