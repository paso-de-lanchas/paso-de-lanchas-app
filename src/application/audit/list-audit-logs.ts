import { z } from "zod";

import { mexicoDateRange, redactAuditDetails } from "@/domain/audit/audit-log";

export const AUDIT_PAGE_SIZE = 50;

export interface AuditLogQuery {
  userEmail?: string;
  action?: string;
  from?: Date;
  toExclusive?: Date;
  skip: number;
  take: number;
}

export interface AuditLogRow {
  id: string;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
  deviceName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
}

/** Lectura de la bitácora. No hay escritura aquí: la bitácora no se modifica (RF-123). */
export interface AuditLogReader {
  list(query: AuditLogQuery): Promise<{ rows: AuditLogRow[]; total: number }>;
  listActions(): Promise<string[]>;
}

/** Lo que llega en la dirección (`?usuario=…&accion=…&desde=…&hasta=…&pagina=…`). */
export interface AuditLogFilters {
  usuario?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
}

const fieldSchemas = {
  usuario: z.string().trim().toLowerCase().min(1).max(120),
  accion: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{0,59}$/),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pagina: z.coerce.number().int().min(1).max(10_000),
};

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/**
 * Lee los filtros de la dirección sin tronar nunca: lo inválido se ignora y se avisa. Así un
 * enlace alterado a mano solo muestra la bitácora sin ese filtro.
 */
export function parseAuditLogFilters(raw: Record<string, unknown>): {
  filters: AuditLogFilters;
  invalid: string[];
} {
  const filters: AuditLogFilters = {};
  const invalid: string[] = [];
  for (const key of Object.keys(fieldSchemas) as Array<keyof typeof fieldSchemas>) {
    const value = first(raw[key]);
    if (value === undefined || value === "") continue;
    const parsed = fieldSchemas[key].safeParse(value);
    if (parsed.success) {
      (filters as Record<string, unknown>)[key] = parsed.data;
    } else {
      invalid.push(key);
    }
  }
  const range = mexicoDateRange(filters.desde, filters.hasta);
  if (filters.desde && !range.from) invalid.push("desde");
  if (filters.hasta && !range.toExclusive) invalid.push("hasta");
  if (range.from && range.toExclusive && range.from >= range.toExclusive) {
    invalid.push("hasta");
  }
  return { filters, invalid: [...new Set(invalid)] };
}

export interface AuditLogPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  totalPages: number;
  actions: string[];
  filters: AuditLogFilters;
  invalid: string[];
}

/** Consultar y filtrar la bitácora (RF-124). La página solo la llama un superadministrador. */
export function createListAuditLogs(reader: AuditLogReader) {
  return async function listAuditLogs(raw: Record<string, unknown>): Promise<AuditLogPage> {
    const { filters, invalid } = parseAuditLogFilters(raw);
    const range =
      invalid.includes("desde") || invalid.includes("hasta")
        ? {}
        : mexicoDateRange(filters.desde, filters.hasta);
    const page = filters.pagina ?? 1;

    const [{ rows, total }, actions] = await Promise.all([
      reader.list({
        userEmail: filters.usuario,
        action: filters.accion,
        ...range,
        skip: (page - 1) * AUDIT_PAGE_SIZE,
        take: AUDIT_PAGE_SIZE,
      }),
      reader.listActions(),
    ]);

    return {
      rows: rows.map((row) => ({ ...row, details: redactAuditDetails(row.details) })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
      actions,
      filters,
      invalid,
    };
  };
}
