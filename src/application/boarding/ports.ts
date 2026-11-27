import type { ChangeAudit } from "@/application/shared/ports";
import type { VesselKind } from "@/domain/fares/fare";
import type { FareOption, PassengerDiscount } from "@/domain/fares/fare-strategy";
import type { FareCategory } from "@/domain/fares/fare";
import type { VehicleSpace } from "@/domain/boarding/boarding";
import type { Money } from "@/domain/shared/money";

/** QR ya verificado (firma TOTP y credencial vigente). */
export interface ScannedQr {
  userId: string;
  credentialId: string;
  timeStep: number;
}

/** Verifica el texto del QR. Devuelve null si no es válido (sin decir por qué). */
export interface QrScanVerifier {
  verify(raw: string): Promise<ScannedQr | null>;
}

/** La salida que está abordando en el muelle, ya bloqueada dentro de la transacción. */
export interface LockedDeparture {
  id: string;
  status: string;
  vesselKind: VesselKind;
  vesselName: string;
  destinationDockName: string;
  passengerCapacity: number;
  occupiedSeats: number;
  /** Mayor número de lugar ya usado en la salida (incluye cancelados); null si no hay. */
  highestSeat: number | null;
}

export interface BoardingPassenger {
  id: string;
  fullName: string;
  /** Pasajero con cuenta ACTIVA y sin borrar. */
  active: boolean;
  /** Último descuento del pasajero (la estrategia decide si sigue vigente). */
  discount: PassengerDiscount | null;
}

export interface BoardingVehicle {
  id: string;
  vehicleTypeId: number;
  vehicleTypeName: string;
  plate: string;
  description: string;
}

export interface CreateBoardingData {
  departureId: string;
  passengerId: string;
  vehicleId: string | null;
  seatNumber: number;
  fareId: string;
  fareCategory: FareCategory;
  amount: Money;
  qrCredentialId: string;
  qrTimeStep: number;
  registeredById: string;
  deviceId: string;
  at: Date;
}

export interface CreatedBoarding {
  saleId: string;
  boardingId: string;
  balanceAfter: Money;
}

export interface OccupySeatResult {
  /** La salida se llenó y se cerró. */
  departureClosed: boolean;
  /** Salida que pasó a abordar en su lugar (si había una en fila). */
  nextDepartureId: string | null;
}

/**
 * Todo lo que el escaneo necesita de la base, DENTRO de una sola transacción (Unit of Work).
 * `Tx` es el contexto de la transacción (en Prisma, el `TransactionClient`).
 */
export interface BoardingStore<Tx = unknown> {
  /** Corre `work` en una transacción: si algo falla, no se aplica nada. */
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
  /** `SELECT … FOR UPDATE` de la salida en estado BOARDING del muelle. */
  lockBoardingDeparture(tx: Tx, dockId: string): Promise<LockedDeparture | null>;
  findPassenger(tx: Tx, userId: string): Promise<BoardingPassenger | null>;
  hasActiveBoarding(tx: Tx, departureId: string, passengerId: string): Promise<boolean>;
  listPassengerVehicles(tx: Tx, ownerId: string): Promise<BoardingVehicle[]>;
  getVehicleSpace(tx: Tx, departureId: string, vehicleTypeId: number): Promise<VehicleSpace | null>;
  listFares(tx: Tx, vesselKind: VesselKind, at: Date): Promise<FareOption[]>;
  getBalance(tx: Tx, userId: string): Promise<Money | null>;
  /** Crea la venta (canal QR_BALANCE), cobra del saldo (FARE_CHARGE) y crea el abordaje. */
  createBoarding(tx: Tx, data: CreateBoardingData, audit: ChangeAudit): Promise<CreatedBoarding>;
  /** Ocupa el lugar (y el espacio del vehículo); si se llena, cierra y pasa la siguiente. */
  occupySeat(
    tx: Tx,
    input: { departureId: string; vehicleTypeId: number | null; closeWhenFull: boolean; at: Date },
  ): Promise<OccupySeatResult>;
}
