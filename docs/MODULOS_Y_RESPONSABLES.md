# Módulos y responsables

> Quién programa qué, en qué orden y por dónde empezar. Versión 1.0 · 2026-11-17.
> Los 19 módulos salen del documento 03 «Requisitos funcionales» (127 RF). Cada quien es **dueño de sus módulos de
> punta a punta**: pantalla → caso de uso → acceso a datos → pruebas. "Dueño" no significa "solo": puede pedir ayuda y
> programar en pareja, pero responde por que su módulo quede terminado.

## 1. Reparto

| Integrante | Rol en el equipo | Módulos que programa | RF | Total |
|---|---|---|---|---|
| **Omar** | Product Owner + Arquitectura | Autenticación y control de acceso · Superadministración · Auditoría | RF-001–013 · RF-116–121 · RF-122–124 | 22 |
| **Pamela** | Scrum Master + Requisitos | Operación de muelles y salidas · Gestión de flota · Gestión de choferes · Reportes | RF-055–068 · RF-088–093 · RF-094–096 · RF-110–115 | 29 |
| **Diego** | Frontend | Código QR de abordaje · Viajes del chofer · Mapa y rastreo en vivo · App instalable y sin conexión | RF-032–038 · RF-069–076 · RF-077–081 · RF-125–127 | 23 |
| **José** | UX/UI | Cuenta y perfil · Galería de vehículos · Información al pasajero · Horario y avisos · Notificaciones | RF-014–020 · RF-039–042 · RF-082–087 · RF-102–105 · RF-106–109 | 25 |
| **Cova** | Base de datos | Saldo y recargas · Abordaje y taquilla · Tarifas y descuentos | RF-021–031 · RF-043–054 · RF-097–101 | 28 |

**Responsabilidades transversales** (además de sus módulos):

| Integrante | También se encarga de |
|---|---|
| Omar | Arquitectura y base del proyecto, revisar seguridad de todos los PRs, cuentas de la nube (Vercel, Resend, Sentry), ADRs, fusionar `develop` → `main` al cierre de sprint |
| Pamela | Tablero del sprint (issues y *Project* de GitHub), dailies, criterios de aceptación de cada historia, que los RF se cumplan, pruebas de punta a punta de su área |
| Diego | Componentes compartidos de interfaz (botones, formularios, navegación por rol), que todo funcione bien en celular |
| José | Que cada pantalla siga el prototipo, accesibilidad (contraste, tamaños, textos), textos de la interfaz en español claro |
| Cova | `prisma/schema.prisma` y migraciones (revisa **todo** PR que toque la base), cuenta de Neon, datos de ejemplo (`prisma/seed.ts`) |

## 2. Quién revisa a quién

Regla del equipo: el PR lo revisa alguien **de otra área** y **cada PR debe tener al menos un comentario de revisión**.
Para fusionar a `develop`, GitHub exige además la **aprobación de Omar** (responsable del código en `.github/CODEOWNERS`)
y la CI en verde; **solo Omar fusiona** (decisión D26). La aprobación de un compañero no basta, pero su revisión sí
cuenta: Omar la lee antes de aprobar.

| Autor del PR | Revisa | Además, si toca la base | Además, si toca login/permisos/pagos |
|---|---|---|---|
| Omar | Cova | — | — |
| Pamela | Diego | Cova | Omar |
| Diego | José | Cova | Omar |
| José | Pamela | Cova | Omar |
| Cova | Omar | — | Omar |

## 3. Orden de trabajo (propuesto)

Los módulos dependen unos de otros: no se puede abordar sin login, ni cobrar sin saldo y tarifas. Por eso este orden.
El **sprint 2** es corto para arrancar (del 18 al **sábado 21 de noviembre, 9:00 p. m.**); los siguientes son de 2 semanas.

