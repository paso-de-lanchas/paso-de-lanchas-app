# CLAUDE.md — Paso de Lanchas Coatzacoalcos ⇄ Villa Allende

> Archivo vivo. Describe **cómo trabajamos**, el **estado actual**, la **bitácora de cambios** y los **errores encontrados**.
> Actualízalo en cada cambio relevante (en el mismo pull request). Para la historia completa del proyecto, lee primero
> [docs/CONTEXTO_PROYECTO.md](docs/CONTEXTO_PROYECTO.md).

## Equipo (5 integrantes)

| Integrante | Lidera |
|---|---|
| Omar | Product Owner + Arquitectura |
| Pamela | Scrum Master + Requisitos |
| Diego | Frontend |
| José | UX/UI |
| Cova | Base de datos |

**Todos participan en todo:** cada quien toma historias completas (pantalla → lógica → BD → pruebas), el código lo revisa
alguien de otra área, programación en pareja al menos una vez por sprint, y backend/seguridad son compartidos
(Omar y Cova coordinan). Felipe ya no forma parte del equipo (desde 2026-11-08).

## Qué construimos (resumen)

Una **sola web app PWA** con 4 roles: **Pasajero**, **Chofer**, **Administrador** (también taquillero y quien genera reportes)
y **Superadministrador** (crea cuentas de admin/chofer y aprueba computadoras del muelle).
El celular del pasajero es su tarjeta: QR dinámico (TOTP) que funciona sin internet → el admin lo escanea → cobro + lugar
en la embarcación que carga en **ese muelle**. Hay **dos muelles con taquilla** (Coatzacoalcos y Villa Allende); las
embarcaciones **salen al llenarse**, cargan en ambos lados y alternan de muelle; puede haber fila de embarcaciones por muelle;
misma tarifa en ambos sentidos. El chofer inicia/termina el viaje y comparte su GPS en vivo; al terminar se abre la salida
de regreso. Flota ilimitada con estados; al pasajero solo se le muestran unidades activas.

## Documentación del equipo

Los documentos de planeación (Word) y los diagramas viven **en línea, en la carpeta compartida del equipo**, no en este
repositorio:
- 01 Planeación inicial v1.2 (investigación, alcance, arquitectura, plan por sprint e integrante).
- 02 Flujo de trabajo en GitHub v1.0.
- 03 Requisitos funcionales v1.0 (127 RF, RF-001 a RF-127).
- Libro de diagramas (draw.io): modelo relacional (Diagrama_ER-V2) y entidad-relación Chen (Diagrama_ER-Chen), en revisión.
- Prototipo de pantallas (Claude Design): iteraciones 1 (abordaje) y 2 (operación).

## Estado actual

- **Fase:** Sprint 0–1 — planeación, requisitos, prototipo y modelo de datos.
- **Hecho:** planeación v1.2, flujo de GitHub v1.0, requisitos funcionales v1.0, prototipo (iteraciones 1 y 2),
  modelo relacional y entidad-relación (en revisión del equipo).
- **Hecho (2026-11-12):** organización `paso-de-lanchas` con los repos **paso-de-lanchas-app** (público, este) y
  **.github** (perfil y plantillas compartidas); ramas `main` y `develop` protegidas.
- **Siguiente:** correcciones del diagrama ER, requisitos no funcionales, visita de campo, arranque del proyecto Next.js.
- **Aún no hay código de la aplicación.**

## Stack acordado

- **Next.js + TypeScript** (frontend y API en un solo proyecto), PWA con **Serwist**, **Tailwind CSS + shadcn/ui**.
- **PostgreSQL + Prisma**, **Auth.js** + Argon2, **Zod**, **otplib** (QR TOTP) + **html5-qrcode** (escaneo).
- **MapLibre GL + OpenStreetMap**; pagos con **Mercado Pago o Stripe** (modo prueba en desarrollo).
- Tiempo real por consultas periódicas (5–10 s). Hosting: **Vercel** + **Neon o Supabase**. CI: **GitHub Actions**.
- Pruebas: **Vitest** + **Playwright**. Calidad: ESLint + Prettier, Sentry.

## Estructura prevista (arquitectura limpia dentro de Next.js)

```
src/domain/          entidades y reglas (sin dependencias externas)
src/application/     casos de uso (AbordarConQR, RecargarSaldo, IniciarViaje, GenerarReporte…)
src/infrastructure/  repositorios Prisma, pasarela de pagos, firma de QR
src/app/             páginas por rol + rutas API delgadas (validan y llaman a casos de uso)
```

