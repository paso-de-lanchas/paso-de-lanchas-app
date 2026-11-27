import type {
  BoardingCancellationStore,
  CreatedTicketOfficeSale,
  BoardingPassenger,
  BoardingStore,
  BoardingVehicle,
  CreateBoardingData,
  CreatedBoarding,
  LockedBoardingCancellation,
  LockedDeparture,
  OccupySeatResult,
  TicketOfficeSaleAudit,
  TicketOfficeStore,
  TicketOfficeTicketData,
} from "@/application/boarding/ports";
import type { ChangeAudit } from "@/application/shared/ports";
import { BoardingError } from "@/domain/boarding/boarding";
import { DomainError } from "@/domain/shared/domain-error";
import { pickNextInQueue, reorderQueue } from "@/domain/departures/queue";
import type { FareCategory, VesselKind } from "@/domain/fares/fare";
import type { FareOption } from "@/domain/fares/fare-strategy";
import { Money } from "@/domain/shared/money";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { auditLogData } from "@/infrastructure/audit/prisma-audit-logger";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaWalletRepository } from "@/infrastructure/wallet/prisma-wallet-repository";

type Tx = Prisma.TransactionClient;

interface LockedRow {
  id: string;
  status: string;
  passenger_capacity: number;
  occupied_seats: number;
  vessel_kind: VesselKind;
  vessel_name: string;
  destination_dock_name: string;
}

interface LockedCancellationRow {
  boarding_id: string;
  departure_id: string;
  departure_status: string;
  occupied_seats: number;
  passenger_capacity: number;
  boarding_status: string;
  passenger_id: string | null;
  sale_id: string;
  payment_method: "BALANCE" | "CASH";
  cash_shift_id: string | null;
  seat_number: number;
  vehicle_type_id: number | null;
  amount_charged: string;
  fare_category: FareCategory;
}

/**
 * Convierte las violaciones de las reglas de la base en errores entendibles. Son la última
 * defensa: el caso de uso ya revisa lo mismo, pero dos escaneos simultáneos del mismo QR en
 * muelles distintos solo los frena el índice único (credencial + paso de tiempo).
 */
export function toBoardingError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
  const detail = `${JSON.stringify(error.meta ?? {})} ${error.message}`;
  if (error.code === "P2002") {
    if (detail.includes("ticket_code") || detail.includes("ticketCode")) {
      return new DomainError(
        "TICKET_CODE_COLLISION",
        "No se pudo asignar un código único al boleto. Intenta registrar la venta otra vez.",
      );
    }
    if (detail.includes("qr_credential_id") || detail.includes("qrCredentialId")) {
      return new BoardingError(
        "QR_ALREADY_USED",
        "Este QR ya se usó. Pide al pasajero que espere a que cambie su código.",
      );
    }
    if (detail.includes("one_active_per_passenger") || detail.includes("passenger_id")) {
      return new BoardingError("ALREADY_BOARDED", "El pasajero ya abordó esta embarcación.");
    }
  }
  if (detail.includes("occupied_within_capacity") || detail.includes("dvc_occupied")) {
    return new BoardingError("DEPARTURE_FULL", "La embarcación ya está llena.");
  }
  return error;
}

