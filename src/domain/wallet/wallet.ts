import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

export interface TopUpLimits {
  min: Money;
  max: Money;
}

export const DEFAULT_TOP_UP_LIMITS: TopUpLimits = {
  min: Money.fromPesos("10.00"),
  max: Money.fromPesos("2000.00"),
};

function assertPositiveAmount(amount: Money): void {
  if (amount.cents <= 0) {
    throw new DomainError("INVALID_AMOUNT", "El monto debe ser mayor que $0.00.");
  }
}

function assertNonNegativeBalance(balance: Money): void {
  if (balance.isNegative()) {
    throw new DomainError("INVALID_BALANCE", "El saldo no puede ser negativo.");
  }
}

export function applyCredit(balance: Money, amount: Money): Money {
  assertNonNegativeBalance(balance);
  assertPositiveAmount(amount);
  return balance.add(amount);
}

export function applyDebit(balance: Money, amount: Money): Money {
  assertNonNegativeBalance(balance);
  assertPositiveAmount(amount);
  const updated = balance.subtract(amount);
  if (updated.isNegative()) {
    throw new DomainError("INSUFFICIENT_BALANCE", "El saldo no puede quedar en negativo.");
  }
  return updated;
}

export function validateTopUpLimits(limits: TopUpLimits): void {
  if (limits.min.cents < 0 || limits.max.cents < limits.min.cents) {
    throw new DomainError("INVALID_TOPUP_LIMITS", "Los límites de recarga no son válidos.");
  }
}

export function validateTopUpAmount(amount: Money, limits: TopUpLimits): void {
  assertPositiveAmount(amount);
  validateTopUpLimits(limits);
  if (amount.isLessThan(limits.min)) {
    throw new DomainError("TOPUP_BELOW_MINIMUM", `La recarga mínima es ${limits.min.format()}.`);
  }
  if (limits.max.isLessThan(amount)) {
    throw new DomainError("TOPUP_ABOVE_MAXIMUM", `La recarga máxima es ${limits.max.format()}.`);
  }
}
