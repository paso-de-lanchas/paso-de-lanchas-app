import { beforeEach, describe, expect, it } from "vitest";

import type { AuditEntry, ChangeAudit } from "@/application/shared/ports";
import { InputError } from "@/application/shared/input-error";
import { BoardingError } from "@/domain/boarding/boarding";
import type { FareOption } from "@/domain/fares/fare-strategy";
import { DomainError } from "@/domain/shared/domain-error";
import { Money } from "@/domain/shared/money";

import { createBoardWithQr, type BoardingActor } from "./board-with-qr";
import type {
  BoardingPassenger,
  BoardingStore,
  BoardingVehicle,
  CreateBoardingData,
  LockedDeparture,
  ScannedQr,
} from "./ports";

const NOW = new Date("2026-11-27T18:00:00.000Z");
const ADMIN: BoardingActor = { adminId: "admin-1", dockId: "dock-coa", deviceId: "device-1" };
const CAR_ID = "11111111-1111-4111-8111-111111111111";
const MOTO_ID = "22222222-2222-4222-8222-222222222222";

interface State {
  departure: (LockedDeparture & { dockId: string }) | null;
  passengers: Map<string, BoardingPassenger>;
  balances: Map<string, number>;
  vehicles: Map<string, BoardingVehicle[]>;
  vehicleSpace: Map<number, { capacity: number; occupied: number }>;
  boardings: Array<CreateBoardingData & { id: string; status: "BOARDED" }>;
  fares: FareOption[];
  closed: boolean;
  audits: ChangeAudit[];
}

function fare(overrides: Partial<FareOption>): FareOption {
  return {
    id: "fare-general",
    vesselKind: "BOAT",
    category: "GENERAL",
    vehicleTypeId: null,
    amount: Money.fromPesos("10.00"),
    validFrom: new Date("2026-11-01T00:00:00.000Z"),
    validTo: null,
    ...overrides,
  };
}

/** Base en memoria con transacciones de verdad: si `work` falla, se restaura todo. */
class InMemoryBoardingStore implements BoardingStore<"tx"> {
  state: State;
  failOn: "occupySeat" | "createBoarding" | null = null;
  concurrentFailures = 0;
  runs = 0;

  constructor(state: State) {
    this.state = state;
  }

  private snapshot(): State {
    return {
      ...this.state,
      departure: this.state.departure ? { ...this.state.departure } : null,
      balances: new Map(this.state.balances),
      vehicleSpace: new Map([...this.state.vehicleSpace].map(([k, v]) => [k, { ...v }])),
      boardings: [...this.state.boardings],
      audits: [...this.state.audits],
    };
  }

  async run<T>(work: (tx: "tx") => Promise<T>): Promise<T> {
    this.runs++;
    const before = this.snapshot();
    try {
      if (this.concurrentFailures > 0) {
        this.concurrentFailures--;
        throw new DomainError("CONCURRENT_UPDATE", "El saldo cambió.");
      }
      return await work("tx");
    } catch (error) {
      this.state = before;
      throw error;
    }
  }

  async lockBoardingDeparture(_tx: "tx", dockId: string) {
    const d = this.state.departure;
    return d && d.dockId === dockId && d.status === "BOARDING" ? { ...d } : null;
  }

  async findPassenger(_tx: "tx", userId: string) {
    return this.state.passengers.get(userId) ?? null;
  }

  async hasActiveBoarding(_tx: "tx", departureId: string, passengerId: string) {
    return this.state.boardings.some(
      (b) => b.departureId === departureId && b.passengerId === passengerId,
    );
  }

  async listPassengerVehicles(_tx: "tx", ownerId: string) {
    return this.state.vehicles.get(ownerId) ?? [];
  }

  async getVehicleSpace(_tx: "tx", _departureId: string, vehicleTypeId: number) {
    return this.state.vehicleSpace.get(vehicleTypeId) ?? null;
  }

  async listFares() {
    return this.state.fares;
  }

  async getBalance(_tx: "tx", userId: string) {
    const cents = this.state.balances.get(userId);
    return cents === undefined ? null : Money.fromCents(cents);
  }

  async createBoarding(_tx: "tx", data: CreateBoardingData, audit: ChangeAudit) {
    if (this.failOn === "createBoarding") throw new Error("falla simulada");
    const balance = this.state.balances.get(data.passengerId)! - data.amount.cents;
    this.state.balances.set(data.passengerId, balance);
    const id = `boarding-${this.state.boardings.length + 1}`;
    this.state.boardings.push({ ...data, id, status: "BOARDED" });
    this.state.audits.push(audit);
    return { saleId: `sale-${id}`, boardingId: id, balanceAfter: Money.fromCents(balance) };
  }

