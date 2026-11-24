import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import type { Clock } from "@/application/shared/ports";
import { createSetExtraService } from "./set-extra-service";
import type { DockServiceOverrideRecord, ScheduleRepository } from "./ports";

const fixedClock: Clock = {
  now: () => new Date("2026-11-24T04:30:00.000Z"),
};

describe("setExtraService", () => {
  it("habilita y deshabilita servicio extraordinario con motivo obligatorio y bitácora", async () => {
    const overrides: DockServiceOverrideRecord[] = [];
    const auditLog = vi.fn(async () => undefined);

    const repo: ScheduleRepository = {
      listServiceHoursByDock: vi.fn(async () => []),
      listActiveOverridesByDock: vi.fn(async () => overrides),
      createOverride: vi.fn(async (input) => {
        const created: DockServiceOverrideRecord = {
          id: "ovr-1",
          ...input,
        };
        overrides.push(created);
        return created;
      }),
      closeActiveOverrides: vi.fn(async ({ endedAt }) => {
        let count = 0;
        for (const o of overrides) {
          if (o.endsAt === null || o.endsAt > endedAt) {
            o.endsAt = endedAt;
            count += 1;
          }
        }
        return count;
      }),
      getMaxBoardingMinutes: vi.fn(async () => 20),
    };

    const setExtraService = createSetExtraService(repo, fixedClock, {
      log: auditLog,
    });

    const enabledRes = await setExtraService({
      dockId: "dock-coa",
      enabled: true,
      reason: "Cruce extraordinario nocturno",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });

    expect(enabledRes.enabled).toBe(true);
    expect(enabledRes.override?.id).toBe("ovr-1");
    expect(overrides).toHaveLength(1);

    const disabledRes = await setExtraService({
      dockId: "dock-coa",
      enabled: false,
      reason: "Fin de operación extraordinaria",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });

    expect(disabledRes.enabled).toBe(false);
    expect(disabledRes.closedCount).toBe(1);
    expect(auditLog).toHaveBeenCalledTimes(2);
  });

  it("rechaza sin motivo, muelle ajeno o ventana vencida", async () => {
    const repo: ScheduleRepository = {
      listServiceHoursByDock: vi.fn(async () => []),
      listActiveOverridesByDock: vi.fn(async () => []),
      createOverride: vi.fn(async () => {
        throw new Error("not expected");
      }),
      closeActiveOverrides: vi.fn(async () => 0),
      getMaxBoardingMinutes: vi.fn(async () => 20),
    };

    const setExtraService = createSetExtraService(repo, fixedClock);

    await expect(
      setExtraService({
        dockId: "dock-coa",
        enabled: true,
        reason: "   ",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      setExtraService({
        dockId: "dock-coa",
        enabled: true,
        reason: "Motivo",
        actorUserId: "admin-1",
        actorDockId: "dock-val",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      setExtraService({
        dockId: "dock-coa",
        enabled: true,
        reason: "Motivo",
        endsAt: new Date("2026-11-24T04:00:00.000Z"),
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);
  });
});
