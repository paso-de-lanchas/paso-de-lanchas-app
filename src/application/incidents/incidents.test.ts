import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import type { Clock } from "@/application/shared/ports";
import { INCIDENT_REASSIGN_PRIORITY, createReportIncident } from "./report-incident";
import type {
  IncidentBoardingItem,
  IncidentDepartureSnapshot,
  IncidentRecord,
  IncidentRepository,
  IncidentUnitOfWork,
} from "./ports";

const fixedClock: Clock = {
  now: () => new Date("2026-11-24T00:50:00.000Z"),
};

function buildIncidentRepo(params: {
  vesselExists?: boolean;
  departure?: IncidentDepartureSnapshot | null;
  boardings?: IncidentBoardingItem[];
}) {
  const boardings = params.boardings ?? [];
  const createIncident = vi.fn(async (_tx: unknown, data): Promise<IncidentRecord> => ({
    id: "inc-1",
    ...data,
    createdAt: fixedClock.now(),
  }));
  const cancelDepartureForIncident = vi.fn(async () => undefined);
  const markBoardingReassigned = vi.fn(async () => undefined);
  const markBoardingCancelledByIncident = vi.fn(async () => undefined);
  const enqueuePriorityWaitlist = vi.fn(async () => undefined);
  const creditWalletRefund = vi.fn(async () => undefined);
  const createNotification = vi.fn(async () => undefined);

  const unitOfWork: IncidentUnitOfWork = {
    run: async (work) => work({}),
    createIncident,
    lockDepartureForIncident: vi.fn(async () => params.departure ?? null),
    cancelDepartureForIncident,
    listBoardingsForIncident: vi.fn(async () => boardings),
    markBoardingReassigned,
    markBoardingCancelledByIncident,
    enqueuePriorityWaitlist,
    creditWalletRefund,
    createNotification,
  };

  const repo: IncidentRepository = {
    vesselExists: vi.fn(async () => params.vesselExists ?? true),
    findDepartureSnapshot: vi.fn(async () => params.departure ?? null),
    listRecentIncidentsByDock: vi.fn(async () => []),
    unitOfWork,
  };

  return {
    repo,
    createIncident,
    cancelDepartureForIncident,
    markBoardingReassigned,
    markBoardingCancelledByIncident,
    enqueuePriorityWaitlist,
    creditWalletRefund,
    createNotification,
  };
}

describe("reportIncident (Decisión D19)", () => {
  it("reasigna abordados a lista de espera con prioridad > 0 y marca abordaje como REASSIGNED", async () => {
    const auditLog = vi.fn(async () => undefined);
    const {
      repo,
      cancelDepartureForIncident,
      markBoardingReassigned,
      enqueuePriorityWaitlist,
      createNotification,
    } = buildIncidentRepo({
      departure: {
        id: "dep-1",
        vesselId: "vessel-1",
        originDockId: "dock-coa",
        status: "BOARDING",
      },
      boardings: [
        {
          id: "b-1",
          departureId: "dep-1",
          saleId: "s-1",
          saleChannel: "QR_BALANCE",
          passengerId: "user-1",
          passengerName: "Ana López",
          seatNumber: 1,
          amountCharged: "7.00",
          status: "BOARDED",
        },
        {
          id: "b-2",
          departureId: "dep-1",
          saleId: "s-2",
          saleChannel: "TICKET_OFFICE",
          passengerId: null,
          passengerName: null,
          seatNumber: 2,
          amountCharged: "7.00",
          status: "BOARDED",
        },
      ],
    });

    const reportIncident = createReportIncident(repo, fixedClock, {
      log: auditLog,
    });
    const res = await reportIncident({
      vesselId: "vessel-1",
      departureId: "dep-1",
      type: "FALLA_MECANICA",
      description: "Falla en motor fuera de borda",
      action: "REASSIGN",
      actorUserId: "admin-1",
      actorDockId: "dock-coa",
    });

    expect(res.reassignedCount).toBe(2);
    expect(cancelDepartureForIncident).toHaveBeenCalledTimes(1);
    expect(markBoardingReassigned).toHaveBeenCalledTimes(2);
    expect(enqueuePriorityWaitlist).toHaveBeenNthCalledWith(
      1,
      {},
      expect.objectContaining({
        dockId: "dock-coa",
        passengerId: "user-1",
        priority: INCIDENT_REASSIGN_PRIORITY,
        originBoardingId: "b-1",
      }),
    );
    expect(enqueuePriorityWaitlist).toHaveBeenNthCalledWith(
      2,
      {},
      expect.objectContaining({
        dockId: "dock-coa",
        passengerId: null,
        priority: INCIDENT_REASSIGN_PRIORITY,
        originBoardingId: "b-2",
      }),
    );
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
  });

  it("reembolsa a monedero y prepara efectivo cuando la acción es REFUND", async () => {
    const { repo, markBoardingCancelledByIncident, creditWalletRefund, createNotification } =
      buildIncidentRepo({
        departure: {
          id: "dep-1",
          vesselId: "vessel-1",
          originDockId: "dock-coa",
          status: "BOARDING",
        },
        boardings: [
          {
            id: "b-1",
            departureId: "dep-1",
            saleId: "s-1",
            saleChannel: "QR_BALANCE",
            passengerId: "user-1",
            passengerName: "Ana López",
            seatNumber: 1,
            amountCharged: "7.00",
            status: "BOARDED",
          },
          {
            id: "b-2",
            departureId: "dep-1",
            saleId: "s-2",
            saleChannel: "TICKET_OFFICE",
            passengerId: null,
            passengerName: null,
            seatNumber: 2,
            amountCharged: "5.00",
            status: "BOARDED",
          },
        ],
      });

    const reportIncident = createReportIncident(repo, fixedClock);
    const res = await reportIncident({
      vesselId: "vessel-1",
      departureId: "dep-1",
      type: "EMERGENCIA",
      description: "Suspensión por falla eléctrica",
      action: "REFUND",
      actorUserId: "admin-1",
    });

    expect(res.refundedBalanceCount).toBe(1);
    expect(res.totalRefundedBalance).toBe("7.00");
    expect(res.cashRefundsReadyCount).toBe(1);
    expect(markBoardingCancelledByIncident).toHaveBeenCalledTimes(2);
    expect(creditWalletRefund).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("registra incidente informativo sin salida asociada y rechaza entradas inválidas", async () => {
    const { repo } = buildIncidentRepo({
      vesselExists: true,
      departure: {
        id: "dep-1",
        vesselId: "otra-lancha",
        originDockId: "dock-coa",
        status: "BOARDING",
      },
    });

    const reportIncident = createReportIncident(repo, fixedClock);

    const infoOnly = await reportIncident({
      vesselId: "vessel-1",
      type: "PREVENTIVO",
      description: "Revisión de chalecos salvavidas",
      action: "REASSIGN",
      actorUserId: "admin-1",
    });
    expect(infoOnly.affectedBoardingsCount).toBe(0);

    await expect(
      reportIncident({
        vesselId: "",
        type: "FALLA",
        description: "Desc",
        action: "REASSIGN",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      reportIncident({
        vesselId: "vessel-1",
        type: "",
        description: "Desc",
        action: "REASSIGN",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      reportIncident({
        vesselId: "vessel-1",
        type: "FALLA",
        description: "",
        action: "REASSIGN",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      reportIncident({
        vesselId: "vessel-1",
        departureId: "dep-1",
        type: "FALLA",
        description: "No coincide embarcación",
        action: "REASSIGN",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow(DomainError);
  });
});
