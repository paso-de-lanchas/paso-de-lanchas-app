import { describe, expect, it } from "vitest";

import { DomainError } from "@/domain/shared/domain-error";

import { assertCanCancelBoarding } from "./boarding-cancellation";

describe("cancelación de abordajes", () => {
  it("permite cancelar antes de iniciar el viaje", () => {
    expect(() => assertCanCancelBoarding("BOARDED", "BOARDING")).not.toThrow();
    expect(() => assertCanCancelBoarding("BOARDED", "BOARDING_CLOSED")).not.toThrow();
  });

  it.each(["IN_TRANSIT", "FINISHED"])("rechaza cancelar cuando la salida está %s", (status) => {
    expect(() => assertCanCancelBoarding("BOARDED", status)).toThrow(DomainError);
  });

  it("rechaza cancelar un abordaje que ya no está activo", () => {
    expect(() => assertCanCancelBoarding("CANCELLED", "BOARDING")).toThrow(
      "Este abordaje ya fue cancelado o reasignado.",
    );
  });
});
