import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

export const DELETED_USER_FULL_NAME = "Usuario eliminado";

export interface AnonymizedAccountData {
  deletedAt: Date;
  status: "INACTIVE";
  fullName: string;
  email: string;
  phone: null;
  photoUrl: null;
  passwordHash: string;
}

export interface BalanceForfeitureWarning {
  hasBalance: boolean;
  formattedBalance: string;
  message: string | null;
}

export function buildAnonymizedEmail(userId: string): string {
  return `eliminado-${userId}@pasolanchas.invalid`;
}

export function ensureAccountCanBeCancelled(account: {
  status: string;
  deletedAt: Date | null;
}): void {
  if (account.deletedAt !== null || account.status === "INACTIVE") {
    throw new DomainError("ACCOUNT_ALREADY_CANCELLED", "Esta cuenta ya fue cancelada.");
  }
}

export function buildAnonymizedAccountData(
  userId: string,
  randomPasswordHash: string,
  now: Date = new Date(),
): AnonymizedAccountData {
  return {
    deletedAt: now,
    status: "INACTIVE",
    fullName: DELETED_USER_FULL_NAME,
    email: buildAnonymizedEmail(userId),
    phone: null,
    photoUrl: null,
    passwordHash: randomPasswordHash,
  };
}

export function buildBalanceForfeitureWarning(balance: Money): BalanceForfeitureWarning {
  const formattedBalance = balance.format();
  if (balance.cents > 0) {
    return {
      hasBalance: true,
      formattedBalance,
      message: `Tienes un saldo disponible de ${formattedBalance}. Al cancelar tu cuenta perderás este saldo de forma permanente.`,
    };
  }
  return {
    hasBalance: false,
    formattedBalance,
    message: null,
  };
}