| Sprint | Qué se construye | Quién |
|---|---|---|
| **2 · Cimientos** | Login, registro y sesiones con roles (RF-001–013) | Omar |
| | Muelles, flota y choferes en el panel del admin (RF-088–096) | Pamela |
| | Tarifas con vigencia e historial y cálculo de la tarifa vigente (RF-097–101) | Cova |
| | Cuenta y perfil del pasajero, incluida la solicitud de descuento (RF-014–020) | José |
| | Componentes compartidos + navegación por rol + generar el QR TOTP (RF-032–034) | Diego |
| **3 · Dinero y QR** | Saldo, recarga en efectivo en taquilla y en línea con Mercado Pago de prueba (RF-021–031) | Cova |
| | QR completo: sin internet, renovación, revocación (RF-035–038) | Diego |
| | Galería de vehículos (RF-039–042) | José |
| | Autorización de computadoras del muelle y cuentas de personal (RF-116–121) | Omar |
| | Salidas en fila y apertura de abordaje (RF-055–061) | Pamela |
| **4 · Abordaje** | **Escaneo del QR = una transacción** (cobro + lugar), venta de varios boletos, taquilla (RF-043–054) | Cova + Omar (en pareja) |
| | Cierre de abordaje, lista de espera, incidentes y reasignación (RF-062–068) | Pamela |
| | Información al pasajero: salidas, lugares disponibles (RF-082–087) | José |
| **5 · Viaje en vivo** | Viajes del chofer con GPS (RF-069–076) | Diego |
| | Mapa en vivo para el pasajero (RF-077–081) | Diego + José |
| | Horario de servicio y avisos (RF-102–105) | José |
| | Bitácora de auditoría (RF-122–124) | Omar |
| **6 · Complementos** | Reportes y corte de caja (RF-110–115) | Pamela + Cova |
| | Notificaciones (RF-106–109) | José |
| | App instalable y modo sin conexión (RF-125–127) | Diego |
| **7 · Cierre** | Pruebas de punta a punta, corrección de errores, despliegue a producción | Todos |

### Issues del sprint 2 en GitHub

Todos están en el milestone **Sprint 2 · Cimientos** y cada uno trae la sección **"Cómo programarlo, paso a paso"**.

| Quién | Issues |
|---|---|
| Todos | #4 Preparar mi computadora |
| Omar | #5 Decidir la librería de login (bloquea el login) · #6 Registro · #7 Iniciar y cerrar sesión por rol · #8 Recuperar y cambiar contraseña · #9 Protección de cuentas del personal |
| Pamela | #10 Tablero del sprint · #11 Registrar embarcaciones · #12 Estados e historial · #13 Choferes |
| Cova | #14 Tarifas con vigencia · #15 Cálculo de la tarifa vigente (Strategy) |
| José | #16 Aviso de privacidad y perfil · #17 Cancelar cuenta · #18 Solicitud de descuento |
| Diego | #19 Componentes compartidos y navegación · #20 QR dinámico sin internet |

## 4. Dónde va el código de cada módulo

Todos siguen la misma estructura (arquitectura limpia). Ejemplo con el módulo **Saldo y recargas**:

```
src/domain/wallet/                 reglas puras: saldo no negativo, montos válidos (+ pruebas *.test.ts)
src/application/wallet/            casos de uso: TopUpCash, TopUpOnline, GetBalance (+ pruebas)
src/infrastructure/wallet/         PrismaWalletRepository, MercadoPagoGateway
src/app/pasajero/saldo/page.tsx    pantalla del pasajero
src/app/admin/recargas/page.tsx    pantalla de la taquilla
src/app/api/wallet/…/route.ts      ruta API delgada: valida con Zod y llama al caso de uso
```

Nombres de carpeta por módulo (en inglés, como el código):

| Módulo | Carpeta | Tablas principales | Pantallas del prototipo |
|---|---|---|---|
| Autenticación y acceso | `auth` | users, auth_tokens, sessions | Login, Registro, AccesoPersonal |
| Cuenta y perfil | `account` | users, push_subscriptions | Perfil del pasajero |
| Saldo y recargas | `wallet` | wallets, wallet_transactions, payments | Saldo, Recargas (admin) |
| Código QR | `qr` | qr_credentials | Main (QR) |
| Galería de vehículos | `vehicles` | vehicles, vehicle_types | Mis vehículos |
| Abordaje y taquilla | `boarding` | sales, boardings, cash_shifts | Taquilla, Corte de caja |
| Operación de muelles | `departures` | departures, departure_vehicle_capacity, waitlist_entries, incidents | AdminOperacion |
| Viajes del chofer | `trips` | departures, trip_locations, vessel_drivers | Chofer |
| Mapa en vivo | `live-map` | trip_locations, docks | Mapa |
| Información al pasajero | `passenger-info` | departures, announcements | Inicio del pasajero |
| Gestión de flota | `fleet` | vessels, vessel_status_history, vessel_vehicle_capacity | Flota |
| Gestión de choferes | `drivers` | users (DRIVER), vessel_drivers | Choferes |
| Tarifas y descuentos | `fares` | fares, discount_requests | Tarifas, Descuentos |
| Horario y avisos | `schedule` | service_hours, dock_service_overrides, announcements | Horario y avisos |
| Notificaciones | `notifications` | notifications, push_subscriptions | — |
| Reportes | `reports` | sales, boardings, wallet_transactions, cash_shifts | Reportes |
| Superadministración | `superadmin` | users, authorized_devices | Superadmin |
| Auditoría | `audit` | audit_logs | Bitácora |
| App instalable | `pwa` | — | — |

