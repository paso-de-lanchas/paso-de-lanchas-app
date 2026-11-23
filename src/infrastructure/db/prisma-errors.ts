/** P2002: se violó un índice único (por ejemplo, dos peticiones creando lo mismo a la vez). */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}
