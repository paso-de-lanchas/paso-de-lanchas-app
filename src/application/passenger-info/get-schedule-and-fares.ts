import { type Clock, systemClock } from "@/application/shared/ports";
import { formatUtcTime } from "@/domain/passenger-info/eta";
import { Money } from "@/domain/shared/money";

import type { FareCategoryCode, PassengerInfoRepository, VesselKindCode } from "./ports";

const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export interface DailyScheduleItem {
  weekday: number;
  weekdayName: string;
  opensAt: string;
  closesAt: string;
}

export interface DockScheduleView {
  dockId: string;
  dockCode: string;
  dockName: string;
  days: DailyScheduleItem[];
}

export interface CurrentFareView {
  id: string;
  vesselKind: VesselKindCode;
  category: FareCategoryCode;
  label: string;
  amountCents: number;
  formattedAmount: string;
}

export interface ScheduleAndFaresResult {
  schedules: DockScheduleView[];
  fares: CurrentFareView[];
}

function buildFareLabel(
  vesselKind: VesselKindCode,
  category: FareCategoryCode,
  vehicleTypeName: string | null,
): string {
  if (vesselKind === "BOAT") {
    if (category === "GENERAL") return "Lancha · Pasajero general";
    if (category === "STUDENT") return "Lancha · Estudiante";
    if (category === "INAPAM") return "Lancha · INAPAM";
    return "Lancha · Tarifa";
  }

  if (category === "PEDESTRIAN") return "Transbordador · Peatón";
  if (category === "VEHICLE") {
    return vehicleTypeName
      ? `Transbordador · Vehículo (${vehicleTypeName})`
      : "Transbordador · Vehículo";
  }
  return "Transbordador · Tarifa";
}

export interface GetScheduleAndFaresDeps {
  repo: PassengerInfoRepository;
  clock?: Clock;
}

export function createGetScheduleAndFares(deps: GetScheduleAndFaresDeps) {
  const clock = deps.clock ?? systemClock;

  return async function getScheduleAndFares(): Promise<ScheduleAndFaresResult> {
    const now = clock.now();
    const [hoursRows, fareRows] = await Promise.all([
      deps.repo.getServiceHours(),
      deps.repo.getCurrentFares(now),
    ]);

    const scheduleMap = new Map<string, DockScheduleView>();
    for (const row of hoursRows) {
      let group = scheduleMap.get(row.dockId);
      if (!group) {
        group = {
          dockId: row.dockId,
          dockCode: row.dockCode,
          dockName: row.dockName,
          days: [],
        };
        scheduleMap.set(row.dockId, group);
      }
      group.days.push({
        weekday: row.weekday,
        weekdayName: WEEKDAY_NAMES[row.weekday] ?? `Día ${row.weekday}`,
        opensAt: formatUtcTime(row.opensAt),
        closesAt: formatUtcTime(row.closesAt),
      });
    }

    const fares: CurrentFareView[] = fareRows.map((fare) => ({
      id: fare.id,
      vesselKind: fare.vesselKind,
      category: fare.category,
      label: buildFareLabel(fare.vesselKind, fare.category, fare.vehicleTypeName),
      amountCents: fare.amountCents,
      formattedAmount: Money.fromCents(fare.amountCents).format(),
    }));

    return {
      schedules: Array.from(scheduleMap.values()),
      fares,
    };
  };
}