  async occupySeat(_tx: "tx", input: { vehicleTypeId: number | null; closeWhenFull: boolean }) {
    if (this.failOn === "occupySeat") throw new Error("falla simulada");
    const d = this.state.departure!;
    d.occupiedSeats += 1;
    d.highestSeat = (d.highestSeat ?? 0) + 1;
    if (input.vehicleTypeId !== null) {
      this.state.vehicleSpace.get(input.vehicleTypeId)!.occupied += 1;
    }
    if (input.closeWhenFull) {
      d.status = "BOARDING_CLOSED";
      this.state.closed = true;
    }
    return { departureClosed: input.closeWhenFull, nextDepartureId: null };
  }
}

class FakeVerifier {
  constructor(private readonly codes: Map<string, ScannedQr>) {}
  async verify(raw: string) {
    return this.codes.get(raw) ?? null;
  }
}

let store: InMemoryBoardingStore;
let rejectedAudits: AuditEntry[];
let board: ReturnType<typeof createBoardWithQr<"tx">>;

const ana: BoardingPassenger = { id: "ana", fullName: "Ana Pérez", active: true, discount: null };
const qrAna: ScannedQr = { userId: "ana", credentialId: "cred-ana", timeStep: 100 };

function setup(overrides: Partial<State> = {}) {
  store = new InMemoryBoardingStore({
    departure: {
      id: "dep-1",
      dockId: "dock-coa",
      status: "BOARDING",
      vesselKind: "BOAT",
      vesselName: "Lancha 1",
      destinationDockName: "Villa Allende",
      passengerCapacity: 3,
      occupiedSeats: 0,
      highestSeat: null,
    },
    passengers: new Map([["ana", ana]]),
    balances: new Map([["ana", 10_000]]),
    vehicles: new Map(),
    vehicleSpace: new Map(),
    boardings: [],
    fares: [
      fare({}),
      fare({ id: "fare-student", category: "STUDENT", amount: Money.fromPesos("5.00") }),
    ],
    closed: false,
    audits: [],
    ...overrides,
  });
  rejectedAudits = [];
  board = createBoardWithQr<"tx">({
    verifier: new FakeVerifier(new Map([["QR-ANA", qrAna]])),
    store,
    auditLogger: { log: async (entry) => void rejectedAudits.push(entry) },
    clock: { now: () => NOW },
  });
}

async function errorOf(promise: Promise<unknown>): Promise<BoardingError> {
  try {
    await promise;
  } catch (error) {
    return error as BoardingError;
  }
  throw new Error("se esperaba un error");
}

