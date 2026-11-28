import { createGetLiveMap } from "@/application/map/get-live-map";
import { createPrismaLiveMapRepository } from "@/infrastructure/map/prisma-live-map-repository";
import { requireApiRole } from "@/lib/auth/require-role";

/**
 * Mapa en vivo (RF-077 a RF-081): muelles y embarcaciones en tránsito. No trae datos
 * personales (ni choferes ni pasajeros), solo la embarcación, su ocupación y su ubicación.
 */
export async function GET() {
  const auth = await requireApiRole("PASSENGER", "ADMIN", "SUPERADMIN", "DRIVER");
  if (!auth.ok) return auth.response;

  const map = await createGetLiveMap({ repo: createPrismaLiveMapRepository() })();
  return Response.json(map, { headers: { "Cache-Control": "no-store" } });
}
