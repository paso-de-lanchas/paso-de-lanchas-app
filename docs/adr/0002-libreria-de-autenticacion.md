# ADR 0002 — Librería de autenticación

- **Estado:** aceptada — **implementación propia** (sin librería de autenticación)
- **Fecha:** 2026-11-17 (propuesta) · 2026-11-22 (aceptada)
- **Decisores:** Omar (responsable del módulo de autenticación), con el equipo
- **Issue:** #5

## Contexto

El stack acordado (D11, planeación v1.2) decía **Auth.js** + Argon2. En septiembre de 2025 el equipo de Auth.js se unió a
**Better Auth**: Auth.js sigue recibiendo parches de seguridad, pero ya no funciones nuevas, y recomiendan Better Auth
para proyectos nuevos.

Lo que necesitamos del login (RF-001 a RF-013 y D10):
- Correo + contraseña con **Argon2**, verificación de correo y recuperación de contraseña.
- **Sesiones en base de datos** que expiran (tabla `sessions`), para poder cerrarlas desde el servidor.
- 4 roles verificados en el servidor en cada operación (RBAC).
- Bloqueo por intentos fallidos y **computadoras autorizadas** para admin/chofer (tabla `authorized_devices`).
- Expiración por inactividad para el personal y cambio de contraseña obligatorio en el primer ingreso.
- Sin registro público para personal. **No** se inicia sesión con Google, Facebook, etc.

## Opciones evaluadas

| | Auth.js v5 | Better Auth | Propio (con librerías pequeñas) |
|---|---|---|---|
| Mantenimiento | Solo seguridad | Activo | Nosotros |
| Correo + contraseña | Limitado ("Credentials" no guarda sesiones en BD) | Completo, con verificación y recuperación | Lo programamos |
| Sesiones en BD | Sí, pero no con Credentials | Sí | Sí (ya está la tabla) |
| Roles, bloqueo por intentos | A mano | Plugins (admin, rate limit) | A mano |
| Computadoras autorizadas, inactividad del personal, cambio obligatorio | A mano | A mano | A mano |
| Encaja con nuestras tablas | Exige sus propias tablas | Exige sus propias tablas (mapeables, ver abajo) | Usa las nuestras tal cual |

Revisión de Better Auth contra nuestro modelo (v1.6, documentación del 2026-11-22):
- Guarda la contraseña en su tabla `account`, no en `users.password_hash`; habría que crear esa tabla y mover el dato.
- Usa su tabla `verification` en lugar de nuestra `auth_tokens`.
- Su campo `emailVerified` es booleano; nosotros guardamos la fecha (`email_verified_at`).
- Agrega columnas a `sessions` (`ip_address`, `user_agent`, `created_at`, `updated_at`).
- Sí acepta Argon2 (funciones `hash`/`verify` propias) y funciona con el `proxy.ts` de Next.js 16.

Eso son **más de 2–3 columnas** de cambio (el límite que pusimos en el issue #5), y las reglas difíciles (computadoras
autorizadas, inactividad, cambio obligatorio) se programarían igual. Su gran ventaja, el inicio de sesión con redes
sociales, no la usamos.

## Decisión

**Implementación propia**, siguiendo la guía oficial de Next.js
(`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) y el OWASP *Authentication* y *Session Management
Cheat Sheet*:

| Pieza | Cómo |
|---|---|
| Contraseñas | **Argon2id** con `@node-rs/argon2` (ya instalada), parámetros por defecto de la librería (OWASP) |
| Sesión | Token aleatorio de 32 bytes (`crypto.randomBytes`) en una cookie `HttpOnly; Secure; SameSite=Lax; Path=/` |
| En la base | Solo el **hash SHA-256** del token en `sessions.session_token` (si se filtra la base, no sirven las cookies) |
| Expiración | Pasajero: 30 días renovables. Personal: por inactividad (`session_timeout_minutes_staff` en `system_settings`) |
| Permisos | `requireUser()` / `requireRole(...roles)` en **cada** Server Action, ruta API y página protegida (RBAC en servidor) |
| `proxy.ts` | Solo revisa que exista la cookie para redirigir rápido al login; la verificación real es `requireRole` |
| Tokens de correo | Verificación y recuperación con token aleatorio; en `auth_tokens` solo su hash, un solo uso y caducidad |
| Bloqueo | `failed_login_attempts` y `locked_until` en `users`; el máximo sale de `max_failed_logins` |
| Personal | Solo inicia sesión desde una computadora con `authorized_devices.status = APPROVED` (cookie de dispositivo) |
| Mensajes | El login responde siempre "correo o contraseña incorrectos" (no revela si el correo existe) |
| CSRF | Server Actions de Next.js (comparan `Origin` y `Host`) + `SameSite=Lax` |
| Bitácora | Inicio, cierre, bloqueo y cambio de contraseña se registran en `audit_logs` |

El código vive en el módulo `auth` con la arquitectura limpia del proyecto: reglas en `src/domain/auth`, casos de uso y
puertos en `src/application/auth`, repositorios Prisma, Argon2 y cookies en `src/infrastructure/auth`, y las funciones
`requireUser`/`requireRole` en `src/lib/auth`.

## Consecuencias

- **No se instala** ninguna librería de autenticación (ni Auth.js ni Better Auth). Se usan `@node-rs/argon2`, `crypto`
  de Node y `cookies()` de Next.js.
- El modelo de datos **no cambia**: `users`, `sessions`, `auth_tokens` y `authorized_devices` ya tienen lo necesario.
- Somos responsables de la seguridad de este código: cada regla lleva pruebas y todo PR que toque `auth` lo revisa Omar.
- Los demás módulos solo usan `requireUser()`/`requireRole()`; cuando estén listas (issue #7), reemplazan los usuarios de
  ejemplo de sus pantallas.
- Si más adelante se necesita iniciar sesión con Google o similares, se reabre este ADR.
