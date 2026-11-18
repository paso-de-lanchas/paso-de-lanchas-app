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
- Libro de diagramas (draw.io): modelo relacional v2.1 (Diagrama_ER-V2, 32 tablas) y entidad-relación final en
  notación Chen (Diagrama_ER-Final, 28 entidades). Las hojas Diagrama_ER-Chen y su copia son las versiones de trabajo
  del equipo con sus observaciones.
- Prototipo de pantallas (Claude Design): 6 iteraciones, 31 pantallas, cubre los 127 RF
  (abordaje, operación, dinero, cuenta, administración, superadministrador y casos especiales).

## Estado actual

- **Fase:** **Sprint 2 · Cimientos** (del 18 al sábado 21 de noviembre de 2026, 9:00 p. m.) — programación por módulos.
- **Hecho:** planeación v1.2, flujo de GitHub v1.0, requisitos funcionales v1.0, prototipo completo (6 iteraciones,
  31 pantallas), modelo relacional v2.1 y entidad-relación final (incluyen Venta e Incidente, ver contexto D17–D19).
- **Hecho (2026-11-12):** organización `paso-de-lanchas` con los repos **paso-de-lanchas-app** (público, este) y
  **.github** (perfil y plantillas compartidas); ramas `main` y `develop` protegidas.
- **Hecho (2026-11-17):** entorno Docker (PostgreSQL 17 + base de pruebas + Mailpit + Adminer) y guía
  [docs/ENTORNO_DESARROLLO.md](docs/ENTORNO_DESARROLLO.md); **base del proyecto** Next.js 16 con las 32 tablas en
  Prisma 7 (migración inicial con CHECK, índices parciales y bitácora inmutable), datos de ejemplo, pruebas, CI y
  reparto de módulos en [docs/MODULOS_Y_RESPONSABLES.md](docs/MODULOS_Y_RESPONSABLES.md).
- **Hecho (2026-11-18):** PR #3 (base del proyecto) fusionado a `develop` con CI en verde; guía de contribución
  actualizada en el repo `.github`; los 5 integrantes ya son miembros de la organización.
- **Sprint 2 en curso:** milestone *Sprint 2 · Cimientos* con 17 issues (#4–#20), cada uno con historia, criterios de
  aceptación, RF y una sección **"Cómo programarlo, paso a paso"**; todos asignados. Tabla de issues por persona en
  [docs/MODULOS_Y_RESPONSABLES.md](docs/MODULOS_Y_RESPONSABLES.md).
- **Siguiente:** que cada quien cierre #4 (preparar su computadora), Omar decide #5 (librería de login, bloquea el
  login), visita de campo (tarifas, capacidades, máximo de boletos por venta), requisitos no funcionales.
- **Aún no hay módulos programados:** las pantallas por rol son temporales.

## Stack (versiones instaladas)

- **Next.js 16.4** (App Router, `cacheComponents`) + **React 19** + **TypeScript 5**; **Tailwind CSS 4**.
  ⚠️ Next.js 16 cambió APIs (p. ej. `middleware` ahora es `proxy`): antes de usar una API, lee la guía en
  `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- **PostgreSQL 17 + Prisma 7.10** (cliente generado en `src/generated/prisma`, adaptador `@prisma/adapter-pg`,
  configuración en `prisma.config.ts`). Prisma 7.10.1 está **fijado**: npm marca como "latest" la 8.0 RC, no actualizar.
- **Zod 4**, **@node-rs/argon2**, **otplib** (QR TOTP). Pendientes de instalar por su módulo: html5-qrcode (Cova),
  MapLibre GL (Diego), Serwist (Diego), SDK de Mercado Pago (Cova), shadcn/ui (Diego/José), librería de login (ADR 0002).
- Tiempo real por consultas periódicas (5–10 s). Hosting: **Vercel** + **Neon**. CI: **GitHub Actions**
  (`.github/workflows/ci.yml`).
- Pruebas: **Vitest 5** + **Playwright**. Calidad: ESLint 9 + Prettier (el Markdown no se formatea), Sentry.
- **Node 24 LTS** (`.node-version`, con fnm). Docker Desktop para los servicios locales.

## Estructura (arquitectura limpia dentro de Next.js)

```
src/domain/<modulo>/          reglas puras (sin dependencias externas) + pruebas *.test.ts
src/application/<modulo>/     casos de uso (AbordarConQR, RecargarSaldo…) + puertos (interfaces)
src/infrastructure/<modulo>/  repositorios Prisma, pasarela de pagos, firma de QR
src/infrastructure/db/        cliente de Prisma compartido
src/app/                      páginas por rol (pasajero, chofer, admin, superadmin) + rutas API delgadas
src/lib/env.ts                variables de entorno validadas con Zod
prisma/                       schema.prisma, migraciones y seed.ts
tests/e2e, tests/integration  Playwright y pruebas contra la base de pruebas
docs/                         contexto, entorno, módulos, ADR y script SQL de consulta
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
   revisión de alguien de otra área (por ahora la aprobación no es obligatoria en GitHub, ver
   docs/MODULOS_Y_RESPONSABLES.md) y **squash and merge**; de `develop` a `main` al cierre de sprint con 2 aprobaciones y
   **merge commit**, etiqueta `v0.N.0`. Guía: CONTRIBUTING.md del repo `.github`.
