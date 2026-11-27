import { createPrismaBoardingQueries } from "@/infrastructure/boarding/prisma-boarding-queries";
import { requireApiRole } from "@/lib/auth/require-role";

/** Abordaje vigente del pasajero de la sesión (RF-051). Solo lee los suyos. */
export async function GET() {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) return auth.response;

  const boarding = await createPrismaBoardingQueries().findCurrentPassengerBoarding(auth.user.id);
  return Response.json({ boarding }, { headers: { "Cache-Control": "no-store" } });
}
