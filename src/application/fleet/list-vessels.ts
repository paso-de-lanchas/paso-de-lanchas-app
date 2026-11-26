import { DomainError } from "@/domain/shared/domain-error";
import { listVesselsFilterSchema, type ListVesselsFilterInput } from "./vessel-input";
import type { VesselDetail, VesselRepository } from "./vessel-ports";

export function createListVessels(repo: VesselRepository) {
  return async function listVessels(rawFilters?: ListVesselsFilterInput): Promise<VesselDetail[]> {
    const parsed = listVesselsFilterSchema.safeParse(rawFilters ?? {});
    if (!parsed.success) {
      throw new DomainError(
        "INVALID_VESSEL_FILTER",
        parsed.error.issues[0]?.message ?? "Filtros de flota inválidos.",
      );
    }

    return repo.list(parsed.data);
  };
}
