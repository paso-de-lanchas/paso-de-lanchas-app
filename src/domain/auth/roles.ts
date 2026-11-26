/**
 * Roles y secciones (RF-008, RF-009). Reglas puras: no saben de cookies ni de la base.
 * Los valores coinciden con el enum `user_role` de la base de datos.
 */
export const ROLES = ["PASSENGER", "DRIVER", "ADMIN", "SUPERADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Sección de la app a la que llega cada rol después de iniciar sesión. */
const HOME_BY_ROLE: Record<Role, string> = {
  PASSENGER: "/pasajero",
  DRIVER: "/chofer",
  ADMIN: "/admin",
  SUPERADMIN: "/superadmin",
};

/** Secciones protegidas: cada una solo la ve su rol. */
export const PROTECTED_SECTIONS: readonly string[] = Object.values(HOME_BY_ROLE);

export function homePathFor(role: Role): string {
  return HOME_BY_ROLE[role];
}

/** Sección protegida a la que pertenece una ruta, o null si la ruta es pública. */
export function sectionOf(path: string): string | null {
  return PROTECTED_SECTIONS.find((s) => path === s || path.startsWith(`${s}/`)) ?? null;
}

export function isProtectedPath(path: string): boolean {
  return sectionOf(path) !== null;
}

export function canAccessPath(role: Role, path: string): boolean {
  const section = sectionOf(path);
  return section === null || section === homePathFor(role);
}

export type AuthorizationResult = "ALLOWED" | "UNAUTHENTICATED" | "FORBIDDEN";

/** Decide si un usuario (o nadie) puede hacer algo que exige alguno de `allowed`. */
export function authorize(
  user: { role: Role } | null,
  allowed: readonly Role[],
): AuthorizationResult {
  if (!user) return "UNAUTHENTICATED";
  return allowed.includes(user.role) ? "ALLOWED" : "FORBIDDEN";
}

/**
 * A dónde mandar al usuario después del login. Solo acepta rutas internas de su propia
 * sección (evita redirecciones abiertas a otros sitios, OWASP A01).
 */
export function redirectAfterLogin(role: Role, requested?: string | null): string {
  const home = homePathFor(role);
  if (!requested || !requested.startsWith("/") || requested.startsWith("//")) return home;
  if (requested.includes("\\") || /[\r\n]/.test(requested)) return home;
  return sectionOf(requested) === home ? requested : home;
}

/** Pantalla para cambiar la contraseña; con una contraseña temporal es la única permitida (RF-013). */
export const CHANGE_PASSWORD_PATH = "/cuenta/cambiar-contrasena";
