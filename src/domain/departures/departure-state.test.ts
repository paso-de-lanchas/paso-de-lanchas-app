import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { assertDepartureTransition, canTransitionDeparture } from "./departure-state";

describe("departure-state", () => {
  it("permite las transiciones válidas del ciclo de salida", () => {
    expect(canTransitionDeparture("QUEUED", "BOARDING")).toBe(true);
    expect(canTransitionDeparture("QUEUED", "CANCELLED")).toBe(true);
    expect(canTransitionDeparture("BOARDING", "BOARDING_CLOSED")).toBe(true);
    expect(canTransitionDeparture("BOARDING", "CANCELLED")).toBe(true);
    expect(canTransitionDeparture("BOARDING_CLOSED", "IN_TRANSIT")).toBe(true);
    expect(canTransitionDeparture("BOARDING_CLOSED", "CANCELLED")).toBe(true);
    expect(canTransitionDeparture("IN_TRANSIT", "FINISHED")).toBe(true);

    expect(assertDepartureTransition("QUEUED", "BOARDING")).toBe("BOARDING");
  });

  it("rechaza transiciones inválidas o saltos de estado con DomainError", () => {
    expect(canTransitionDeparture("QUEUED", "IN_TRANSIT")).toBe(false);
    expect(canTransitionDeparture("QUEUED", "FINISHED")).toBe(false);
    expect(canTransitionDeparture("BOARDING", "FINISHED")).toBe(false);
    expect(canTransitionDeparture("FINISHED", "BOARDING")).toBe(false);
    expect(canTransitionDeparture("CANCELLED", "QUEUED")).toBe(false);
    expect(canTransitionDeparture("QUEUED", "QUEUED")).toBe(false);

    expect(() => assertDepartureTransition("QUEUED", "FINISHED")).toThrow(DomainError);
  });
});