5. **Definición de Hecho:** código revisado, pruebas pasando (≥ 80 % en dominio/casos de uso), lint limpio,
   documentación + este archivo + `docs/CONTEXTO_PROYECTO.md` actualizados.
6. Decisiones de arquitectura importantes → ADR en `docs/adr/NNNN-titulo.md`.
7. Idioma: documentación en español; identificadores de código en inglés.

## Comandos

```
docker compose up -d       servicios locales (BD 5434, BD de pruebas 5435, Mailpit 8025); --profile tools: Adminer 8080
npm run dev                app en http://localhost:3000 (salud: /api/health)
npm run db:migrate         aplica/crea migraciones en la BD local (-- --name descripcion para crear una nueva)
npm run db:seed            datos de ejemplo (cuentas de prueba al inicio de prisma/seed.ts)
npm run db:studio          ver/editar datos locales con Prisma Studio
npm run db:test:prepare    migra la BD de pruebas
npm run check              lint + tipos + pruebas (córrelo antes de cada PR)
npm run test:coverage      pruebas con cobertura (mínimo 80 % en domain/application)
npm run test:e2e           Playwright (primera vez: npx playwright install chromium)
npm run format             Prettier
```

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
| 2026-11-13 | Omar (con Claude) | Prototipo iteraciones 3 a 6 (dinero, cuenta, administración, superadministrador y casos especiales): 31 pantallas |
| 2026-11-13 | Equipo + Claude | ER final (Diagrama_ER-Final) con las observaciones del equipo: Venta (varios boletos en un cobro), Incidente y reasignación a lista de espera; relacional v2.1 con `sales` e `incidents` |
| 2026-11-17 | Omar (con Claude) | Entorno Docker y guía de instalación (PR #2); `develop` ya no exige aprobación (el equipo aún no participa) |
| 2026-11-17 | Omar (con Claude) | Base del proyecto: Next.js 16, Prisma 7 con las 32 tablas y reglas de integridad, seed, Vitest/Playwright, CI, pantallas temporales por rol, reparto de módulos y ADR 0002 (propuesta) |
| 2026-11-18 | Omar (con Claude) | PR #3 fusionado; sprint 2 planeado en GitHub: milestone (vence sáb 21 nov, 9 p. m.) y 17 issues con pasos de programación, asignados a los 5; guía de contribución actualizada |

## Registro de errores y soluciones

| Fecha | Error / problema | Causa | Solución |
|---|---|---|---|
| 2026-11-17 | `P1000: Authentication failed` al migrar | Un PostgreSQL instalado en Windows ocupaba el puerto 5432 y respondía en lugar del de Docker | El proyecto usa los puertos 5434 (desarrollo) y 5435 (pruebas) |
| 2026-11-17 | `npm i prisma` instaló la 8.0 RC | npm tiene la etiqueta "latest" en una versión candidata | Prisma y @prisma/client fijados en 7.10.1 |
| 2026-11-18 | `npm run check` falla en `database-rules.test.ts` | Docker Desktop estaba cerrado (la prueba de integración necesita la base de pruebas) | Abrir Docker Desktop, `docker compose up -d` y `npm run db:test:prepare` (la base de pruebas se vacía al reiniciar Docker) |

## Datos pendientes de confirmar en campo

- Capacidad real de cada lancha activa (hoy operan 2; el resto está embargado por el SAT).
- Capacidad del transbordador en servicio (vehículos por tipo + personas); hoy opera 1, el otro está descompuesto.
- **PENDIENTE:** si una lancha no se llena, ¿sale tras un tiempo máximo o espera siempre? (mientras, el admin puede cerrar el abordaje).
- **PENDIENTE:** ¿el transbordador sale al llenarse o tiene horario fijo?
- Horario de servicio por muelle, duración del cruce, ritmo de llegada de pasajeros.
- Tarifa vigente del transbordador por tipo de vehículo (prensa: $15 auto, $5 moto, $1 peatón; hay nota de alza a $30).
- Validación actual de descuentos estudiante/INAPAM; conectividad en muelles; si los choferes tienen celular con GPS y datos.
