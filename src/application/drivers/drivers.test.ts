import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { InputError } from "@/application/shared/input-error";
import { createGetDriverDetail, createListDrivers } from "./list-drivers";
import { createUpdateDriver } from "./update-driver";
import { createUnassignDriver } from "./unassign-driver";
import type {
  AssignableVessel,
  DriverAccount,
  DriverAssignmentRecord,
  DriverRepository,
  DriverSummary,
  DriverUpdateData,
  VesselRecord,
} from "./ports";
import type { DriverAssignment } from "@/domain/drivers/driver-assignment";

function createFakeRepo(seed: {
  drivers?: Array<DriverAccount & DriverSummary>;
  vessels?: Array<VesselRecord & AssignableVessel>;
  assignments?: DriverAssignmentRecord[];
}): DriverRepository {
  const drivers = seed.drivers ?? [];
  const vessels = seed.vessels ?? [];
  const assignments = seed.assignments ?? [];

  return {
    async findDriverById(id) {
      return drivers.find((d) => d.id === id) ?? null;
    },
    async findVesselById(id) {
      return vessels.find((v) => v.id === id) ?? null;
    },
    async findActiveAssignment(driverId, vesselId) {
      return (
        assignments.find(
          (a) => a.driverId === driverId && a.vesselId === vesselId && a.unassignedAt === null,
        ) ?? null
      );
    },
    async createAssignment(a: DriverAssignment) {
      const rec: DriverAssignmentRecord = { ...a, id: `asg-${assignments.length + 1}` };
      assignments.push(rec);
      return rec;
    },
    async findAssignmentById(id) {
      return assignments.find((a) => a.id === id) ?? null;
    },
    async updateUnassignedAt(id, unassignedAt) {
      const idx = assignments.findIndex((a) => a.id === id);
      assignments[idx] = { ...assignments[idx], unassignedAt };
      return assignments[idx];
    },
    async listByVessel(vesselId) {
      return assignments.filter((a) => a.vesselId === vesselId);
    },
    async listDrivers(search) {
      if (!search) return drivers;
      const q = search.toLowerCase();
      return drivers.filter(
        (d) =>
          d.fullName.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          (d.phone ?? "").toLowerCase().includes(q),
      );
    },
    async getDriverById(id) {
      return drivers.find((d) => d.id === id && d.role === "DRIVER" && d.deletedAt === null) ?? null;
    },
    async updateDriverProfile(id, data: DriverUpdateData) {
      const idx = drivers.findIndex((d) => d.id === id);
      drivers[idx] = {
        ...drivers[idx],
        fullName: data.fullName,
        photoUrl: data.photoUrl,
        phone: data.phone,
      };
      return drivers[idx];
    },
    async listAssignableVessels() {
      return vessels;
    },
  };
}

const sampleDriver: DriverAccount & DriverSummary = {
  id: "drv-1",
  role: "DRIVER",
  status: "ACTIVE",
  deletedAt: null,
  email: "chofer1@pasolanchas.test",
  fullName: "Carlos Méndez",
  phone: "9211234567",
  photoUrl: "https://example.com/carlos.jpg",
  activeAssignments: [],
  assignmentHistory: [],
};

describe("Casos de uso de choferes (#13)", () => {
  it("lista choferes y filtra por búsqueda", async () => {
    const repo = createFakeRepo({ drivers: [sampleDriver] });
    const listDrivers = createListDrivers(repo);

    expect(await listDrivers()).toHaveLength(1);
    expect(await listDrivers("Carlos")).toHaveLength(1);
    expect(await listDrivers("inexistente")).toHaveLength(0);
  });

  it("obtiene detalle del chofer y embarcaciones disponibles", async () => {
    const repo = createFakeRepo({
      drivers: [sampleDriver],
      vessels: [{ id: "v-1", code: "LAN-01", name: "Lancha 1", kind: "BOAT", status: "ACTIVE" }],
    });
    const getDetail = createGetDriverDetail(repo);
    const res = await getDetail("drv-1");

    expect(res.driver?.fullName).toBe("Carlos Méndez");
    expect(res.vessels).toHaveLength(1);
  });

  it("actualiza nombre, fotografía y teléfono de un chofer", async () => {
    const repo = createFakeRepo({ drivers: [sampleDriver] });
    const updateDriver = createUpdateDriver(repo);

    const updated = await updateDriver({
      driverId: "drv-1",
      fullName: "Carlos Méndez López",
      phone: "9217654321",
      photoUrl: "https://example.com/nuevo.png",
    });

    expect(updated.fullName).toBe("Carlos Méndez López");
    expect(updated.phone).toBe("9217654321");
    expect(updated.photoUrl).toBe("https://example.com/nuevo.png");
  });

  it("lanza InputError si el nombre es muy corto o la foto no es https/relativa", async () => {
    const repo = createFakeRepo({ drivers: [sampleDriver] });
    const updateDriver = createUpdateDriver(repo);

    await expect(updateDriver({ driverId: "drv-1", fullName: "A" })).rejects.toThrow(InputError);
    await expect(
      updateDriver({ driverId: "drv-1", fullName: "Carlos", photoUrl: "http://insegura.com/a.jpg" }),
    ).rejects.toThrow(InputError);
  });

  it("lanza DomainError si el usuario no existe o no tiene rol DRIVER", async () => {
    const nonDriver: DriverAccount & DriverSummary = {
      ...sampleDriver,
      id: "adm-1",
      role: "ADMIN",
    };
    const repo = createFakeRepo({ drivers: [nonDriver] });
    const updateDriver = createUpdateDriver(repo);

    await expect(updateDriver({ driverId: "no-existe", fullName: "Carlos" })).rejects.toThrow(
      DomainError,
    );
    await expect(updateDriver({ driverId: "adm-1", fullName: "Carlos" })).rejects.toThrow(
      DomainError,
    );
  });

  it("retira a un chofer registrando unassignedAt y rechaza si ya estaba retirada", async () => {
    const assignedAt = new Date("2026-11-20T10:00:00Z");
    const unassignedAt = new Date("2026-11-25T18:00:00Z");
    const repo = createFakeRepo({
      assignments: [
        { id: "asg-1", driverId: "drv-1", vesselId: "v-1", assignedAt, unassignedAt: null },
      ],
    });
    const unassign = createUnassignDriver(repo, { now: () => unassignedAt });

    const res = await unassign({ assignmentId: "asg-1" });
    expect(res.unassignedAt).toEqual(unassignedAt);

    await expect(unassign({ assignmentId: "asg-1" })).rejects.toThrow(DomainError);
  });
});
