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
- 01 Planeación inicial v1.3 (investigación, alcance, arquitectura, plan por sprint e integrante; v1.3 actualiza el stack).
- 02 Flujo de trabajo en GitHub v1.1 (v1.1: repo público, revisión sin aprobación obligatoria en `develop`, CI real).
- 03 Requisitos funcionales v1.0 (127 RF, RF-001 a RF-127).
- Libro de diagramas (draw.io): modelo relacional v2.1 (Diagrama_ER-V2, 32 tablas) y entidad-relación final en
  notación Chen (Diagrama_ER-Final, 28 entidades). Las hojas Diagrama_ER-Chen y su copia son las versiones de trabajo
  del equipo con sus observaciones.
- Prototipo de pantallas (Claude Design): 6 iteraciones, 31 pantallas, cubre los 127 RF
  (abordaje, operación, dinero, cuenta, administración, superadministrador y casos especiales).

## Estado actual

- **Fase:** **Sprint 4 · Abordaje** (vencido el 25 de noviembre), con rezago de los sprints 2 y 3. La entrega final es el
  **sábado 28 de noviembre de 2026**. Tabla de issues por persona en
  [docs/MODULOS_Y_RESPONSABLES.md](docs/MODULOS_Y_RESPONSABLES.md); el estado al día está en los milestones de GitHub.
- **Cimientos (2026-11-12 a 2026-11-18):** organización `paso-de-lanchas` (repos `paso-de-lanchas-app` y `.github`),
  ramas `main`/`develop` protegidas, entorno Docker ([docs/ENTORNO_DESARROLLO.md](docs/ENTORNO_DESARROLLO.md)), base
  Next.js 16 con las 32 tablas en Prisma 7, CI y reparto de módulos.
