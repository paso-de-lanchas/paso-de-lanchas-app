import { getCurrentUser } from "@/lib/auth/auth";

/** Usuario de la sesión actual (para pantallas del lado del cliente y la PWA). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "UNAUTHENTICATED", message: "Inicia sesión para continuar." },
      { status: 401 },
    );
  }
  return Response.json({ user });
}
