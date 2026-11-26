import { describe, expect, it } from "vitest";
import {
  canOperate,
  ensureVesselCanOperate,
  getVesselState,
  InvalidVesselStatusTransitionError,
  transitionVesselStatus,
  VesselCannotOperateError,
  VESSEL_STATUSES,
  type VesselStatus,
} from "./vessel-status";

describe("VesselStatus domain (State pattern)", () => {
  const validTransitions: Array<[VesselStatus, VesselStatus]> = [
    ["ACTIVE", "MAINTENANCE"],
    ["ACTIVE", "SEIZED"],
    ["ACTIVE", "OUT_OF_SERVICE"],
    ["MAINTENANCE", "ACTIVE"],
    ["MAINTENANCE", "OUT_OF_SERVICE"],
    ["SEIZED", "ACTIVE"],
    ["SEIZED", "OUT_OF_SERVICE"],
    ["OUT_OF_SERVICE", "ACTIVE"],
    ["OUT_OF_SERVICE", "MAINTENANCE"],
  ];

  const invalidTransitions: Array<[VesselStatus, VesselStatus]> = [
    ["ACTIVE", "ACTIVE"],
    ["MAINTENANCE", "MAINTENANCE"],
    ["MAINTENANCE", "SEIZED"],
    ["SEIZED", "SEIZED"],
    ["SEIZED", "MAINTENANCE"],
    ["OUT_OF_SERVICE", "OUT_OF_SERVICE"],
    ["OUT_OF_SERVICE", "SEIZED"],
  ];

  it.each(validTransitions)("permite transición de %s a %s", (from, to) => {
    expect(getVesselState(from).canTransitionTo(to)).toBe(true);
    expect(transitionVesselStatus(from, to)).toBe(to);
  });

  it.each(invalidTransitions)(
    "rechaza transición de %s a %s con InvalidVesselStatusTransitionError",
    (from, to) => {
      expect(getVesselState(from).canTransitionTo(to)).toBe(false);
      expect(() => transitionVesselStatus(from, to)).toThrow(InvalidVesselStatusTransitionError);
    },
  );

  it("permite operar solo cuando el estado es ACTIVE", () => {
    expect(canOperate("ACTIVE")).toBe(true);
    expect(() => ensureVesselCanOperate("ACTIVE")).not.toThrow();

    for (const status of VESSEL_STATUSES) {
      if (status !== "ACTIVE") {
        expect(canOperate(status)).toBe(false);
        expect(() => ensureVesselCanOperate(status)).toThrow(VesselCannotOperateError);
      }
    }
  });
});
