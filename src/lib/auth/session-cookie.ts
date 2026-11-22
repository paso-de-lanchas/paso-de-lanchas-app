/**
 * Cookie de sesión. `HttpOnly` (JavaScript no la puede leer), `SameSite=Lax` (no viaja en
 * peticiones de otros sitios) y `Secure` en producción (solo por HTTPS).
 * Solo contiene el token aleatorio; el usuario y su rol se buscan en la tabla `sessions`.
 */
export const SESSION_COOKIE = "paso_session";

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