## Reglas de trabajo (obligatorias)

1. **Calidad de ingeniería de software:** SOLID, DRY, KISS, YAGNI, Clean Code; las dependencias apuntan al dominio;
   patrones: Repository, Strategy (tarifas), State (viaje y embarcación), Adapter (pasarela), Factory, Unit of Work, DI.
2. **Seguridad por diseño:** OWASP Top 10; Argon2; RBAC verificado en servidor en cada operación; Zod en toda entrada;
   Prisma (consultas parametrizadas); HTTPS; secretos solo en `.env.local` (ignorado por `.gitignore`; en el repo solo
   `.env.example`); nunca manejar datos de tarjeta (pasarela + webhook firmado); bitácora de auditoría.
   Admin/chofer: sin registro público, computadoras autorizadas por el superadmin, bloqueo por intentos fallidos,
   sesiones que expiran. **No** se usa restricción por IP (decisión del equipo).
3. **Integridad de negocio:** escaneo de QR = **una sola transacción** (bloquear viaje → verificar cupo → cobrar →
   registrar abordaje); QR de un solo uso; **cero sobreventa** y **cero cobro doble**.
4. **Git:** `main` = producción, `develop` = integración (rama por defecto). Ramas de trabajo desde `develop`:
   `feature|fix|docs|chore|test/<issue>-descripcion`; urgencias en producción: `hotfix/<issue>-descripcion` desde `main`.
   Conventional Commits (tipo en inglés, descripción en español). Todo entra por pull request: hacia `develop` con
   1 aprobación de otra área y **squash and merge**; de `develop` a `main` al cierre de sprint con 2 aprobaciones y
   **merge commit**, etiqueta `v0.N.0`. Guía: CONTRIBUTING.md del repo `.github`.
5. **Definición de Hecho:** código revisado, pruebas pasando (≥ 80 % en dominio/casos de uso), lint limpio,
   documentación + este archivo + `docs/CONTEXTO_PROYECTO.md` actualizados.
6. Decisiones de arquitectura importantes → ADR en `docs/adr/NNNN-titulo.md`.
7. Idioma: documentación en español; identificadores de código en inglés.

## Comandos

_(Se llenarán cuando exista el código.)_

## Bitácora de cambios

| Fecha | Autor | Cambio |
|---|---|---|
| 2026-11-08 | Omar (con Claude) | Sprint 0: investigación, documento de planeación v1.0, CLAUDE.md y CONTEXTO_PROYECTO.md |
| 2026-11-08 | Omar (con Claude) | Planeación v1.1: equipo de 5, una sola web app PWA, 4 roles, QR sin internet, recarga taquilla + en línea, GPS del chofer, stack simplificado, sin restricción por IP |
| 2026-11-08 | Omar (con Claude) | Planeación v1.2: operación en dos muelles, salida al llenarse, fila de embarcaciones, horario de servicio; plan detallado por sprint, integrante y tecnología |
| 2026-11-09 | Omar (con Claude) | Documento 02 «Flujo de trabajo en GitHub» v1.0 |
| 2026-11-09 | Omar (con Claude) | Documento 03 «Requisitos funcionales» v1.0: 127 RF en 19 módulos (Usuario/Sistema) |
| 2026-11-10 | Omar (con Claude) | Prototipo (iteraciones 1 y 2), modelo relacional (30 tablas) y entidad-relación Chen (26 entidades) |
| 2026-11-12 | Omar (con Claude) | Repos `paso-de-lanchas-app` y `.github`, ramas `main`/`develop` protegidas, plantillas y etiquetas |

## Registro de errores y soluciones

| Fecha | Error / problema | Causa | Solución |
|---|---|---|---|
| — | — | — | — |

## Datos pendientes de confirmar en campo

- Capacidad real de cada lancha activa (hoy operan 2; el resto está embargado por el SAT).
- Capacidad del transbordador en servicio (vehículos por tipo + personas); hoy opera 1, el otro está descompuesto.
- **PENDIENTE:** si una lancha no se llena, ¿sale tras un tiempo máximo o espera siempre? (mientras, el admin puede cerrar el abordaje).
- **PENDIENTE:** ¿el transbordador sale al llenarse o tiene horario fijo?
- Horario de servicio por muelle, duración del cruce, ritmo de llegada de pasajeros.
- Tarifa vigente del transbordador por tipo de vehículo (prensa: $15 auto, $5 moto, $1 peatón; hay nota de alza a $30).
- Validación actual de descuentos estudiante/INAPAM; conectividad en muelles; si los choferes tienen celular con GPS y datos.
