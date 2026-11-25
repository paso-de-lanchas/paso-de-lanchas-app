import { describe, expect, it } from "vitest";

import { assertValidVehicleDraft, isValidPhotoUrl, isValidPlate, normalizePlate } from "./vehicle";

describe("vehicle domain rules", () => {
  it("normaliza placas a mayúsculas eliminando espacios y guiones", () => {
    expect(normalizePlate("  yxz-123-a ")).toBe("YXZ123A");
    expect(normalizePlate("abc 45 67")).toBe("ABC4567");
  });

  it("valida formato y longitud de placas normalizadas", () => {
    expect(isValidPlate("ABC1234")).toBe(true);
    expect(isValidPlate("A1B2")).toBe(true);
    expect(isValidPlate("AB1")).toBe(false);
    expect(isValidPlate("A".repeat(16))).toBe(false);
    expect(isValidPlate("ABC$123")).toBe(false);
  });

  it("valida URLs opcionales de fotografía solo con http o https", () => {
    expect(isValidPhotoUrl("https://ejemplo.test/auto.jpg")).toBe(true);
    expect(isValidPhotoUrl("http://localhost:3000/foto.png")).toBe(true);
    expect(isValidPhotoUrl("javascript:alert(1)")).toBe(false);
    expect(isValidPhotoUrl("no-es-url")).toBe(false);
  });

  it("valida un borrador de vehículo completo y rechaza datos inválidos", () => {
    expect(() =>
      assertValidVehicleDraft({
        vehicleTypeId: 1,
        brand: "Nissan",
        model: "Versa",
        color: "Blanco",
        plate: "yxz-123",
        photoUrl: null,
      }),
    ).not.toThrow();

    expect(() =>
      assertValidVehicleDraft({
        vehicleTypeId: 0,
        brand: "Nissan",
        model: "Versa",
        color: "Blanco",
        plate: "YXZ123",
        photoUrl: null,
      }),
    ).toThrow("Selecciona un tipo de vehículo válido.");

    expect(() =>
      assertValidVehicleDraft({
        vehicleTypeId: 1,
        brand: "",
        model: "Versa",
        color: "Blanco",
        plate: "YXZ123",
        photoUrl: null,
      }),
    ).toThrow("La marca del vehículo no es válida.");

    expect(() =>
      assertValidVehicleDraft({
        vehicleTypeId: 1,
        brand: "Nissan",
        model: "Versa",
        color: "Blanco",
        plate: "12",
        photoUrl: null,
      }),
    ).toThrow("Las placas deben tener entre 4 y 15 caracteres alfanuméricos.");
  });
});
