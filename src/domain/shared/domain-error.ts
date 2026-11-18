/**
 * Error de regla de negocio. Los casos de uso lo lanzan y las rutas API lo traducen a
 * una respuesta 4xx con un mensaje entendible para el usuario.
 * `code` es estable (en inglés) para que el frontend pueda reaccionar a él.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
