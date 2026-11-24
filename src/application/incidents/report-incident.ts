import { assertDepartureTransition } from "@/domain/departures/departure-state";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";
import type { AuditLogger, Clock } from "@/application/shared/ports";
import type { IncidentActionType, IncidentRecord, IncidentRepository } from "./ports";

export const INCIDENT_REASSIGN_PRIORITY = 1;

export interface ReportIncidentInput {
  vesselId: string;
  departureId?: string | null;
  type: string;
  description: string;
  action: IncidentActionType;
  actorUserId: string;
  actorDockId?: string | null;
}

export interface ReportIncidentResult {
  incident: IncidentRecord;
  affectedBoardingsCount: number;
  reassignedCount: number;
  refundedBalanceCount: number;
  totalRefundedBalance: string;
  cashRefundsReadyCount: number;
}

export function createReportIncident(
  repo: IncidentRepository,
  clock: Clock,
  auditLogger?: AuditLogger,
) {
  return async function reportIncident(input: ReportIncidentInput): Promise<ReportIncidentResult> {
    const vesselId = input.vesselId.trim();
    const departureId = input.departureId?.trim() || null;
    const type = input.type.trim();
    const description = input.description.trim();

    if (!vesselId) {
      throw new DomainError("INVALID_VESSEL_ID", "La embarcación afectada es obligatoria.");
    }

    if (!type) {
      throw new DomainError("INCIDENT_TYPE_REQUIRED", "El tipo de incidente es obligatorio.");
    }

    if (!description) {
      throw new DomainError(
        "INCIDENT_DESCRIPTION_REQUIRED",
        "La descripción del incidente es obligatoria.",
      );
    }

    if (input.action !== "REASSIGN" && input.action !== "REFUND") {
      throw new DomainError(
        "INVALID_INCIDENT_ACTION",
        "La acción del incidente debe ser REASSIGN o REFUND.",
      );
    }

    const exists = await repo.vesselExists(vesselId);
    if (!exists) {
      throw new DomainError("VESSEL_NOT_FOUND", "No se encontró la embarcación indicada.");
    }

    const initialDeparture = departureId ? await repo.findDepartureSnapshot(departureId) : null;

    if (departureId && !initialDeparture) {
      throw new DomainError(
        "DEPARTURE_NOT_FOUND",
        "No se encontró la salida asociada al incidente.",
      );
    }

    if (initialDeparture) {
      if (initialDeparture.vesselId !== vesselId) {
        throw new DomainError(
          "DEPARTURE_VESSEL_MISMATCH",
          "La salida seleccionada no corresponde a la embarcación del incidente.",
        );
      }

      if (input.actorDockId && input.actorDockId !== initialDeparture.originDockId) {
        throw new DomainError(
          "DOCK_ACCESS_DENIED",
          "Solo puedes registrar incidentes sobre salidas de tu muelle.",
        );
      }

      assertDepartureTransition(initialDeparture.status, "CANCELLED");
    }

    const uow = repo.unitOfWork;
    const now = clock.now();
    const cancelReason = `Incidente (${type}): ${description}`;

    const result = await uow.run(async (tx) => {
      const incident = await uow.createIncident(tx, {
        vesselId,
        departureId,
        type,
        description,
        action: input.action,
        reportedById: input.actorUserId,
      });

      if (!departureId || !initialDeparture) {
        return {
          incident,
          affectedBoardingsCount: 0,
          reassignedCount: 0,
          refundedBalanceCount: 0,
          totalRefundedBalance: "0.00",
          cashRefundsReadyCount: 0,
        };
      }

      const currentDeparture = uow.lockDepartureForIncident
        ? ((await uow.lockDepartureForIncident(tx, departureId)) ?? initialDeparture)
        : initialDeparture;

      assertDepartureTransition(currentDeparture.status, "CANCELLED");

      await uow.cancelDepartureForIncident(tx, {
        departureId: currentDeparture.id,
        fromStatus: currentDeparture.status,
        cancelReason,
      });

      const boardings = await uow.listBoardingsForIncident(tx, currentDeparture.id);
      const activeBoardings = boardings.filter((b) => b.status === "BOARDED");

      let reassignedCount = 0;
      let refundedBalanceCount = 0;
      let cashRefundsReadyCount = 0;
      let refundSum = Money.zero();
      const notifiedUsers = new Set<string>();

      for (const boarding of activeBoardings) {
        if (input.action === "REASSIGN") {
          await uow.markBoardingReassigned(tx, {
            boardingId: boarding.id,
          });

          await uow.enqueuePriorityWaitlist(tx, {
            dockId: currentDeparture.originDockId,
            passengerId: boarding.passengerId,
            label:
              boarding.passengerId === null
                ? boarding.passengerName || `Taquilla #${boarding.seatNumber} (${type})`
                : null,
            priority: INCIDENT_REASSIGN_PRIORITY,
            originBoardingId: boarding.id,
            createdById: input.actorUserId,
          });

          reassignedCount += 1;

          if (boarding.passengerId && !notifiedUsers.has(boarding.passengerId)) {
            notifiedUsers.add(boarding.passengerId);
            await uow.createNotification(tx, {
              userId: boarding.passengerId,
              type: "INCIDENT_REASSIGNED",
              title: "Reasignación prioritaria por incidente",
              body: `Se reportó un incidente (${type}). Tu lugar #${boarding.seatNumber} fue reasignado con prioridad en la lista de espera.`,
            });
          }
        } else {
          await uow.markBoardingCancelledByIncident(tx, {
            boardingId: boarding.id,
            cancelReason,
          });

          const amountMoney = Money.fromPesos(boarding.amountCharged);
          const exactAmount = amountMoney.toDecimalString();

          if (boarding.saleChannel === "QR_BALANCE" && boarding.passengerId) {
            await uow.creditWalletRefund(tx, {
              passengerId: boarding.passengerId,
              saleId: boarding.saleId,
              amountPesos: exactAmount,
              reason: `Reembolso por incidente (${type}): ${description}`,
              performedById: input.actorUserId,
            });
            refundedBalanceCount += 1;
            refundSum = refundSum.add(amountMoney);
          } else {
            cashRefundsReadyCount += 1;
          }

          if (boarding.passengerId && !notifiedUsers.has(boarding.passengerId)) {
            notifiedUsers.add(boarding.passengerId);
            const refundText =
              boarding.saleChannel === "QR_BALANCE"
                ? `Se reembolsaron ${amountMoney.format()} a tu monedero.`
                : `Tu boleto #${boarding.seatNumber} (${amountMoney.format()}) está listo para devolución en caja.`;

            await uow.createNotification(tx, {
              userId: boarding.passengerId,
              type: "INCIDENT_REFUNDED",
              title: "Salida cancelada por incidente",
              body: `Se reportó un incidente (${type}). ${refundText}`,
            });
          }
        }
      }

      return {
        incident,
        affectedBoardingsCount: activeBoardings.length,
        reassignedCount,
        refundedBalanceCount,
        totalRefundedBalance: refundSum.toDecimalString(),
        cashRefundsReadyCount,
      };
    });

    if (auditLogger) {
      await auditLogger.log({
        userId: input.actorUserId,
        action: "INCIDENT_REPORTED",
        entity: "incidents",
        entityId: result.incident.id,
        details: {
          vesselId,
          departureId,
          type,
          description,
          action: input.action,
          affectedBoardingsCount: result.affectedBoardingsCount,
          reassignedCount: result.reassignedCount,
          refundedBalanceCount: result.refundedBalanceCount,
          totalRefundedBalance: result.totalRefundedBalance,
          cashRefundsReadyCount: result.cashRefundsReadyCount,
          reportedAt: now.toISOString(),
        },
      });
    }

    return result;
  };
}
