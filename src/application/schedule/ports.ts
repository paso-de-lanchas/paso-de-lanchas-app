import type {
  ServiceHourWindow,
  ServiceOverrideType,
  ServiceOverrideWindow,
} from "@/domain/schedule/service-hours";

export interface DockServiceOverrideRecord extends ServiceOverrideWindow {
  id: string;
  dockId: string;
  createdById: string;
}

export interface CreateDockServiceOverrideInput {
  dockId: string;
  type: ServiceOverrideType;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
  createdById: string;
}

export interface ScheduleRepository {
  listServiceHoursByDock(dockId: string): Promise<ServiceHourWindow[]>;
  listActiveOverridesByDock(dockId: string, now: Date): Promise<DockServiceOverrideRecord[]>;
  createOverride(input: CreateDockServiceOverrideInput): Promise<DockServiceOverrideRecord>;
  closeActiveOverrides(params: {
    dockId: string;
    type: ServiceOverrideType;
    endedAt: Date;
  }): Promise<number>;
  getMaxBoardingMinutes(): Promise<number>;
}
