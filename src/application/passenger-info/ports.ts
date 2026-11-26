export type VesselKindCode = "BOAT" | "FERRY";
export type BoardingDepartureStatusCode = "BOARDING" | "BOARDING_CLOSED";
export type FareCategoryCode = "GENERAL" | "STUDENT" | "INAPAM" | "PEDESTRIAN" | "VEHICLE";
export type BoardingStatusCode = "BOARDED" | "CANCELLED" | "REASSIGNED";

export interface DockBasicInfo {
  id: string;
  code: string;
  name: string;
}

export interface ActiveBoardingDepartureRow {
  id: string;
  originDockId: string;
  status: BoardingDepartureStatusCode;
  vesselName: string;
  vesselKind: VesselKindCode;
  vesselColor: string | null;
  vesselPhotoUrl: string | null;
  passengerCapacity: number;
  occupiedSeats: number;
  boardingStartedAt: Date | null;
  driverName: string | null;
}

export interface ActiveInboundDepartureRow {
  id: string;
  destinationDockId: string;
  originDockName: string;
  vesselName: string;
  vesselKind: VesselKindCode;
  vesselColor: string | null;
  vesselPhotoUrl: string | null;
  departedAt: Date | null;
}

export interface DocksLiveSnapshot {
  docks: DockBasicInfo[];
  boardingDepartures: ActiveBoardingDepartureRow[];
  inboundDepartures: ActiveInboundDepartureRow[];
  crossingMinutes: number;
}

export interface DockServiceHourRow {
  dockId: string;
  dockCode: string;
  dockName: string;
  weekday: number;
  opensAt: Date;
  closesAt: Date;
}

export interface CurrentFareRow {
  id: string;
  vesselKind: VesselKindCode;
  category: FareCategoryCode;
  vehicleTypeId: number | null;
  vehicleTypeName: string | null;
  amountCents: number;
}

export interface PassengerTripRow {
  id: string;
  createdAt: Date;
  originDockName: string;
  destinationDockName: string;
  vesselName: string;
  vesselKind: VesselKindCode;
  seatNumber: number;
  fareCategory: FareCategoryCode;
  vehiclePlate: string | null;
  amountChargedCents: number;
  status: BoardingStatusCode;
}

export interface PaginatedTripsResult {
  rows: PassengerTripRow[];
  totalItems: number;
}

export interface PassengerInfoRepository {
  getDocksLiveSnapshot(): Promise<DocksLiveSnapshot>;
  getServiceHours(): Promise<DockServiceHourRow[]>;
  getCurrentFares(at: Date): Promise<CurrentFareRow[]>;
  listPassengerTrips(
    passengerId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedTripsResult>;
}
