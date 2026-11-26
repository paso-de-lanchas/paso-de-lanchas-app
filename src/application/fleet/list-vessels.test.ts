import { describe, expect, it, vi } from "vitest";
import { createListVessels } from "./list-vessels";
import type { VesselRepository } from "./vessel-ports";

describe("createListVessels", () => {
  it("lista embarcaciones aplicando filtros por tipo y estado", async () => {
    const repo: VesselRepository = {
      create: vi.fn(),
      update: vi.fn(),
      findById: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      listVehicleTypes: vi.fn(),
    };

    const listVessels = createListVessels(repo);
    await listVessels({ kind: "FERRY", status: "ACTIVE" });

    expect(repo.list).toHaveBeenCalledWith({
      kind: "FERRY",
      status: "ACTIVE",
    });
  });
});
