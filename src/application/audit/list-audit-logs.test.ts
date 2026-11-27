import { describe, expect, it } from "vitest";

import {
  AUDIT_PAGE_SIZE,
  createListAuditLogs,
  parseAuditLogFilters,
  type AuditLogQuery,
  type AuditLogReader,
  type AuditLogRow,
} from "./list-audit-logs";

function fakeReader(total = 0, rows: AuditLogRow[] = []) {
  const queries: AuditLogQuery[] = [];
  const reader: AuditLogReader = {
    async list(query) {
      queries.push(query);
      return { rows, total };
    },
    async listActions() {
      return ["LOGIN_SUCCEEDED", "WALLET_TOPUP_CASH"];
    },
  };
  return { reader, queries };
}

const row: AuditLogRow = {
  id: "1",
  createdAt: new Date("2026-11-27T18:00:00.000Z"),
  userEmail: "admin.coa@pasolanchas.test",
  userName: "Admin",
  deviceName: "Taquilla 1",
  action: "WALLET_TOPUP_CASH",
  entity: "wallet_transactions",
  entityId: "tx-1",
  details: { amountCents: 5000, token: "no-debe-verse" },
};

describe("filtros de la bitácora", () => {
  it("acepta usuario, acción, rango y página válidos", () => {
    const { filters, invalid } = parseAuditLogFilters({
      usuario: "  Admin.COA@pasolanchas.test ",
      accion: "WALLET_TOPUP_CASH",
      desde: "2026-11-20",
      hasta: "2026-11-27",
      pagina: "2",
    });
    expect(invalid).toEqual([]);
    expect(filters).toEqual({
      usuario: "admin.coa@pasolanchas.test",
      accion: "WALLET_TOPUP_CASH",
      desde: "2026-11-20",
      hasta: "2026-11-27",
      pagina: 2,
    });
  });

  it("ignora lo inválido sin tronar y avisa qué se ignoró", () => {
    const { filters, invalid } = parseAuditLogFilters({
      accion: "drop table; --",
      pagina: "-3",
      desde: "2026-02-31",
      usuario: "x".repeat(200),
    });
    expect(filters.accion).toBeUndefined();
    expect(filters.pagina).toBeUndefined();
    expect(filters.usuario).toBeUndefined();
    expect(invalid).toEqual(expect.arrayContaining(["accion", "pagina", "desde", "usuario"]));
  });

  it("acepta acciones con números (MAYÚSCULAS, números y guion bajo)", () => {
    expect(parseAuditLogFilters({ accion: "TEST_2026_A" }).filters.accion).toBe("TEST_2026_A");
    expect(parseAuditLogFilters({ accion: "login" }).invalid).toEqual(["accion"]);
  });

  it("rechaza un rango al revés", () => {
    expect(parseAuditLogFilters({ desde: "2026-11-27", hasta: "2026-11-20" }).invalid).toEqual([
      "hasta",
    ]);
  });

  it("toma el primer valor si el parámetro viene repetido", () => {
    expect(parseAuditLogFilters({ accion: ["LOGOUT", "LOGIN_FAILED"] }).filters.accion).toBe(
      "LOGOUT",
    );
  });
});

describe("consultar la bitácora", () => {
  it("pasa los filtros al lector con el rango en hora de México y la página", async () => {
    const { reader, queries } = fakeReader(120);
    const page = await createListAuditLogs(reader)({
      usuario: "admin",
      accion: "LOGOUT",
      desde: "2026-11-27",
      hasta: "2026-11-27",
      pagina: "3",
    });
    expect(queries[0]).toEqual({
      userEmail: "admin",
      action: "LOGOUT",
      from: new Date("2026-11-27T06:00:00.000Z"),
      toExclusive: new Date("2026-11-28T06:00:00.000Z"),
      skip: 2 * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    });
    expect(page).toMatchObject({ page: 3, totalPages: 3, total: 120 });
    expect(page.actions).toEqual(["LOGIN_SUCCEEDED", "WALLET_TOPUP_CASH"]);
  });

  it("sin filtros trae la primera página de todo", async () => {
    const { reader, queries } = fakeReader(0);
    const page = await createListAuditLogs(reader)({});
    expect(queries[0]).toEqual({ skip: 0, take: AUDIT_PAGE_SIZE });
    expect(page.totalPages).toBe(1);
  });

  it("con un rango inválido no filtra por fecha", async () => {
    const { reader, queries } = fakeReader(0);
    await createListAuditLogs(reader)({ desde: "2026-11-27", hasta: "2026-11-01" });
    expect(queries[0]?.from).toBeUndefined();
    expect(queries[0]?.toExclusive).toBeUndefined();
  });

  it("nunca muestra secretos del detalle", async () => {
    const { reader } = fakeReader(1, [row]);
    const page = await createListAuditLogs(reader)({});
    expect(page.rows[0]?.details).toEqual({ amountCents: 5000, token: "[oculto]" });
  });
});
