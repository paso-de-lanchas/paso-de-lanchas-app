import type { DriverAssignment } from "../../domain/drivers/driver-assignment";

export interface DriverAccount {
  id: string;
  role: string;
  status: string;
  deletedAt: Date | null;
}

export interface DriverSummary {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  photoUrl: string | null;
  status: string;
  activeAssignments: Array<{
    id: string;
    vesselId: string;
    vesselCode: string;
    vesselName: string;
    assignedAt: Date;
  }>;
  assignmentHistory: Array<{
    id: string;
    vesselId: string;
    vesselCode: string;
    vesselName: string;
    assignedAt: Date;
    unassignedAt: Date | null;
  }>;
}

export interface AssignableVessel {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
}

export interface DriverUpdateData {
  fullName: string;
  photoUrl: string | null;
  phone: string | null;
}

export interface VesselRecord {
  id: string;
}

export interface DriverAssignmentRecord extends DriverAssignment {
  id: string;
}

export interface DriverAssignmentRepository {
  findDriverById(driverId: string): Promise<DriverAccount | null>;
  findVesselById(vesselId: string): Promise<VesselRecord | null>;
  findActiveAssignment(driverId: string, vesselId: string): Promise<DriverAssignmentRecord | null>;
  createAssignment(assignment: DriverAssignment): Promise<DriverAssignmentRecord>;
  findAssignmentById(assignmentId: string): Promise<DriverAssignmentRecord | null>;
  updateUnassignedAt(assignmentId: string, unassignedAt: Date): Promise<DriverAssignmentRecord>;
  listByVessel(vesselId: string): Promise<DriverAssignmentRecord[]>;
}

export interface DriverRepository extends DriverAssignmentRepository {
  listDrivers(search?: string): Promise<DriverSummary[]>;
  getDriverById(driverId: string): Promise<DriverSummary | null>;
  updateDriverProfile(driverId: string, data: DriverUpdateData): Promise<DriverSummary>;
  listAssignableVessels(): Promise<AssignableVessel[]>;
}
