import { describe, expect, it } from "vitest";

import { Money } from "@/domain/shared/money";

import {
  assertEnoughBalance,
  assertSeatAvailable,
  assertVehicleSpace,
  BoardingError,
  isFullAfterBoarding,
  nextSeatNumber,
} from "./boarding";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as BoardingError).code;
  }
  return undefined;
}

describe("reglas del abordaje", () => {
  it("solo aborda una salida en estado BOARDING", () => {
    for (const status of ["QUEUED", "BOARDING_CLOSED", "IN_TRANSIT", "FINISHED", "CANCELLED"]) {
      expect(
        codeOf(() => assertSeatAvailable({ status, passengerCapacity: 10, occupiedSeats: 0 })),
      ).toBe("NO_DEPARTURE_BOARDING");
    }
    expect(() =>
      assertSeatAvailable({ status: "BOARDING", passengerCapacity: 10, occupiedSeats: 9 }),
    ).not.toThrow();
  });

  it("nunca deja pasar de la capacidad (cero sobreventa)", () => {
    expect(
      codeOf(() =>
        assertSeatAvailable({ status: "BOARDING", passengerCapacity: 10, occupiedSeats: 10 }),
      ),
    ).toBe("DEPARTURE_FULL");
    // Aunque el dato llegara inconsistente (más ocupados que lugares), se rechaza.
    expect(
      codeOf(() =>
        assertSeatAvailable({ status: "BOARDING", passengerCapacity: 10, occupiedSeats: 11 }),
      ),
    ).toBe("DEPARTURE_FULL");
  });

  it("detecta cuando el abordaje llena la salida", () => {
    expect(
      isFullAfterBoarding({ status: "BOARDING", passengerCapacity: 3, occupiedSeats: 2 }),
    ).toBe(true);
    expect(
      isFullAfterBoarding({ status: "BOARDING", passengerCapacity: 3, occupiedSeats: 1 }),
    ).toBe(false);
  });

  it("numera los lugares de forma consecutiva sin reutilizar los cancelados", () => {
    expect(nextSeatNumber(null)).toBe(1);
    expect(nextSeatNumber(1)).toBe(2);
    expect(nextSeatNumber(19)).toBe(20);
    expect(() => nextSeatNumber(-1)).toThrow();
    expect(() => nextSeatNumber(1.5)).toThrow();
  });

  it("exige espacio libre para el tipo de vehículo", () => {
    expect(codeOf(() => assertVehicleSpace(null, "Automóvil"))).toBe("VEHICLE_SPACE_FULL");
    expect(codeOf(() => assertVehicleSpace({ capacity: 2, occupied: 2 }, "Automóvil"))).toBe(
      "VEHICLE_SPACE_FULL",
    );
    expect(() => assertVehicleSpace({ capacity: 2, occupied: 1 }, "Automóvil")).not.toThrow();
  });

  it("con saldo insuficiente dice exactamente cuánto falta", () => {
    try {
      assertEnoughBalance(Money.fromPesos("3.50"), Money.fromPesos("10.00"));
      expect.unreachable();
    } catch (error) {
      const boardingError = error as BoardingError;
      expect(boardingError).toBeInstanceOf(BoardingError);
      expect(boardingError.code).toBe("INSUFFICIENT_BALANCE");
      expect(boardingError.details).toEqual({
        balanceCents: 350,
        fareCents: 1000,
        shortfallCents: 650,
      });
      expect(boardingError.message).toContain("6.50");
    }
    expect(() =>
      assertEnoughBalance(Money.fromPesos("10.00"), Money.fromPesos("10.00")),
    ).not.toThrow();
  });
});