describe("escanear el QR: cobro y lugar en una sola transacción", () => {
  beforeEach(() => setup());

  it("cobra la tarifa general, asigna el lugar 1 y confirma al admin", async () => {
    const result = await board({ qr: "QR-ANA" }, ADMIN);

    expect(result).toMatchObject({
      passengerName: "Ana Pérez",
      vesselName: "Lancha 1",
      destinationDockName: "Villa Allende",
      seatNumber: 1,
      fareCategory: "GENERAL",
      amountCents: 1000,
      balanceAfterCents: 9000,
      discountType: null,
      vehicle: null,
      departureClosed: false,
    });
    expect(store.state.balances.get("ana")).toBe(9000);
    expect(store.state.boardings[0]).toMatchObject({
      qrCredentialId: "cred-ana",
      qrTimeStep: 100,
      registeredById: "admin-1",
      deviceId: "device-1",
      fareId: "fare-general",
    });
    expect(store.state.audits[0]).toMatchObject({ userId: "admin-1", action: "BOARDING_QR" });
  });

  it("aplica el descuento vigente y avisa al admin para revisar la credencial", async () => {
    store.state.passengers.set("ana", {
      ...ana,
      discount: {
        type: "STUDENT",
        status: "APPROVED",
        validUntil: new Date("2026-12-31T00:00:00.000Z"),
      },
    });
    const result = await board({ qr: "QR-ANA" }, ADMIN);
    expect(result).toMatchObject({
      fareCategory: "STUDENT",
      amountCents: 500,
      discountType: "STUDENT",
    });
  });

  it("un descuento vencido cobra la tarifa general", async () => {
    store.state.passengers.set("ana", {
      ...ana,
      discount: {
        type: "STUDENT",
        status: "APPROVED",
        validUntil: new Date("2026-11-01T00:00:00.000Z"),
      },
    });
    const result = await board({ qr: "QR-ANA" }, ADMIN);
    expect(result).toMatchObject({ fareCategory: "GENERAL", discountType: null });
  });

  it("rechaza un QR inválido sin decir por qué y lo deja en la bitácora", async () => {
    const error = await errorOf(board({ qr: "PL1.basura.123456" }, ADMIN));
    expect(error.code).toBe("QR_REJECTED");
    expect(store.runs).toBe(0);
    expect(rejectedAudits).toEqual([
      expect.objectContaining({ action: "BOARDING_QR_REJECTED", userId: "admin-1" }),
    ]);
  });

  it("exige muelle asignado y computadora autorizada", async () => {
    expect((await errorOf(board({ qr: "QR-ANA" }, { ...ADMIN, dockId: null }))).code).toBe(
      "NO_DOCK_ASSIGNED",
    );
    expect((await errorOf(board({ qr: "QR-ANA" }, { ...ADMIN, deviceId: null }))).code).toBe(
      "AUTHORIZED_DEVICE_REQUIRED",
    );
    expect(store.runs).toBe(0);
  });

  it("valida la entrada con Zod", async () => {
    await expect(board({ qr: "" }, ADMIN)).rejects.toBeInstanceOf(InputError);
    await expect(board({ qr: "x".repeat(201) }, ADMIN)).rejects.toBeInstanceOf(InputError);
    await expect(board({ qr: "QR-ANA", mode: "OTRO" }, ADMIN)).rejects.toBeInstanceOf(InputError);
    // Elegir vehículo solo tiene sentido al abordar con vehículo.
    await expect(
      board({ qr: "QR-ANA", mode: "PEDESTRIAN", vehicleId: CAR_ID }, ADMIN),
    ).rejects.toBeInstanceOf(InputError);
    await expect(
      board({ qr: "QR-ANA", mode: "VEHICLE", vehicleId: "no-uuid" }, ADMIN),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("sin salida abordando en el muelle del admin no cobra", async () => {
    const otherDock = { ...ADMIN, dockId: "dock-val" };
    expect((await errorOf(board({ qr: "QR-ANA" }, otherDock))).code).toBe("NO_DEPARTURE_BOARDING");
    expect(store.state.balances.get("ana")).toBe(10_000);
  });

  it("con la embarcación llena no cobra (cero sobreventa)", async () => {
    store.state.departure!.occupiedSeats = 3;
    expect((await errorOf(board({ qr: "QR-ANA" }, ADMIN))).code).toBe("DEPARTURE_FULL");
    expect(store.state.balances.get("ana")).toBe(10_000);
  });

  it("rechaza a un pasajero inactivo o sin cuenta", async () => {
    store.state.passengers.set("ana", { ...ana, active: false });
    expect((await errorOf(board({ qr: "QR-ANA" }, ADMIN))).code).toBe("PASSENGER_NOT_ACTIVE");
    store.state.passengers.delete("ana");
    expect((await errorOf(board({ qr: "QR-ANA" }, ADMIN))).code).toBe("PASSENGER_NOT_ACTIVE");
  });

  it("no deja abordar dos veces la misma salida (RF-052)", async () => {
    await board({ qr: "QR-ANA" }, ADMIN);
    const error = await errorOf(board({ qr: "QR-ANA" }, ADMIN));
    expect(error.code).toBe("ALREADY_BOARDED");
    expect(store.state.balances.get("ana")).toBe(9000); // un solo cobro
  });

  it("con saldo insuficiente no cobra y dice cuánto falta (RF-047)", async () => {
    store.state.balances.set("ana", 350);
    const error = await errorOf(board({ qr: "QR-ANA" }, ADMIN));
    expect(error.code).toBe("INSUFFICIENT_BALANCE");
    expect(error.details).toMatchObject({ shortfallCents: 650, fareCents: 1000 });
    expect(store.state.balances.get("ana")).toBe(350);
    expect(store.state.boardings).toHaveLength(0);
  });

  it("si no hay tarifa configurada no cobra", async () => {
    store.state.fares = [];
    expect((await errorOf(board({ qr: "QR-ANA" }, ADMIN))).code).toBe("FARE_NOT_CONFIGURED");
    expect(store.state.balances.get("ana")).toBe(10_000);
  });

  it("al ocupar el último lugar cierra la salida", async () => {
    store.state.departure!.occupiedSeats = 2;
    store.state.departure!.highestSeat = 2;
    const result = await board({ qr: "QR-ANA" }, ADMIN);
    expect(result.seatNumber).toBe(3);
    expect(result.departureClosed).toBe(true);
    expect(store.state.closed).toBe(true);
  });

  it("numera después del mayor lugar usado, aunque haya cancelados", async () => {
    store.state.departure!.occupiedSeats = 1;
    store.state.departure!.highestSeat = 2; // el lugar 1 se canceló
    const result = await board({ qr: "QR-ANA" }, ADMIN);
    expect(result.seatNumber).toBe(3);
  });

  it("si falla un paso a la mitad, no se aplica ninguno (saldo intacto)", async () => {
    store.failOn = "occupySeat";
    await expect(board({ qr: "QR-ANA" }, ADMIN)).rejects.toThrow("falla simulada");
    expect(store.state.balances.get("ana")).toBe(10_000);
    expect(store.state.boardings).toHaveLength(0);
    expect(store.state.departure!.occupiedSeats).toBe(0);
  });

  it("si el saldo cambió al mismo tiempo, repite la transacción completa una sola vez", async () => {
    store.concurrentFailures = 1;
    const result = await board({ qr: "QR-ANA" }, ADMIN);
    expect(result.seatNumber).toBe(1);
    expect(store.runs).toBe(2);
    expect(store.state.boardings).toHaveLength(1);
    expect(store.state.balances.get("ana")).toBe(9000);
  });
});

describe("abordar el transbordador con vehículo", () => {
  const car: BoardingVehicle = {
    id: CAR_ID,
    vehicleTypeId: 1,
    vehicleTypeName: "Automóvil",
    plate: "YZA-123",
    description: "Nissan Versa gris",
  };
  const moto: BoardingVehicle = {
    ...car,
    id: MOTO_ID,
    vehicleTypeId: 2,
    vehicleTypeName: "Motocicleta",
    plate: "M-1",
  };

  beforeEach(() => {
    setup();
    store.state.departure = {
      ...store.state.departure!,
      vesselKind: "FERRY",
      vesselName: "Transbordador 1",
      passengerCapacity: 10,
    };
    store.state.fares = [
      fare({
        id: "fare-ped",
        vesselKind: "FERRY",
        category: "PEDESTRIAN",
        amount: Money.fromPesos("1.00"),
      }),
      fare({
        id: "fare-car",
        vesselKind: "FERRY",
        category: "VEHICLE",
        vehicleTypeId: 1,
        amount: Money.fromPesos("15.00"),
      }),
    ];
    store.state.vehicles.set("ana", [car, moto]);
    store.state.vehicleSpace.set(1, { capacity: 1, occupied: 0 });
  });

  it("a pie paga la tarifa de peatón del transbordador", async () => {
    const result = await board({ qr: "QR-ANA" }, ADMIN);
    expect(result).toMatchObject({ fareCategory: "PEDESTRIAN", amountCents: 100, vehicle: null });
  });

  it("pide elegir el vehículo sin cobrar todavía", async () => {
    const error = await errorOf(board({ qr: "QR-ANA", mode: "VEHICLE" }, ADMIN));
    expect(error.code).toBe("VEHICLE_CHOICE_REQUIRED");
    expect(error.details.vehicles).toEqual([
      expect.objectContaining({ id: CAR_ID, plate: "YZA-123" }),
      expect.objectContaining({ id: MOTO_ID }),
    ]);
    expect(store.state.balances.get("ana")).toBe(10_000);
  });

  it("cobra la tarifa del tipo de vehículo y ocupa su espacio", async () => {
    const result = await board({ qr: "QR-ANA", mode: "VEHICLE", vehicleId: CAR_ID }, ADMIN);
    expect(result).toMatchObject({
      fareCategory: "VEHICLE",
      amountCents: 1500,
      vehicle: { plate: "YZA-123", vehicleTypeName: "Automóvil" },
    });
    expect(store.state.vehicleSpace.get(1)?.occupied).toBe(1);
    expect(store.state.boardings[0]?.vehicleId).toBe(CAR_ID);
  });

  it("sin espacio para ese tipo de vehículo no cobra", async () => {
    store.state.vehicleSpace.set(1, { capacity: 1, occupied: 1 });
    expect(
      (await errorOf(board({ qr: "QR-ANA", mode: "VEHICLE", vehicleId: CAR_ID }, ADMIN))).code,
    ).toBe("VEHICLE_SPACE_FULL");
    // La motocicleta no tiene espacios configurados en esta salida.
    expect(
      (await errorOf(board({ qr: "QR-ANA", mode: "VEHICLE", vehicleId: MOTO_ID }, ADMIN))).code,
    ).toBe("VEHICLE_SPACE_FULL");
    expect(store.state.balances.get("ana")).toBe(10_000);
  });

  it("rechaza un vehículo que no es del pasajero", async () => {
    const otherId = "33333333-3333-4333-8333-333333333333";
    expect(
      (await errorOf(board({ qr: "QR-ANA", mode: "VEHICLE", vehicleId: otherId }, ADMIN))).code,
    ).toBe("VEHICLE_NOT_FOUND");
  });

  it("si el pasajero no tiene vehículos lo dice", async () => {
    store.state.vehicles.set("ana", []);
    expect((await errorOf(board({ qr: "QR-ANA", mode: "VEHICLE" }, ADMIN))).code).toBe(
      "VEHICLE_NOT_FOUND",
    );
  });

  it("la lancha no lleva vehículos", async () => {
    store.state.departure!.vesselKind = "BOAT";
    expect(
      (await errorOf(board({ qr: "QR-ANA", mode: "VEHICLE", vehicleId: CAR_ID }, ADMIN))).code,
    ).toBe("VEHICLE_NOT_ALLOWED");
  });
});
