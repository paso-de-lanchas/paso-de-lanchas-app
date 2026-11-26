export const MEXICO_TIMEZONE = "America/Mexico_City";

export function formatTripDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MEXICO_TIMEZONE,
  }).format(new Date(iso));
}
