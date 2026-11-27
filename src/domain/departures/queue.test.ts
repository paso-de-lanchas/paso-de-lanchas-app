import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/shared/domain-error";
import { pickNextInQueue, reorderQueue } from "./queue";

describe("queue domain helpers", () => {
  it("reordena posiciones consecutivas desde 1 según orden explícito", () => {
    const result = reorderQueue(
      [
        { id: "d-1", queuePosition: 1 },
        { id: "d-2", queuePosition: 2 },
        { id: "d-3", queuePosition: 3 },
      ],
      ["d-3", "d-1", "d-2"],
    );

    expect(result).toEqual([
      { id: "d-3", queuePosition: 1 },
      { id: "d-1", queuePosition: 2 },
      { id: "d-2", queuePosition: 3 },
    ]);
  });

  it("normaliza posiciones consecutivas cuando no se pasa orden explícito", () => {
    const result = reorderQueue([
      { id: "d-2", queuePosition: 5 },
      { id: "d-1", queuePosition: 2 },
    ]);

    expect(result).toEqual([
      { id: "d-1", queuePosition: 1 },
      { id: "d-2", queuePosition: 2 },
    ]);
  });

  it("lanza DomainError si el orden explícito es inválido", () => {
    expect(() =>
      reorderQueue(
        [
          { id: "d-1", queuePosition: 1 },
          { id: "d-2", queuePosition: 2 },
        ],
        ["d-1", "d-1"],
      ),
    ).toThrow(DomainError);
  });

  it("elige la siguiente salida con menor queuePosition", () => {
    const next = pickNextInQueue([
      { id: "d-2", queuePosition: 2 },
      { id: "d-1", queuePosition: 1 },
      { id: "d-4", queuePosition: null },
    ]);

    expect(next?.id).toBe("d-1");
  });
});
