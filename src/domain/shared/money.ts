import { DomainError } from "./domain-error";

/**
 * Dinero en pesos mexicanos, guardado en centavos enteros para evitar errores de
 * redondeo de los números decimales de JavaScript (0.1 + 0.2 !== 0.3).
 * En la base de datos se guarda como numeric(10,2).
 */
export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new DomainError("INVALID_AMOUNT", "El monto debe ser un número entero de centavos.");
    }
    return new Money(cents);
  }

  /** Acepta "15.50", 15.5 o el Decimal de Prisma (cualquier cosa con toString). */
  static fromPesos(pesos: number | string | { toString(): string }): Money {
    const text = typeof pesos === "number" ? pesos.toFixed(2) : pesos.toString();
    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
      throw new DomainError("INVALID_AMOUNT", `Monto inválido: ${text}`);
    }
    const [whole, fraction = ""] = text.replace("-", "").split(".");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return Money.fromCents(text.startsWith("-") ? -cents : cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return Money.fromCents(this.cents - other.cents);
  }

  multiply(times: number): Money {
    if (!Number.isInteger(times)) {
      throw new DomainError("INVALID_AMOUNT", "Solo se multiplica por cantidades enteras.");
    }
    return Money.fromCents(this.cents * times);
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  /** "15.50", listo para guardar en numeric(10,2). */
  toDecimalString(): string {
    const sign = this.cents < 0 ? "-" : "";
    const abs = Math.abs(this.cents);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  }

  /** "$15.50", para mostrar al usuario. */
  format(): string {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
      this.cents / 100,
    );
  }
}
