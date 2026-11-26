import { DomainError } from "@/domain/shared/domain-error";

export const VESSEL_STATUSES = ["ACTIVE", "MAINTENANCE", "SEIZED", "OUT_OF_SERVICE"] as const;

export type VesselStatus = (typeof VESSEL_STATUSES)[number];

export class InvalidVesselStatusTransitionError extends DomainError {
  readonly from: VesselStatus;
  readonly to: VesselStatus;

  constructor(from: VesselStatus, to: VesselStatus) {
    super(
      "INVALID_VESSEL_STATUS_TRANSITION",
      `Transición de estado no permitida: de ${from} a ${to}.`,
    );
    this.name = "InvalidVesselStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export class VesselCannotOperateError extends DomainError {
  readonly status: VesselStatus;

  constructor(status: VesselStatus) {
    super(
      "VESSEL_CANNOT_OPERATE",
      `La embarcación con estado ${status} no puede operar (solo ACTIVE puede entrar a fila de muelle o iniciar viaje).`,
    );
    this.name = "VesselCannotOperateError";
    this.status = status;
  }
}

export interface VesselState {
  readonly status: VesselStatus;
  allowedTransitions(): readonly VesselStatus[];
  canTransitionTo(target: VesselStatus): boolean;
  canOperate(): boolean;
}

class ActiveVesselState implements VesselState {
  readonly status: VesselStatus = "ACTIVE";
  private readonly allowed: readonly VesselStatus[] = ["MAINTENANCE", "SEIZED", "OUT_OF_SERVICE"];

  allowedTransitions(): readonly VesselStatus[] {
    return this.allowed;
  }

  canTransitionTo(target: VesselStatus): boolean {
    return this.allowed.includes(target);
  }

  canOperate(): boolean {
    return true;
  }
}

class MaintenanceVesselState implements VesselState {
  readonly status: VesselStatus = "MAINTENANCE";
  private readonly allowed: readonly VesselStatus[] = ["ACTIVE", "OUT_OF_SERVICE"];

  allowedTransitions(): readonly VesselStatus[] {
    return this.allowed;
  }

  canTransitionTo(target: VesselStatus): boolean {
    return this.allowed.includes(target);
  }

  canOperate(): boolean {
    return false;
  }
}

class SeizedVesselState implements VesselState {
  readonly status: VesselStatus = "SEIZED";
  private readonly allowed: readonly VesselStatus[] = ["ACTIVE", "OUT_OF_SERVICE"];

  allowedTransitions(): readonly VesselStatus[] {
    return this.allowed;
  }

  canTransitionTo(target: VesselStatus): boolean {
    return this.allowed.includes(target);
  }

  canOperate(): boolean {
    return false;
  }
}

class OutOfServiceVesselState implements VesselState {
  readonly status: VesselStatus = "OUT_OF_SERVICE";
  private readonly allowed: readonly VesselStatus[] = ["ACTIVE", "MAINTENANCE"];

  allowedTransitions(): readonly VesselStatus[] {
    return this.allowed;
  }

  canTransitionTo(target: VesselStatus): boolean {
    return this.allowed.includes(target);
  }

  canOperate(): boolean {
    return false;
  }
}

const VESSEL_STATES: Record<VesselStatus, VesselState> = {
  ACTIVE: new ActiveVesselState(),
  MAINTENANCE: new MaintenanceVesselState(),
  SEIZED: new SeizedVesselState(),
  OUT_OF_SERVICE: new OutOfServiceVesselState(),
};

export function getVesselState(status: VesselStatus): VesselState {
  return VESSEL_STATES[status];
}

export function transitionVesselStatus(current: VesselStatus, next: VesselStatus): VesselStatus {
  const state = getVesselState(current);
  if (!state.canTransitionTo(next)) {
    throw new InvalidVesselStatusTransitionError(current, next);
  }
  return next;
}

export function canOperate(status: VesselStatus): boolean {
  return getVesselState(status).canOperate();
}

export function ensureVesselCanOperate(status: VesselStatus): void {
  if (!canOperate(status)) {
    throw new VesselCannotOperateError(status);
  }
}