export class PrismaBoardingStore
  implements BoardingStore<Tx>, TicketOfficeStore<Tx>, BoardingCancellationStore<Tx>
{
  private readonly wallets: PrismaWalletRepository;

  constructor(private readonly db: PrismaClient = prisma) {
    this.wallets = new PrismaWalletRepository(db);
  }

  async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 10_000,
      });
    } catch (error) {
      throw toBoardingError(error);
    }
  }

  async lockBoardingDeparture(tx: Tx, dockId: string): Promise<LockedDeparture | null> {
    // Primero el muelle y luego la salida: el mismo orden que usa la fila (#43) al formar o
    // cerrar abordaje, para que escanear y mover la fila a la vez nunca se bloqueen entre sí.
    // Dos escaneos del mismo muelle quedan en fila y el segundo ve el cupo que dejó el primero.
    await tx.$executeRaw`SELECT id FROM docks WHERE id = ${dockId}::uuid FOR UPDATE`;
    const rows = await tx.$queryRaw<LockedRow[]>`
      SELECT d.id, d.status::text AS status, d.passenger_capacity, d.occupied_seats,
             v.kind::text AS vessel_kind, v.name AS vessel_name, dd.name AS destination_dock_name
      FROM departures d
      JOIN vessels v ON v.id = d.vessel_id
      JOIN docks dd ON dd.id = d.destination_dock_id
      WHERE d.origin_dock_id = ${dockId}::uuid AND d.status = 'BOARDING'
      FOR UPDATE OF d`;
    const row = rows[0];
    if (!row) return null;

    const seats = await tx.boarding.aggregate({
      where: { departureId: row.id },
      _max: { seatNumber: true },
    });

    return {
      id: row.id,
      status: row.status,
      vesselKind: row.vessel_kind,
      vesselName: row.vessel_name,
      destinationDockName: row.destination_dock_name,
      passengerCapacity: Number(row.passenger_capacity),
      occupiedSeats: Number(row.occupied_seats),
      highestSeat: seats._max.seatNumber ?? null,
    };
  }

  async getMaxTicketsPerSale(tx: Tx): Promise<number> {
    const setting = await tx.systemSetting.findUnique({
      where: { key: "max_tickets_per_sale" },
      select: { value: true },
    });
    if (typeof setting?.value !== "number" || !Number.isSafeInteger(setting.value)) {
      throw new DomainError(
        "INVALID_TICKET_SALE_LIMIT",
        "No se encontró una configuración válida del máximo de boletos por venta.",
      );
    }
    return setting.value;
  }

  ensureOpenCashShift(
    tx: Tx,
    input: { adminId: string; deviceId: string; at: Date },
  ): Promise<string> {
    return this.wallets.ensureOpenCashShift(tx, input);
  }

  async createTicketOfficeSale(
    tx: Tx,
    input: {
      departureId: string;
      registeredById: string;
      deviceId: string;
      cashShiftId: string;
      tickets: TicketOfficeTicketData[];
      total: Money;
      at: Date;
    },
    audit: TicketOfficeSaleAudit,
  ): Promise<CreatedTicketOfficeSale> {
    const sale = await tx.sale.create({
      data: {
        channel: "TICKET_OFFICE",
        registeredById: input.registeredById,
        deviceId: input.deviceId,
        cashShiftId: input.cashShiftId,
        paymentMethod: "CASH",
        ticketCount: input.tickets.length,
        totalAmount: input.total.toDecimalString(),
        createdAt: input.at,
      },
      select: { id: true },
    });

    const tickets: CreatedTicketOfficeSale["tickets"] = [];
    for (const ticket of input.tickets) {
      const boarding = await tx.boarding.create({
        data: {
          departureId: input.departureId,
          saleId: sale.id,
          seatNumber: ticket.seatNumber,
          fareId: ticket.fareId,
          fareCategory: ticket.category,
          amountCharged: ticket.amount.toDecimalString(),
          ticketCode: ticket.ticketCode,
          createdAt: input.at,
        },
        select: { id: true },
      });
      tickets.push({
        boardingId: boarding.id,
        seatNumber: ticket.seatNumber,
        ticketCode: ticket.ticketCode,
        amount: ticket.amount,
      });
    }

    await tx.auditLog.create({
      data: auditLogData({
        userId: audit.userId,
        deviceId: audit.deviceId,
        action: audit.action,
        entity: "sales",
        entityId: sale.id,
        details: audit.details,
      }),
    });

    return { saleId: sale.id, tickets };
  }

  async lockBoardingForCancellation(
    tx: Tx,
    dockId: string,
    boardingId: string,
  ): Promise<LockedBoardingCancellation | null> {
    await tx.$executeRaw`SELECT id FROM docks WHERE id = ${dockId}::uuid FOR UPDATE`;
    const rows = await tx.$queryRaw<LockedCancellationRow[]>`
      SELECT b.id AS boarding_id, d.id AS departure_id, d.status::text AS departure_status,
             d.occupied_seats, d.passenger_capacity, b.status::text AS boarding_status,
             b.passenger_id, s.id AS sale_id, s.payment_method::text AS payment_method,
             s.cash_shift_id, b.seat_number, f.vehicle_type_id,
             b.amount_charged::text AS amount_charged, b.fare_category::text AS fare_category
      FROM boardings b
      JOIN departures d ON d.id = b.departure_id
      JOIN sales s ON s.id = b.sale_id
      JOIN fares f ON f.id = b.fare_id
      WHERE b.id = ${boardingId}::uuid AND d.origin_dock_id = ${dockId}::uuid
      FOR UPDATE OF d, b, s`;
    const row = rows[0];
    if (!row) return null;

    return {
      boardingId: row.boarding_id,
      departureId: row.departure_id,
      departureStatus: row.departure_status,
      occupiedSeats: Number(row.occupied_seats),
      passengerCapacity: Number(row.passenger_capacity),
      boardingStatus: row.boarding_status,
      passengerId: row.passenger_id,
      saleId: row.sale_id,
      paymentMethod: row.payment_method,
      cashShiftId: row.cash_shift_id,
      seatNumber: Number(row.seat_number),
      vehicleTypeId: row.vehicle_type_id,
      amount: Money.fromPesos(row.amount_charged),
      fareCategory: row.fare_category,
    };
  }

  async cancelBoarding(
    tx: Tx,
    input: {
      boarding: LockedBoardingCancellation;
      adminId: string;
      deviceId: string;
      reason: string;
      at: Date;
    },
  ): Promise<void> {
    const { boarding } = input;
    const changed = await tx.boarding.updateMany({
      where: { id: boarding.boardingId, status: "BOARDED" },
      data: { status: "CANCELLED", cancelReason: input.reason },
    });
    if (changed.count !== 1) {
      throw new BoardingError(
        "BOARDING_NOT_CANCELLABLE",
        "Este abordaje ya fue cancelado o reasignado.",
      );
    }

    const freedSeat = await tx.departure.updateMany({
      where: { id: boarding.departureId, occupiedSeats: { gt: 0 } },
      data: { occupiedSeats: { decrement: 1 }, version: { increment: 1 } },
    });
    if (freedSeat.count !== 1) {
      throw new DomainError(
        "DEPARTURE_OCCUPANCY_INCONSISTENT",
        "No se pudo liberar el lugar porque la ocupación de la salida no coincide.",
      );
    }

    if (boarding.vehicleTypeId !== null) {
      const freedVehicleSpace = await tx.departureVehicleCapacity.updateMany({
        where: {
          departureId: boarding.departureId,
          vehicleTypeId: boarding.vehicleTypeId,
          occupied: { gt: 0 },
        },
        data: { occupied: { decrement: 1 } },
      });
      if (freedVehicleSpace.count !== 1) {
        throw new DomainError(
          "VEHICLE_OCCUPANCY_INCONSISTENT",
          "No se pudo liberar el espacio del vehículo.",
        );
      }
    }

    if (boarding.paymentMethod === "BALANCE") {
      if (!boarding.passengerId) {
        throw new DomainError(
          "REFUND_WALLET_MISSING",
          "No se encontró el monedero para reembolsar este abordaje.",
        );
      }
      await this.wallets.credit(
        tx,
        {
          userId: boarding.passengerId,
          amount: boarding.amount,
          type: "REFUND",
          performedById: input.adminId,
          at: input.at,
          reason: input.reason,
          saleId: boarding.saleId,
        },
        {
          userId: input.adminId,
          action: "WALLET_BOARDING_REFUND",
          details: {
            boardingId: boarding.boardingId,
            departureId: boarding.departureId,
            amountCents: boarding.amount.cents,
            reason: input.reason,
          },
        },
      );
    } else {
      if (!boarding.cashShiftId) {
        throw new DomainError(
          "CASH_SHIFT_REQUIRED",
          "No se encontró el turno de caja asociado para registrar la devolución.",
        );
      }
      await tx.auditLog.create({
        data: auditLogData({
          userId: input.adminId,
          deviceId: input.deviceId,
          action: "TICKET_OFFICE_CASH_REFUND",
          entity: "cash_shifts",
          entityId: boarding.cashShiftId,
          details: {
            boardingId: boarding.boardingId,
            saleId: boarding.saleId,
            amountCents: boarding.amount.cents,
            seatNumber: boarding.seatNumber,
            reason: input.reason,
          },
        }),
      });
    }

    await tx.auditLog.create({
      data: auditLogData({
        userId: input.adminId,
        deviceId: input.deviceId,
        action: "BOARDING_CANCELLED",
        entity: "boardings",
        entityId: boarding.boardingId,
        details: {
          departureId: boarding.departureId,
          saleId: boarding.saleId,
          seatNumber: boarding.seatNumber,
          fareCategory: boarding.fareCategory,
          paymentMethod: boarding.paymentMethod,
          amountCents: boarding.amount.cents,
          reason: input.reason,
        },
      }),
    });
  }

  async findPassenger(tx: Tx, userId: string): Promise<BoardingPassenger | null> {
    const user = await tx.user.findFirst({
      where: { id: userId, role: "PASSENGER" },
      select: {
        id: true,
        fullName: true,
        status: true,
        deletedAt: true,
        discountRequests: {
          where: { status: "APPROVED" },
          orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { discountType: true, status: true, validUntil: true },
        },
      },
    });
    if (!user) return null;
    const discount = user.discountRequests[0];
    return {
      id: user.id,
      fullName: user.fullName,
      active: user.status === "ACTIVE" && user.deletedAt === null,
      discount: discount
        ? { type: discount.discountType, status: discount.status, validUntil: discount.validUntil }
        : null,
    };
  }

  async hasActiveBoarding(tx: Tx, departureId: string, passengerId: string): Promise<boolean> {
    const count = await tx.boarding.count({
      where: { departureId, passengerId, status: "BOARDED" },
    });
    return count > 0;
  }

  async listPassengerVehicles(tx: Tx, ownerId: string): Promise<BoardingVehicle[]> {
    const vehicles = await tx.vehicle.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { plate: "asc" },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        color: true,
        vehicleType: { select: { id: true, name: true } },
      },
    });
    return vehicles.map((v) => ({
      id: v.id,
      vehicleTypeId: v.vehicleType.id,
      vehicleTypeName: v.vehicleType.name,
      plate: v.plate,
      description: `${v.brand} ${v.model} ${v.color}`,
    }));
  }

  async getVehicleSpace(tx: Tx, departureId: string, vehicleTypeId: number) {
    return tx.departureVehicleCapacity.findUnique({
      where: { departureId_vehicleTypeId: { departureId, vehicleTypeId } },
      select: { capacity: true, occupied: true },
    });
  }

  async listFares(tx: Tx, vesselKind: VesselKind, at: Date): Promise<FareOption[]> {
    const rows = await tx.fare.findMany({
      where: {
        vesselKind,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
      },
    });
    return rows.map((row) => ({
      id: row.id,
      vesselKind: row.vesselKind,
      category: row.category,
      vehicleTypeId: row.vehicleTypeId,
      amount: Money.fromPesos(row.amount),
      validFrom: row.validFrom,
      validTo: row.validTo,
    }));
  }

  async getBalance(tx: Tx, userId: string): Promise<Money | null> {
    const wallet = await tx.wallet.findUnique({ where: { userId }, select: { balance: true } });
    return wallet ? Money.fromPesos(wallet.balance) : null;
  }

  async createBoarding(
    tx: Tx,
    data: CreateBoardingData,
    audit: ChangeAudit,
  ): Promise<CreatedBoarding> {
    const sale = await tx.sale.create({
      data: {
        channel: "QR_BALANCE",
        passengerId: data.passengerId,
        registeredById: data.registeredById,
        deviceId: data.deviceId,
        paymentMethod: "BALANCE",
        ticketCount: 1,
        totalAmount: data.amount.toDecimalString(),
        createdAt: data.at,
      },
      select: { id: true },
    });

    // El cobro reutiliza el monedero (bloqueo optimista + movimiento FARE_CHARGE + bitácora).
    const charge = await this.wallets.debit(
      tx,
      {
        userId: data.passengerId,
        amount: data.amount,
        type: "FARE_CHARGE",
        performedById: data.registeredById,
        at: data.at,
        reason: `Cruce · lugar ${data.seatNumber}`,
        saleId: sale.id,
      },
      { userId: audit.userId, action: "WALLET_FARE_CHARGE", details: { saleId: sale.id } },
    );

    const boarding = await tx.boarding.create({
      data: {
        departureId: data.departureId,
        saleId: sale.id,
        passengerId: data.passengerId,
        vehicleId: data.vehicleId,
        seatNumber: data.seatNumber,
        fareId: data.fareId,
        fareCategory: data.fareCategory,
        amountCharged: data.amount.toDecimalString(),
        qrCredentialId: data.qrCredentialId,
        qrTimeStep: BigInt(data.qrTimeStep),
        createdAt: data.at,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: auditLogData({
        ...audit,
        deviceId: data.deviceId,
        entity: "boardings",
        entityId: boarding.id,
      }),
    });

    return {
      saleId: sale.id,
      boardingId: boarding.id,
      balanceAfter: Money.fromCents(charge.balanceAfterCents),
    };
  }

  async occupySeat(
    tx: Tx,
    input: { departureId: string; vehicleTypeId: number | null; closeWhenFull: boolean; at: Date },
  ): Promise<OccupySeatResult> {
    const departure = await tx.departure.update({
      where: { id: input.departureId },
      data: {
        occupiedSeats: { increment: 1 },
        version: { increment: 1 },
        ...(input.closeWhenFull ? { status: "BOARDING_CLOSED", boardingClosedAt: input.at } : {}),
      },
      select: { originDockId: true },
    });

    if (input.vehicleTypeId !== null) {
      await tx.departureVehicleCapacity.update({
        where: {
          departureId_vehicleTypeId: {
            departureId: input.departureId,
            vehicleTypeId: input.vehicleTypeId,
          },
        },
        data: { occupied: { increment: 1 } },
      });
    }

    if (!input.closeWhenFull) return { departureClosed: false, nextDepartureId: null };

    // Se llenó: pasa a abordar la siguiente de la fila del mismo muelle, con las MISMAS reglas
    // de la fila (#43): la de menor posición, y las demás se renumeran 1, 2, 3…
    const queued = await tx.departure.findMany({
      where: { originDockId: departure.originDockId, status: "QUEUED" },
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
      select: { id: true, queuePosition: true },
    });
    const next = pickNextInQueue(queued);
    if (!next) return { departureClosed: true, nextDepartureId: null };

    await tx.departure.update({
      where: { id: next.id },
      data: {
        status: "BOARDING",
        boardingStartedAt: input.at,
        queuePosition: null,
        version: { increment: 1 },
      },
    });
    for (const item of reorderQueue(queued.filter((d) => d.id !== next.id))) {
      await tx.departure.update({
        where: { id: item.id },
        data: { queuePosition: item.queuePosition, version: { increment: 1 } },
      });
    }
    return { departureClosed: true, nextDepartureId: next.id };
  }
}
