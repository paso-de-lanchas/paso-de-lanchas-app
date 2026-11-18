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

Regla del equipo: el PR lo revisa alguien **de otra área**. Mientras el equipo arranca, la aprobación no es obligatoria
en `develop`, pero **cada PR debe tener al menos un comentario de revisión**.

| Autor del PR | Revisa | Además, si toca la base | Además, si toca login/permisos/pagos |
|---|---|---|---|
| Omar | Cova | — | — |
| Pamela | Diego | Cova | Omar |
| Diego | José | Cova | Omar |
| José | Pamela | Cova | Omar |
| Cova | Omar | — | Omar |

## 3. Orden de trabajo (sprints de 2 semanas, propuesto)

Los módulos dependen unos de otros: no se puede abordar sin login, ni cobrar sin saldo y tarifas. Por eso este orden:

| Sprint | Qué se construye | Quién |
|---|---|---|
| **2 · Cimientos** | Login, registro y sesiones con roles (RF-001–013) | Omar |
| | Muelles, flota y choferes en el panel del admin (RF-088–096) | Pamela |
| | Tarifas vigentes y solicitudes de descuento (RF-097–101) | Cova |
| | Cuenta y perfil del pasajero (RF-014–020) | José |
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

## 5. Cómo empieza cada quien (su primer día)

1. Prepara tu computadora con [ENTORNO_DESARROLLO.md](ENTORNO_DESARROLLO.md) y comprueba que
   `http://localhost:3000/api/health` responde `{"status":"ok","database":"ok"}`.
2. Abre el issue de tu primera historia (Pamela los crea en el tablero) y crea tu rama:
   `feature/<número>-<descripcion>`.
3. Empieza por la **regla del dominio y su prueba** (`npm run test:watch`), luego el caso de uso, luego la pantalla.
4. Abre tu PR hacia `develop` cuando la historia funcione completa, aunque sea pequeña. PRs pequeños se revisan rápido.

## 6. Decisiones que bloquean módulos

| Decisión | Bloquea a | Quién decide | Para cuándo |
|---|---|---|---|
| Auth.js o Better Auth (ADR 0002) | Omar (login) y todos los demás | Omar | Inicio del sprint 2 |
| Máximo de boletos por venta (hoy 5 en el seed) | Cova (abordaje) | Equipo + visita de campo | Sprint 3 |
| Tarifas reales de lancha y transbordador | Cova (tarifas) | Visita de campo | Sprint 2 |
| Mercado Pago (propuesto) o Stripe | Cova (recarga en línea) | Omar + Cova | Sprint 3 |
| ¿La lancha sale tras un tiempo máximo si no se llena? | Pamela (operación) | Visita de campo | Sprint 3 |
