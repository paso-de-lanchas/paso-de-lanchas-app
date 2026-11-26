import { prisma } from "@/infrastructure/db/prisma";
import type {
  AssignableVessel,
  DriverAccount,
  DriverAssignmentRecord,
  DriverRepository,
  DriverSummary,
  DriverUpdateData,
  VesselRecord,
} from "@/application/drivers/ports";
import type { DriverAssignment } from "@/domain/drivers/driver-assignment";

function toAssignmentRecord(record: {
  id: string;
  driverId: string;
  vesselId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
}): DriverAssignmentRecord {
  return {
    id: record.id,
    driverId: record.driverId,
    vesselId: record.vesselId,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt,
  };
}

export class PrismaDriverRepository implements DriverRepository {
  async findDriverById(driverId: string): Promise<DriverAccount | null> {
    return prisma.user.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });
  }

  async findVesselById(vesselId: string): Promise<VesselRecord | null> {
    return prisma.vessel.findUnique({
      where: { id: vesselId },
      select: {
        id: true,
      },
    });
  }

  async findActiveAssignment(
    driverId: string,
    vesselId: string,
  ): Promise<DriverAssignmentRecord | null> {
    const assignment = await prisma.vesselDriver.findFirst({
      where: {
        driverId,
        vesselId,
        unassignedAt: null,
      },
    });

    return assignment ? toAssignmentRecord(assignment) : null;
  }

  async createAssignment(assignment: DriverAssignment): Promise<DriverAssignmentRecord> {
    const created = await prisma.vesselDriver.create({
      data: {
        driverId: assignment.driverId,
        vesselId: assignment.vesselId,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
      },
    });

    return toAssignmentRecord(created);
  }

  async findAssignmentById(assignmentId: string): Promise<DriverAssignmentRecord | null> {
    const assignment = await prisma.vesselDriver.findUnique({
      where: { id: assignmentId },
    });

    return assignment ? toAssignmentRecord(assignment) : null;
  }

  async updateUnassignedAt(
    assignmentId: string,
    unassignedAt: Date,
  ): Promise<DriverAssignmentRecord> {
    const updated = await prisma.vesselDriver.update({
      where: { id: assignmentId },
      data: { unassignedAt },
    });

    return toAssignmentRecord(updated);
  }

  async listByVessel(vesselId: string): Promise<DriverAssignmentRecord[]> {
    const assignments = await prisma.vesselDriver.findMany({
      where: { vesselId },
      orderBy: { assignedAt: "desc" },
    });

    return assignments.map(toAssignmentRecord);
  }

  private async hydrateDrivers(
    users: Array<{
      id: string;
      email: string;
      fullName: string;
      phone: string | null;
      photoUrl: string | null;
      status: string;
    }>,
  ): Promise<DriverSummary[]> {
    if (users.length === 0) return [];

    const driverIds = users.map((u) => u.id);
    const [assignments, vessels] = await Promise.all([
      prisma.vesselDriver.findMany({
        where: { driverId: { in: driverIds } },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.vessel.findMany({
        select: { id: true, code: true, name: true },
      }),
    ]);

    const vesselMap = new Map(vessels.map((v) => [v.id, v]));
    const byDriver = new Map<string, DriverSummary["assignmentHistory"]>();

    for (const a of assignments) {
      const vessel = vesselMap.get(a.vesselId);
      const list = byDriver.get(a.driverId) ?? [];
      list.push({
        id: a.id,
        vesselId: a.vesselId,
        vesselCode: vessel?.code ?? "EMB",
        vesselName: vessel?.name ?? "Embarcación",
        assignedAt: a.assignedAt,
        unassignedAt: a.unassignedAt,
      });
      byDriver.set(a.driverId, list);
    }

    return users.map((row) => {
      const history = byDriver.get(row.id) ?? [];
      const activeAssignments = history
        .filter((item) => item.unassignedAt === null)
        .map((item) => ({
          id: item.id,
          vesselId: item.vesselId,
          vesselCode: item.vesselCode,
          vesselName: item.vesselName,
          assignedAt: item.assignedAt,
        }));

      return {
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        phone: row.phone,
        photoUrl: row.photoUrl,
        status: row.status,
        activeAssignments,
        assignmentHistory: history,
      };
    });
  }

  async listDrivers(search?: string): Promise<DriverSummary[]> {
    const trimmed = search?.trim();
    const rows = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        deletedAt: null,
        ...(trimmed
          ? {
              OR: [
                { fullName: { contains: trimmed, mode: "insensitive" } },
                { email: { contains: trimmed, mode: "insensitive" } },
                { phone: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        photoUrl: true,
        status: true,
      },
    });

    return this.hydrateDrivers(rows);
  }

  async getDriverById(driverId: string): Promise<DriverSummary | null> {
    const row = await prisma.user.findFirst({
      where: {
        id: driverId,
        role: "DRIVER",
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        photoUrl: true,
        status: true,
      },
    });

    if (!row) return null;
    const [summary] = await this.hydrateDrivers([row]);
    return summary ?? null;
  }

  async updateDriverProfile(driverId: string, data: DriverUpdateData): Promise<DriverSummary> {
    const updated = await prisma.user.update({
      where: { id: driverId },
      data: {
        fullName: data.fullName,
        photoUrl: data.photoUrl,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        photoUrl: true,
        status: true,
      },
    });

    const [summary] = await this.hydrateDrivers([updated]);
    return summary;
  }

  async listAssignableVessels(): Promise<AssignableVessel[]> {
    return prisma.vessel.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        status: true,
      },
    });
  }
}
