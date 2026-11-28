import { describe, expect, it } from "vitest";

import {
  formatAnnouncementDateTime,
  isAnnouncementActive,
  isSuspensionActive,
  parseMexicoDateTimeInput,
} from "./announcement";

describe("announcement domain rules", () => {
  const now = new Date("2026-11-28T16:00:00.000Z"); // 10:00 a. m. hora de México

  it("identifica avisos vigentes con fecha fin o indefinidos", () => {
    expect(
      isAnnouncementActive(
        {
          startsAt: new Date("2026-11-28T14:00:00.000Z"),
          endsAt: new Date("2026-11-28T20:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);

    expect(
      isAnnouncementActive(
        {
          startsAt: new Date("2026-11-28T14:00:00.000Z"),
          endsAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("rechaza avisos programados a futuro o ya vencidos", () => {
    expect(
      isAnnouncementActive(
        {
          startsAt: new Date("2026-11-28T17:00:00.000Z"),
          endsAt: null,
        },
        now,
      ),
    ).toBe(false);

    expect(
      isAnnouncementActive(
        {
          startsAt: new Date("2026-11-28T12:00:00.000Z"),
          endsAt: new Date("2026-11-28T16:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("identifica suspensiones activas e ignora servicio extraordinario o suspensiones vencidas", () => {
    expect(
      isSuspensionActive(
        {
          type: "SUSPENSION",
          startsAt: new Date("2026-11-28T15:00:00.000Z"),
          endsAt: new Date("2026-11-28T18:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);

    expect(
      isSuspensionActive(
        {
          type: "EXTRA_SERVICE",
          startsAt: new Date("2026-11-28T15:00:00.000Z"),
          endsAt: null,
        },
        now,
      ),
    ).toBe(false);

    expect(
      isSuspensionActive(
        {
          type: "SUSPENSION",
          startsAt: new Date("2026-11-28T12:00:00.000Z"),
          endsAt: new Date("2026-11-28T15:30:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("convierte fechas locales de formulario (America/Mexico_City) a instantes UTC y rechaza fechas inválidas", () => {
    const parsed = parseMexicoDateTimeInput("2026-11-28T10:30");
    expect(parsed?.toISOString()).toBe("2026-11-28T16:30:00.000Z");

    const isoParsed = parseMexicoDateTimeInput("2026-11-28T18:00:00.000Z");
    expect(isoParsed?.toISOString()).toBe("2026-11-28T18:00:00.000Z");

    expect(parseMexicoDateTimeInput("2026-02-31T10:00")).toBeNull();
    expect(parseMexicoDateTimeInput("")).toBeNull();
  });

  it("formatea fechas en zona horaria America/Mexico_City", () => {
    const formatted = formatAnnouncementDateTime(new Date("2026-11-28T16:30:00.000Z"));
    expect(formatted).toContain("10:30");
    expect(formatted).not.toContain("16:30");
  });
});
