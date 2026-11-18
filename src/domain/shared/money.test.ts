import { describe, expect, it } from "vitest";

import { DomainError } from "./domain-error";
import { Money } from "./money";

describe("Money", () => {
  it("convierte pesos a centavos sin errores de redondeo", () => {
    expect(Money.fromPesos("0.10").add(Money.fromPesos("0.20")).toDecimalString()).toBe("0.30");
    expect(Money.fromPesos(15.5).cents).toBe(1550);
    expect(Money.fromPesos("-3").cents).toBe(-300);
  });

  it("multiplica el precio por el número de boletos", () => {
    expect(Money.fromPesos("12.50").multiply(3).toDecimalString()).toBe("37.50");
  });

  it("detecta saldo insuficiente", () => {
    const balance = Money.fromPesos("10.00");
    const fare = Money.fromPesos("12.00");
    expect(balance.isLessThan(fare)).toBe(true);
    expect(balance.subtract(fare).isNegative()).toBe(true);
  });

  it("rechaza montos inválidos", () => {
    expect(() => Money.fromPesos("12.345")).toThrow(DomainError);
    expect(() => Money.fromPesos("abc")).toThrow(DomainError);
  });

  it("formatea en pesos mexicanos", () => {
    expect(Money.fromPesos("1234.5").format()).toContain("1,234.50");
  });
});
