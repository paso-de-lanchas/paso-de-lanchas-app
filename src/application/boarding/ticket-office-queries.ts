import type { FareCategory, VesselKind } from "@/domain/fares/fare";

export interface TicketOfficeFareView {
  id: string;
  category: FareCategory;
  vehicleTypeId: number | null;
  vehicleTypeName: string | null;
  amountCents: number;
}

export interface TicketOfficeDepartureView {
  id: string;
  vesselName: string;
  vesselKind: VesselKind;
  destinationDockName: string;
  passengerCapacity: number;
  occupiedSeats: number;
  maxTicketsPerSale: number;
  fares: TicketOfficeFareView[];
}

export interface CancellableBoardingView {
  id: string;
  seatNumber: number;
  ticketCode: string | null;
  fareCategory: FareCategory;
  amountCents: number;
  departureStatus: string;
  vesselName: string;
  destinationDockName: string;
  paymentMethod: "BALANCE" | "CASH";
}

export interface TicketOfficeQueries {
  findTicketOfficeDeparture(dockId: string, at: Date): Promise<TicketOfficeDepartureView | null>;
  listCancellableBoardings(dockId: string): Promise<CancellableBoardingView[]>;
}