- **Cuentas y seguridad:** login por rol (#7) con `requireRole` / `assertRole` / `requireApiRole`
  (`src/lib/auth/require-role.ts`, `src/proxy.ts`); bloqueo por intentos, computadoras autorizadas e inactividad (#9);
  registro con verificación de correo (#6); recuperar y cambiar contraseña (#8); cuentas del personal (#41,
  `/superadmin/personal`) y computadoras del muelle (#42, `/superadmin/computadoras`); cancelar cuenta (#17), perfil y
  aviso de privacidad (#16), descuentos Estudiante/INAPAM (#18).
- **Flota:** registrar y editar embarcaciones (#11) y cambiar su estado con historial en `/admin/flota/[id]` (#12).
- **Dinero:** tarifas con vigencia e historial en `/admin/tarifas` (#14); saldo, historial, recarga en efectivo,
  reembolsos y ajustes en `/admin/recargas` y `/pasajero/saldo` (#37, bitácora en la misma transacción).
- **Pasajero:** galería de vehículos (#40), información en vivo de muelles, horarios, tarifas y mis viajes (#48, #62).
- **QR dinámico (#20):** el celular genera el código TOTP sin internet; `verifyQr` devuelve `userId`, `credentialId` y
  `timeStep` y **no** marca el código como usado (eso lo hace el abordaje). Una credencial revocada se renueva sola con
  internet; cerrar sesión borra `qr:*` del celular. Requiere `QR_SIGNING_SECRET` (ver Stack).
- **Escaneo del QR (#44):** `/admin/taquilla` (cámara con html5-qrcode o lector USB). Una sola transacción bloquea
  la salida que aborda en el muelle del admin (`SELECT … FOR UPDATE`), revisa cupo, calcula la tarifa con la Strategy
  de #15, cobra del saldo, crea la venta y el abordaje con lugar consecutivo, credencial y paso de tiempo; si la
  salida se llena la cierra y pasa la siguiente de la fila. El pasajero ve su lugar en `/pasajero` (cada 5 s).
- **Mapa en vivo (#72):** `/pasajero/mapa` y `/admin/mapa` (el admin ve la ocupación) con MapLibre 6.18.0 y mapa de
  OpenStreetMap; se actualiza cada 7 s (`GET /api/mapa`, sin datos personales). La llegada se calcula con la distancia que
  falta y la velocidad, o con la duración típica del cruce si no hay señal reciente ("última ubicación hace…"). Mientras
  no exista el GPS del chofer (#49), `npm run dev:simular-viaje` simula una lancha cruzando.
- **En revisión (PRs abiertos):** tarifa vigente #15 (PR #50), fila y salidas #43 (PR #58), cancelar salida y regreso
  #46 (PR #59), horario e incidentes #47 (PR #60), choferes #13 (PR #66), componentes #19 (PR #54).
- **Permisos en GitHub (D26):** equipo `desarrollo` con escritura; en `develop` todo entra por PR con la CI en verde y
  **solo Omar aprueba y fusiona** (`.github/CODEOWNERS`).

## Stack (versiones instaladas)

- **Next.js 16.4** (App Router, `cacheComponents`) + **React 19** + **TypeScript 5**; **Tailwind CSS 4**.
  ⚠️ Next.js 16 cambió APIs (p. ej. `middleware` ahora es `proxy`): antes de usar una API, lee la guía en
  `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- **PostgreSQL 17 + Prisma 7.10** (cliente generado en `src/generated/prisma`, adaptador `@prisma/adapter-pg`,
  configuración en `prisma.config.ts`). Prisma 7.10.1 está **fijado**: npm marca como "latest" la 8.0 RC, no actualizar.
- **Zod 4**, **@node-rs/argon2**, **otplib** (QR TOTP). **nodemailer 10.3** (correo SMTP). **html5-qrcode 2.3.8** (lector de cámara de la taquilla). **maplibre-gl 6.18.0**
  (mapa en vivo; su worker se copia a `public/vendor/` antes de `dev` y `build`). Pendientes de instalar por su módulo: Serwist (Diego), SDK de Mercado Pago (Cova), shadcn/ui (Diego/José).
  **Login propio sin librería** (ADR 0002 aceptada): Argon2 + sesiones en la tabla `sessions`.
- Tiempo real por consultas periódicas (5–10 s). Hosting: **Vercel** + **Neon**. CI: **GitHub Actions**
  (`.github/workflows/ci.yml`).
- Pruebas: **Vitest 5** + **Playwright**. Calidad: ESLint 9 + Prettier (el Markdown no se formatea), Sentry.
- **Node 24 LTS** (`.node-version`, con fnm). Docker Desktop para los servicios locales.
- **`QR_SIGNING_SECRET`:** clave para cifrar los secretos TOTP del QR (mínimo 32 caracteres). Opcional en desarrollo,
  **obligatoria en producción** (`src/lib/env.ts`). Se genera con
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. No cambiarla con credenciales ya
  emitidas: dejarían de poder descifrarse. Debe existir también en Vercel.

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
   revisión de alguien de otra área (comentarios) y **aprobación obligatoria de Omar** (`.github/CODEOWNERS`), CI en
   verde y **squash and merge**, que solo hace Omar (ver docs/MODULOS_Y_RESPONSABLES.md); de `develop` a `main` al cierre de sprint con 2 aprobaciones y
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
npm run dev:simular-viaje   simula una lancha cruzando (mapa en vivo); -- --terminar la detiene
npm run dev:aprobar-computadoras  autoriza en la BD local las computadoras pendientes (-- correo: solo las de esa cuenta)
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
| 2026-11-19 | José | Issue #16: componente de aviso de privacidad (LFPDPPP) y pantalla móvil Mi cuenta para consultar/editar perfil del pasajero (RF-014 y RF-015) |
| 2026-11-22 | Omar (con Claude) | Documentos Word actualizados: 01 Planeación v1.3 (Node 24, Next.js 16, Prisma 7, PostgreSQL 17, Neon sin Supabase, Docker, login en ADR 0002, proxy) y 02 Flujo de GitHub v1.1 (repo público, revisión sin aprobación obligatoria, CI real) |
| 2026-11-22 | Omar (con Claude) | Revisión de los PRs #22–#25; issue #27: índices únicos parciales (una asignación activa por chofer y embarcación, una solicitud de descuento pendiente por pasajero) |
| 2026-11-22 | Omar (con Claude) | ADR 0002 aceptada: login propio (Argon2 + sesiones en BD, `requireRole` en servidor); se descartan Auth.js y Better Auth (#5) |
| 2026-11-22 | Omar (con Claude) | Login por rol (#7): Argon2, sesiones en BD con hash del token y cookie HttpOnly, `requireRole`/`assertRole`/`requireApiRole`, `proxy.ts`, pantalla de login y cierre de sesión, bitácora; 40 pruebas unitarias y 10 de Playwright |
| 2026-11-22 | José | Issue #17 (revisión PR #32): cancelación de cuenta dentro de Mi cuenta verificando contraseña actual, borrado lógico y anonimización, revocación de QR, cierre de sesiones, limpieza de `auth_tokens` y `push_subscriptions`, lectura de saldo en transacción y auditoría `user` (RF-016) |
| 2026-11-22 | José | Issue #18 (revisión PR #25): solicitud y revisión de descuento Estudiante/INAPAM con sesiones reales (`requireRole`/`assertRole`/`requireApiRole`), bloqueo de revisión simultánea con `updateMany`, vigencia en hora de México y cabecera `X-Content-Type-Options: nosniff` (RF-019 y RF-020) |
| 2026-11-22 | Omar (con Claude) | Seguridad del personal (#9): bloqueo por intentos fallidos, computadoras autorizadas con cookie de dispositivo, cierre por inactividad, `dock_id` opcional en `authorized_devices`, script `dev:aprobar-computadoras` |
| 2026-11-22 | Omar (con Claude) | Registro de pasajero (#6): cuenta pendiente + monedero en $0 + enlace en una transacción, verificación de un solo uso, respuesta igual si el correo existe, correo por SMTP (nodemailer, Mailpit en local) |
| 2026-11-23 | Omar (con Claude) | Recuperar y cambiar contraseña (#8): enlace de 30 min de un solo uso (máx. 3 cada 30 min), cierre de sesiones, contraseña temporal obligatoria de cambiar (`requireRole`/`assertRole`), aviso por correo del cambio, `InputError` compartido, cuentas de prueba e2e con `globalSetup` |
| 2026-11-22 | José | Issue #16 (revisión PR #23): eliminar `userId` oculto del formulario y obtener sesión en servidor con `requireRole`/`assertRole` |
| 2026-11-23 | Omar (con Claude) | Permisos en GitHub (D26): equipo `desarrollo` con escritura, `.github/CODEOWNERS`, reglas de `develop` (PR obligatorio, CI en verde, aprobación de Omar); guía de contribución actualizada |
| 2026-11-23 | Cova | Issue #37: saldo e historial paginado, top-up en efectivo con límites configurables, ajustes/reembolsos auditados en la misma transacción, comprobante, caja automática en computadora autorizada y control de concurrencia optimista |
| 2026-11-23 | Cova | Tarifa vigente (#15): Factory y estrategias de dominio para lancha y transbordador, vigencia de tarifas al abordar y descuento aprobado vigente |
| 2026-11-22 | Cova | Tarifas (#14): dominio, cambio transaccional con vigencia e historial, validación de categorías/tipos, auditoría y página de administración protegida; se enlaza desde el panel admin |
| 2026-11-23 | José | Issue #40: galería de vehículos del pasajero con normalización de placas, tarifa vigente por tipo, borrado lógico, vistas `/pasajero/vehiculos` y endpoint `GET /api/pasajero/vehiculos` (RF-039 a RF-042) |
| 2026-11-23 | José | Issue #48: tablero en vivo de muelles con actualización cada 10 s (`GET /api/pasajero/muelles`), tiempos estimados de salida/llegada (`eta.ts`), horarios, tarifas vigentes (`crossing_minutes` en seed) e historial paginado de viajes (RF-082 a RF-087) |
| 2026-11-24 | José | Issue #62: formatear fechas de Mis viajes en `America/Mexico_City` (`format-trip-date.ts` con prueba unitaria) y mostrar lancha y transbordador en camino simultáneamente por muelle |
| 2026-11-24 | Omar (con Claude) | Cuentas del personal (#41): alta de admin/chofer con contraseña temporal de 12 caracteres (`crypto.randomInt`), desactivar con cierre de sesiones, reactivar, desbloquear y restablecer; nunca superadmins ni pasajeros; bitácora; `src/lib/mailer.ts` compartido; chofer `chofer.temporal` en el seed; ayudas e2e en `tests/e2e/auth-helpers.ts` |
| 2026-11-24 | Omar (con Claude) | Computadoras del muelle (#42): pantalla del superadmin para aprobar (nombre y muelle; la del admin no puede quedar de oficina), renombrar y revocar (borra sus sesiones); columna `authorized_devices.requested_at`; `dev:aprobar-computadoras -- correo` para que las pruebas en paralelo no se crucen |
| 2026-11-24 | Omar (con Claude) | Revisión de Cova a #55 y #56: cada cambio de cuentas del personal y de computadoras guarda su bitácora **en la misma transacción** (`ChangeAudit`, `auditLogData`); la acción de estado solo acepta DEACTIVATE/REACTIVATE; la computadora de un admin solo se aprueba para **su** muelle |
| 2026-11-24 | Diego (con Claude) | QR dinámico (#20): dominio `qr-payload` (`PL1.<credencial>.<código>`), cifrado AES-256-GCM del secreto TOTP con `QR_SIGNING_SECRET`, adaptador de otplib, casos de uso `issueQrCredential` y `verifyQr` (±1 paso, reloj inyectado), repositorio Prisma, ruta `POST /api/qr/credential` y pantalla `/pasajero/qr` con IndexedDB, contador y Wake Lock |
| 2026-11-25 | Diego (con Claude) | Revisión del QR (#20): botón "Mostrar mi QR" en el inicio del pasajero; `GET /api/qr/credential` y `isCredentialActiveForUser` para descartar una credencial revocada y pedir una nueva (solo con `active: false` explícito; sin red se conserva la guardada); `LogoutButton` ahora es componente de cliente y borra `qr:*` de IndexedDB (`src/lib/qr-storage.ts`) antes de cerrar sesión; reintento único si dos peticiones chocan con el índice `qr_credentials_one_active_per_user` (P2002); `createPrismaQrRepository(client)` acepta el cliente; prueba de integración del repositorio; `QR_SIGNING_SECRET` obligatoria en producción (`env.ts`, `ci.yml`) y documentada en `.env.example` y `docs/ENTORNO_DESARROLLO.md` |
| 2026-11-25 | Cova | #15: `fare-strategy` reutiliza `VesselKind` y `FareCategory` del dominio de tarifas, sin duplicar sus tipos |
| 2026-11-27 | Pamela | Fila y salidas (#43, PR #58): auditoría obligatoria en casos de uso, bloqueo de muelle FOR UPDATE en transacciones, verificación global de embarcacion activa con indice unico parcial, validación Zod y prueba E2E de flujo de fila/abordaje |
| 2026-11-27 | Omar (con Claude) | Escaneo del QR (#44): `/admin/taquilla` con cámara (html5-qrcode 2.3.8) o lector USB; `boardWithQr` en una transacción (bloqueo de la salida, cupo, tarifa con la Strategy de #15, cobro `FARE_CHARGE`, venta `QR_BALANCE`, abordaje con lugar, credencial y paso de tiempo, bitácora); al llenarse cierra y pasa la siguiente; vehículos en el transbordador; aviso al pasajero cada 5 s (`GET /api/pasajero/abordaje`); la tarifa usa una sola regla de descuento (`isDiscountActive`); pruebas de concurrencia (20 escaneos / 10 lugares) y de navegador |
| 2026-11-27 | Omar (con Claude) | Bitácora (#69): `/superadmin/bitacora` de solo lectura con filtros por usuario, acción y rango de fechas en hora de México (Zod; un filtro inválido se ignora y se avisa), 50 por página, detalle con contraseñas, tokens y secretos ocultos; prueba de integración de que la base no deja modificar ni borrar (RF-123) |
| 2026-11-27 | Omar (con Claude) | Mapa en vivo (#72): `/pasajero/mapa` y `/admin/mapa` con MapLibre 6.18.0 + OpenStreetMap, consulta cada 7 s (`GET /api/mapa`), llegada por distancia y velocidad o por duración del cruce, aviso de "última ubicación hace…", lista accesible si el equipo no soporta WebGL; repositorio con la última ubicación por salida (LATERAL); simulador `dev:simular-viaje` mientras llega el GPS (#49) |

## Registro de errores y soluciones

| Fecha | Error / problema | Causa | Solución |
|---|---|---|---|
| 2026-11-17 | `P1000: Authentication failed` al migrar | Un PostgreSQL instalado en Windows ocupaba el puerto 5432 y respondía en lugar del de Docker | El proyecto usa los puertos 5434 (desarrollo) y 5435 (pruebas) |
| 2026-11-17 | `npm i prisma` instaló la 8.0 RC | npm tiene la etiqueta "latest" en una versión candidata | Prisma y @prisma/client fijados en 7.10.1 |
| 2026-11-22 | Playwright: `Executable doesn't exist ... chrome-headless-shell` | Faltaba descargar el navegador de pruebas en esa computadora | `npx playwright install chromium` (una vez por computadora) |
| 2026-11-23 | Playwright: `getByLabel` encuentra dos campos iguales después de navegar | Next.js 16 deja oculta la pantalla anterior al navegar con un enlace | Usar `getByRole("textbox", { name })`, que solo encuentra lo visible |
| 2026-11-23 | Playwright: `Cannot use 'import.meta' outside a module` al importar Prisma en una prueba | Playwright carga las pruebas como CommonJS y el cliente de Prisma es un módulo ES | Preparar datos con un script `tsx` (`scripts/dev-prepare-e2e-accounts.ts`) desde `globalSetup` |
| 2026-11-18 | `npm run check` falla en `database-rules.test.ts` | Docker Desktop estaba cerrado (la prueba de integración necesita la base de pruebas) | Abrir Docker Desktop, `docker compose up -d` y `npm run db:test:prepare` (la base de pruebas se vacía al reiniciar Docker) |
| 2026-11-23 | Un integrante no podía hacer `git push` de su rama ni abrir su PR | Tenía solo permiso de lectura en el repo de la organización (los que sí pudieron trabajaban desde un *fork*) | Equipo `desarrollo` con permiso de escritura (D26) |
| 2026-11-24 | `Route "/pasajero/qr": Next.js encountered uncached data during prerendering` | Con `cacheComponents`, `requireRole` (cookie + base) se llamaba fuera de `<Suspense>` | Mover `requireRole` a un componente interno y envolverlo en `<Suspense>` en `page.tsx` |
| 2026-11-24 | Página recargándose sin parar y `Cannot find module @tailwindcss/turbopack` | Un `npm run dev` seguía corriendo mientras `npm ci` reinstalaba `node_modules` | Detener todos los servidores, `rm -rf node_modules .next`, `npm ci` y levantar un solo `npm run dev` |
| 2026-11-24 | `env.QR_SIGNING_SECRET` es `string \| undefined` | La variable es opcional en `src/lib/env.ts` | Función `getQrSigningSecret()` en `src/infrastructure/qr/qr-key.ts`, que falla con mensaje claro si falta |
| 2026-11-25 | Un QR queda inservible tras iniciar sesión en otro celular | El `POST /api/qr/credential` revoca la credencial anterior y el primer celular conservaba la suya en IndexedDB sin volver a preguntar | `GET /api/qr/credential?id=…`: con internet se consulta y, solo si responde `active: false`, se borra `qr:<userId>` y se pide una nueva |
| 2026-11-25 | `/pasajero/qr` muestra "No pudimos activar tu QR" (500 en el servidor) | `QR_SIGNING_SECRET` vacía en `.env.local`: `.env.example` la trae en blanco | Generarla con el comando de `.env.example` y reiniciar `npm run dev` (Next solo lee las variables al arrancar) |
| 2026-11-25 | `npm run check` falla con `The table public.users does not exist` en las pruebas de integración | La base de pruebas estaba vacía o sin las migraciones nuevas que entraron al fusionar `develop` | `docker compose up -d`, `npm run db:test:prepare` y volver a correr `npm run check` |
| 2026-11-25 | `zsh: no matches found: --include=*.ts` al usar `grep` | zsh expande `*.ts` antes de pasarlo a `grep` | Poner el patrón entre comillas: `--include="*.ts"` |
| 2026-11-27 | El inicio del pasajero mostraba dos veces el tablero de muelles | Al resolver un conflicto quedó repetido `<DocksLiveBoard>` en `src/app/pasajero/page.tsx` | Se quitó el repetido (PR del #44); al resolver conflictos, revisar la pantalla y no solo que compile |
| 2026-11-27 | Playwright: `getByRole("alert")` encuentra dos elementos | Next.js agrega su propio aviso de navegación con `role="alert"` | Darle nombre a la región (`aria-label`) y buscarla con `getByRole("alert", { name })` |
| 2026-11-27 | MapLibre 6: `Worker failed to load` y el mapa no se dibuja | Con el empaquetado de Next.js, MapLibre no encuentra su worker por la ruta relativa | `scripts/copy-maplibre-worker.mjs` lo copia a `public/vendor/` (predev/prebuild) y `setWorkerUrl` apunta ahí |

## Datos pendientes de confirmar en campo

- **Coordenadas de los muelles:** las del seed caen en el centro de Coatzacoalcos, sobre tierra (se ve en el mapa en
  vivo); hay que tomar las reales a la orilla del río en la visita de campo.
- Capacidad real de cada lancha activa (hoy operan 2; el resto está embargado por el SAT).
- Capacidad del transbordador en servicio (vehículos por tipo + personas); hoy opera 1, el otro está descompuesto.
- **PENDIENTE:** si una lancha no se llena, ¿sale tras un tiempo máximo o espera siempre? (mientras, el admin puede cerrar el abordaje).
- **PENDIENTE:** ¿el transbordador sale al llenarse o tiene horario fijo?
- Horario de servicio por muelle, duración del cruce, ritmo de llegada de pasajeros.
- Tarifa vigente del transbordador por tipo de vehículo (prensa: $15 auto, $5 moto, $1 peatón; hay nota de alza a $30).
- Validación actual de descuentos estudiante/INAPAM; conectividad en muelles; si los choferes tienen celular con GPS y datos.
