import type { VesselKind } from "@/domain/fares/fare";
import type { FareCategory } from "@/domain/fares/fare";

/** Lo que el admin ve arriba del escáner: la embarcación que aborda en su muelle. */
export interface DockBoardingSummary {
  departureId: string;
  vesselName: string;
  vesselKind: VesselKind;
  destinationDockName: string;
  passengerCapacity: number;
  occupiedSeats: number;
  vehicleSpaces: Array<{ vehicleTypeName: string; capacity: number; occupied: number }>;
}

/** Confirmación que el pasajero ve en su celular (RF-051). */
export interface PassengerBoardingView {
  boardingId: string;
  seatNumber: number;
  vesselName: string;
  vesselKind: VesselKind;
  originDockName: string;
  destinationDockName: string;
  fareCategory: FareCategory;
  amountCents: number;
  departureStatus: "BOARDING" | "BOARDING_CLOSED" | "IN_TRANSIT";
  boardedAt: string;
  vehiclePlate: string | null;
}

export interface BoardingQueries {
  findDockBoarding(dockId: string): Promise<DockBoardingSummary | null>;
  /** Abordaje vigente del pasajero (salida que aún no termina), o null. */
  findCurrentPassengerBoarding(passengerId: string): Promise<PassengerBoardingView | null>;
}
