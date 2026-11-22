import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath } from "@/domain/auth/roles";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * Filtro rápido (en Next.js 16 el middleware se llama proxy): si alguien sin cookie de sesión
 * entra a /pasajero, /chofer, /admin o /superadmin, lo manda al login sin cargar la página.
 * NO es la seguridad real: aquí no se consulta la base. El rol se verifica en cada página,
 * acción y ruta API con requireRole / assertRole / requireApiRole.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/pasajero/:path*", "/chofer/:path*", "/admin/:path*", "/superadmin/:path*"],
};
