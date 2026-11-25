import type { DockOption, StaffAccount, StaffFilter, StaffRepository } from "./ports";
import { findStaffOrFail } from "./staff-shared";
import { staffFilterSchema } from "./staff-input";

/** Lista del personal con filtros por rol y estado (RF-116 a RF-118). */
export function createListStaff(deps: { staff: StaffRepository }) {
  return async function listStaff(rawFilter: unknown = {}): Promise<{
    filter: StaffFilter;
    accounts: StaffAccount[];
  }> {
    const parsed = staffFilterSchema.safeParse(rawFilter ?? {});
    const filter: StaffFilter = parsed.success ? parsed.data : {};
    return { filter, accounts: await deps.staff.list(filter) };
  };
}

/** Detalle de una cuenta del personal (lanza STAFF_NOT_FOUND si no es admin ni chofer). */
export function createGetStaffAccount(deps: { staff: StaffRepository }) {
  return (staffId: unknown): Promise<StaffAccount> => findStaffOrFail(deps.staff, staffId);
}

export function createListDocks(deps: { staff: StaffRepository }) {
  return (): Promise<DockOption[]> => deps.staff.listDocks();
}
