import { DomainError } from "@/domain/shared/domain-error";

export interface QueueCandidate {
  id: string;
  queuePosition: number | null;
}

export interface ReorderedQueueItem {
  id: string;
  queuePosition: number;
}

/**
 * Normaliza y reordena las posiciones consecutivas de la fila (1, 2, 3...).
 * Si se indica `orderedIds`, respeta ese orden (validando que no falten ni sobren).
 */
export function reorderQueue(
  items: readonly QueueCandidate[],
  orderedIds?: readonly string[],
): ReorderedQueueItem[] {
  if (items.length === 0) {
    if (orderedIds && orderedIds.length > 0) {
      throw new DomainError("INVALID_QUEUE_ORDER", "No hay elementos en la fila para reordenar.");
    }
    return [];
  }

  if (orderedIds) {
    if (orderedIds.length !== items.length) {
      throw new DomainError(
        "INVALID_QUEUE_ORDER",
        "El nuevo orden debe incluir exactamente todas las salidas en fila.",
      );
    }

    const itemMap = new Map(items.map((item) => [item.id, item]));
    const seen = new Set<string>();

    for (const id of orderedIds) {
      if (!itemMap.has(id) || seen.has(id)) {
        throw new DomainError(
          "INVALID_QUEUE_ORDER",
          "El nuevo orden contiene identificadores inválidos o duplicados.",
        );
      }
      seen.add(id);
    }

    return orderedIds.map((id, index) => ({
      id,
      queuePosition: index + 1,
    }));
  }

  const sorted = [...items].sort((a, b) => {
    const posA = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
    const posB = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
    if (posA !== posB) return posA - posB;
    return a.id.localeCompare(b.id);
  });

  return sorted.map((item, index) => ({
    id: item.id,
    queuePosition: index + 1,
  }));
}

/**
 * Elige la siguiente salida en fila (menor `queuePosition`).
 */
export function pickNextInQueue<T extends QueueCandidate>(items: readonly T[]): T | null {
  const queued = items
    .filter((item) => item.queuePosition !== null)
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));

  return queued[0] ?? null;
}
