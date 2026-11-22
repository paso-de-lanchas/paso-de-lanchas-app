import { redirect } from "next/navigation";

import type { CurrentUser } from "@/application/auth/ports";
import { authorize, homePathFor, type Role } from "@/domain/auth/roles";
import { DomainError } from "@/domain/shared/domain-error";

import { getCurrentUser } from "./auth";

/**
 * Permisos por rol verificados en el servidor (RF-008, RF-009). Úsalos en TODA página,
 * Server Action y ruta API protegida; ocultar botones no es seguridad.
 *
 *   Página:        const user = await requireRole("ADMIN");
 *   Server Action: const user = await assertRole("ADMIN");        // lanza AccessDeniedError
 *   Ruta API:      const auth = await requireApiRole("ADMIN");
 *                  if (!auth.ok) return auth.response;             // 401 o 403
 */

export class AccessDeniedError extends DomainError {
  constructor(readonly status: 401 | 403) {
    super(
      status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      status === 401 ? "Inicia sesión para continuar." : "No tienes permiso para hacer esto.",
    );
    this.name = "AccessDeniedError";
  }
}

/** Para páginas: sin sesión manda al login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Para páginas: sin sesión manda al login; con otro rol, a la sección de su propio rol. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (authorize(user, roles) === "FORBIDDEN") redirect(homePathFor(user.role));
  return user;
}

/** Para Server Actions: lanza AccessDeniedError (401 o 403) si no tiene permiso. */
export async function assertRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  const result = authorize(user, roles);
  if (result === "UNAUTHENTICATED") throw new AccessDeniedError(401);
  if (result === "FORBIDDEN") throw new AccessDeniedError(403);
  return user!;
}

/** Para rutas API: devuelve el usuario o la respuesta 401/403 lista para regresar. */
export async function requireApiRole(
  ...roles: Role[]
): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: Response }> {
  try {
    return { ok: true, user: await assertRole(...roles) };
  } catch (error) {
    if (!(error instanceof AccessDeniedError)) throw error;
    return {
      ok: false,
      response: Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      ),
    };
  }
}
