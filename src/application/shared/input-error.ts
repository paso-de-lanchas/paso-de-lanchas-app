import type { z } from "zod";

import { DomainError } from "@/domain/shared/domain-error";

/** Datos inválidos de un formulario, con el mensaje de cada campo para mostrarlo junto a él. */
export class InputError<Field extends string = string> extends DomainError {
  constructor(readonly fieldErrors: Partial<Record<Field, string>>) {
    super("INVALID_INPUT", "Revisa los datos marcados.");
    this.name = "InputError";
  }
}

/** Valida con Zod; si falla, lanza InputError con el primer mensaje de cada campo. */
export function parseInput<Field extends string, Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fieldErrors: Partial<Record<Field, string>> = {};
  for (const issue of parsed.error.issues) {
    fieldErrors[issue.path[0] as Field] ??= issue.message;
  }
  throw new InputError<Field>(fieldErrors);
}
