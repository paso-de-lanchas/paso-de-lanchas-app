import { describe, expect, it } from "vitest";

import { allocateSeats, type DepartureCapacity } from "./seat-allocation";

const boarding = (occupiedSeats: number, passengerCapacity = 20): DepartureCapacity => ({
  status: "BOARDING",
  passengerCapacity,
  occupiedSeats,
});

describe("allocateSeats (cero sobreventa)", () => {
  it("asigna los siguientes asientos libres", () => {
    expect(allocateSeats(boarding(5), 3)).toEqual([6, 7, 8]);
  });

  it("permite llenar exactamente el último lugar", () => {
    expect(allocateSeats(boarding(19), 1)).toEqual([20]);
  });

  it("rechaza si no caben todos los boletos de la venta", () => {
    expect(() => allocateSeats(boarding(18), 3)).toThrow("Solo quedan 2 lugares");
  });

  it("rechaza si la embarcación está llena", () => {
    expect(() => allocateSeats(boarding(20), 1)).toThrow("La embarcación está llena.");
  });

  it("rechaza si la salida no está abordando", () => {
    expect(() => allocateSeats({ ...boarding(0), status: "IN_TRANSIT" }, 1)).toThrow(
      "no está abordando",
    );
  });

  it("rechaza cantidades de boletos inválidas", () => {
    expect(() => allocateSeats(boarding(0), 0)).toThrow("al menos un boleto");
  });
});