Ya hay dos ejemplos para copiar el estilo: `src/domain/shared/money.ts` (dinero sin errores de redondeo) y
`src/domain/departure/seat-allocation.ts` (regla de cero sobreventa), cada uno con sus pruebas.

### Cómo proteger tus pantallas, acciones y APIs (login listo, issue #7)

Nunca recibas el `userId` de un formulario o de la URL: el usuario sale **siempre** de la sesión, en el servidor.

```ts
import { requireRole, assertRole, requireApiRole } from "@/lib/auth/require-role";

// Página (src/app/admin/tarifas/page.tsx): sin sesión → login; otro rol → su propia sección
const user = await requireRole("ADMIN");

// Server Action ("use server"): lanza 401/403 si no tiene permiso
const user = await assertRole("PASSENGER");

// Ruta API (route.ts): responde 401/403 por ti
const auth = await requireApiRole("ADMIN", "SUPERADMIN");
if (!auth.ok) return auth.response;
const user = auth.user;
```

Cuentas para probar (después de `npm run db:seed`): las de la cabecera de `prisma/seed.ts`, entrando por
`http://localhost:3000/login`. Las carpetas `/pasajero`, `/chofer`, `/admin` y `/superadmin` ya tienen `loading.tsx`, así
que las páginas nuevas dentro de ellas pueden llamar a `requireRole` directamente.

**Administrador y superadministrador (issue #9):** solo entran desde una **computadora autorizada**. La primera vez que
entras con `admin.coa`, `admin.val` o `superadmin` desde tu navegador, el login dice que la computadora no está
autorizada y crea la solicitud. Mientras el superadministrador no tenga su pantalla (sprint 3), apruébala en tu base local
con `npm run dev:aprobar-computadoras` y vuelve a entrar. Además, el personal se bloquea 15 minutos tras 5 contraseñas
incorrectas seguidas, y la sesión de admin/superadmin se cierra tras 30 minutos sin actividad.

**Contraseña temporal (issue #8):** si una cuenta tiene `must_change_password = true` (la que el superadmin crea o
restablece), `requireRole` la manda a `/cuenta/cambiar-contrasena` y `assertRole` / `requireApiRole` responden 403
hasta que la cambie. No necesitas hacer nada en tus módulos: ya lo hacen esas funciones. Las pruebas de navegador de
contraseñas usan cuentas `e2e.*@pasolanchas.test` que se preparan solas al correr `npm run test:e2e`. Para probarlo a
mano entra con `chofer.temporal@pasolanchas.test` (seed).

**Cuentas del personal (issue #41):** con `superadmin` entra a `/superadmin/personal` para crear administradores o
choferes de prueba; la contraseña temporal se muestra una vez (y llega a Mailpit, `http://localhost:8025`). En las
pruebas de Playwright usa `login` y `loginFromAuthorizedComputer` de `tests/e2e/auth-helpers.ts`.

## 5. Cómo empieza cada quien (su primer día)

1. Prepara tu computadora con [ENTORNO_DESARROLLO.md](ENTORNO_DESARROLLO.md) y comprueba que
   `http://localhost:3000/api/health` responde `{"status":"ok","database":"ok"}`.
2. Abre tu issue en el milestone **Sprint 2 · Cimientos** (pestaña *Issues* del repo; ya tiene criterios de aceptación
   y dónde va el código) y crea tu rama:
   `feature/<número>-<descripcion>`.
3. Empieza por la **regla del dominio y su prueba** (`npm run test:watch`), luego el caso de uso, luego la pantalla.
4. Abre tu PR hacia `develop` cuando la historia funcione completa, aunque sea pequeña. PRs pequeños se revisan rápido.

## 6. Decisiones que bloquean módulos

| Decisión | Bloquea a | Quién decide | Para cuándo |
|---|---|---|---|
| ~~Librería de login (ADR 0002)~~ **Decidido 2026-11-22: login propio** | Omar (login) y todos los demás | Omar | Hecho |
| Máximo de boletos por venta (hoy 5 en el seed) | Cova (abordaje) | Equipo + visita de campo | Sprint 3 |
| Tarifas reales de lancha y transbordador | Cova (tarifas) | Visita de campo | Sprint 2 |
| Mercado Pago (propuesto) o Stripe | Cova (recarga en línea) | Omar + Cova | Sprint 3 |
| ¿La lancha sale tras un tiempo máximo si no se llena? | Pamela (operación) | Visita de campo | Sprint 3 |
