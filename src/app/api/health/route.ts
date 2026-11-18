import { connection } from "next/server";

import { prisma } from "@/infrastructure/db/prisma";

// GET /api/health — comprueba que la app responde y que llega a la base de datos.
// Lo usan Vercel/monitoreo y sirve para saber si tu entorno local quedó bien.
export async function GET() {
  await connection(); // siempre en tiempo de ejecución, nunca prerenderizado

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
