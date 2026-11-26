import { createGetDocksStatus } from "@/application/passenger-info/get-docks-status";
import { systemClock } from "@/application/shared/ports";
import { PrismaPassengerInfoRepository } from "@/infrastructure/passenger-info/prisma-passenger-info-repository";
import { requireApiRole } from "@/lib/auth/require-role";

export async function GET() {
  const auth = await requireApiRole("PASSENGER");
  if (!auth.ok) {
    return auth.response;
  }

  const repo = new PrismaPassengerInfoRepository();
  const getDocksStatus = createGetDocksStatus({ repo, clock: systemClock });
  const status = await getDocksStatus();

  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
