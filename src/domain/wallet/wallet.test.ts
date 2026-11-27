import { describe, expect, it } from "vitest";

import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import { applyCredit, applyDebit, validateTopUpAmount } from "./wallet";

describe("wallet domain rules", () => {
  it("applies credits and debits with exact cent values", () => {
    expect(applyCredit(Money.fromPesos("10.10"), Money.fromPesos("2.25")).cents).toBe(1235);
    expect(applyDebit(Money.fromPesos("10.10"), Money.fromPesos("2.25")).cents).toBe(785);
    expect(applyDebit(Money.fromPesos("10.10"), Money.fromPesos("10.10")).cents).toBe(0);
  });

  it("rejects a debit that would make the balance negative", () => {
    expect(() => applyDebit(Money.fromPesos("10.00"), Money.fromPesos("10.01"))).toThrow(
      expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }),
    );
  });

  it("rejects zero or negative movement amounts", () => {
    expect(() => applyCredit(Money.zero(), Money.zero())).toThrow(DomainError);
    expect(() => applyDebit(Money.fromPesos("5.00"), Money.fromPesos("-1.00"))).toThrow(
      DomainError,
    );
    expect(() => applyCredit(Money.fromPesos("-1.00"), Money.fromPesos("2.00"))).toThrow(
      expect.objectContaining({ code: "INVALID_BALANCE" }),
    );
  });

  it("accepts inclusive top-up limits and rejects values outside them", () => {
    const limits = { min: Money.fromPesos("10"), max: Money.fromPesos("2000") };
    expect(() => validateTopUpAmount(Money.fromPesos("10"), limits)).not.toThrow();
    expect(() => validateTopUpAmount(Money.fromPesos("2000"), limits)).not.toThrow();
    expect(() => validateTopUpAmount(Money.fromPesos("9.99"), limits)).toThrow(
      expect.objectContaining({ code: "TOPUP_BELOW_MINIMUM" }),
    );
    expect(() => validateTopUpAmount(Money.fromPesos("2000.01"), limits)).toThrow(
      expect.objectContaining({ code: "TOPUP_ABOVE_MAXIMUM" }),
    );
  });

  it("rejects invalid configured limits", () => {
    expect(() =>
      validateTopUpAmount(Money.fromPesos("10"), {
        min: Money.fromPesos("20"),
        max: Money.fromPesos("10"),
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_TOPUP_LIMITS" }));
  });
});
