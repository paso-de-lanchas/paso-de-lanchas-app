import type { AssignableVessel, DriverRepository, DriverSummary } from "./ports";

export function createListDrivers(repository: DriverRepository) {
  return async function execute(search?: string): Promise<DriverSummary[]> {
    return repository.listDrivers(search?.trim() || undefined);
  };
}

export function createGetDriverDetail(repository: DriverRepository) {
  return async function execute(driverId: string): Promise<{
    driver: DriverSummary | null;
    vessels: AssignableVessel[];
  }> {
    const [driver, vessels] = await Promise.all([
      repository.getDriverById(driverId),
      repository.listAssignableVessels(),
    ]);
    return { driver, vessels };
  };
}
