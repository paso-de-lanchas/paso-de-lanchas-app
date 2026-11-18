# ADR 0002 — Librería de autenticación

- **Estado:** propuesta (decidir al inicio del sprint 2, antes de programar el login)
- **Fecha:** 2026-11-17
- **Decisores:** Omar (responsable del módulo de autenticación), con el equipo

## Contexto

El stack acordado (D11, planeación v1.2) dice **Auth.js** + Argon2. En septiembre de 2025 el equipo de Auth.js se unió a
**Better Auth**: Auth.js sigue recibiendo parches de seguridad, pero ya no funciones nuevas, y recomiendan Better Auth
para proyectos nuevos.

Lo que necesitamos del login (RF-001 a RF-013 y D10):
- Correo + contraseña con **Argon2**, verificación de correo y recuperación de contraseña.
- **Sesiones en base de datos** que expiran (tabla `sessions`), para poder cerrarlas desde el servidor.
- 4 roles verificados en el servidor en cada operación (RBAC).
- Bloqueo por intentos fallidos y **computadoras autorizadas** para admin/chofer (tabla `authorized_devices`).
- Sin registro público para personal.

## Opciones

| | Auth.js v5 | Better Auth | Propio (con librerías pequeñas) |
|---|---|---|---|
| Mantenimiento | Solo seguridad | Activo | Nosotros |
| Correo + contraseña | Limitado ("Credentials" no guarda sesiones en BD) | Completo, con verificación y recuperación | Lo programamos |
| Sesiones en BD | Sí, pero no con Credentials | Sí | Sí (ya está la tabla) |
| Roles, bloqueo por intentos | A mano | Plugins (admin, rate limit) | A mano |
| Encaja con nuestras tablas | Exige sus propias tablas | Exige sus propias tablas (mapeables) | Usa las nuestras tal cual |

## Propuesta

Evaluar **Better Auth** en un PR de prueba (1–2 días) con Prisma y nuestras tablas `users`/`sessions`. Si obliga a
cambiar demasiado el modelo, usar la opción **propia**: Argon2 (`@node-rs/argon2`, ya instalada) + sesiones en la tabla
`sessions` con cookie `HttpOnly; Secure; SameSite=Lax`, siguiendo la guía de autenticación de Next.js
(`node_modules/next/dist/docs/01-app/02-guides/authentication.md`).

## Consecuencias

- Mientras no se decida, **nadie instala** una librería de autenticación; las pantallas usan datos de ejemplo.
- La decisión final se registra cambiando el estado de este ADR a "aceptada" y actualizando D11 en
  `docs/CONTEXTO_PROYECTO.md`.
