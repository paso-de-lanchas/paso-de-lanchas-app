# Contexto del proyecto — léelo primero

> Documento para cualquier persona o IA que vea este proyecto por primera vez. Cuenta **qué construimos, por qué,
> qué se ha decidido y en qué punto estamos**, desde el inicio hasta hoy. Se actualiza en orden cronológico
> (agrega entradas al final de la sección «Línea de tiempo»; no borres historia).

## 1. Qué es

Proyecto de **ingeniería de software** de un equipo de 5 estudiantes (Omar, Pamela, Diego, José y Cova):
una plataforma **totalmente funcional** para digitalizar el **paso de lanchas y el transbordador** que cruzan el río
Coatzacoalcos entre **Coatzacoalcos y Villa Allende, Veracruz, México**.

Es **una sola aplicación web progresiva (PWA)**: el pasajero la usa en su celular (instalable en la pantalla de inicio)
y el personal la usa en las computadoras del muelle. Funciona como un **metro donde el celular es la tarjeta**:
el pasajero muestra un QR dinámico, el administrador lo escanea, se cobra del saldo y se asigna un **número de lugar en
la embarcación que está cargando en ese muelle**. Hay dos muelles (Coatzacoalcos y Villa Allende); las embarcaciones
cargan en ambos, salen al llenarse y alternan de muelle. Nunca se permite abordar a más personas (o vehículos) que la capacidad de la salida.

### Roles (todos en la misma web app)
- **Pasajero:** registro/inicio de sesión, saldo, recargas (taquilla o en línea con tarjeta), historial de viajes,
  **galería de vehículos** (elige con cuál cruza en el transbordador), unidades activas, tiempo a la próxima salida,
  datos de la embarcación (nombre, color, capacidad, chofer), **mapa en vivo** y su **QR para abordar**.
- **Chofer:** solo «Mis embarcaciones», **Iniciar viaje** (comparte su GPS en vivo a todos) y **Terminar viaje**.
- **Administrador:** es también el taquillero. Escanea QR, recarga en efectivo, registra abordajes de taquilla
  (personas sin celular), cierra abordaje, puede iniciar/terminar viajes como respaldo, administra flota, choferes,
  horarios, tarifas y avisos, ve ocupación en vivo y listas de pasajeros, y **genera los reportes**.
- **Superadministrador:** crea cuentas de administrador y chofer, aprueba las computadoras del muelle y consulta la auditoría.

No hay vista para autoridades: el administrador genera y entrega los reportes.

## 2. Contexto real (investigación + información del equipo, nov-2026)

- Lanchas operadas por la **Sociedad Cooperativa de Transporte Fluvial (Transfluvial)**. Lanchas de ~40 pasajeros.
  **Hoy solo operan 2 lanchas**; las demás están embargadas por el SAT. 2 muelles del lado de Coatzacoalcos.
- Tarifa lancha desde 15-dic-2025: **$7 general, $5 estudiante/INAPAM**.
- Transbordador municipal (Grijalva: autos, motos y personas; Laguna de Coapa: motos y personas).
  **Hoy solo funciona 1 transbordador**; el otro está descompuesto. Tarifas reportadas: ~$15 auto, $5 moto, $1 peatón (por verificar).
- Por eso la flota es **ilimitada y con estados** (Activa, En mantenimiento, Embargada, Fuera de servicio);
  al pasajero solo se le muestran las activas.
- Demanda reportada: cayó de ~11,000 a ~5,000 usuarios diarios (efecto del Túnel Sumergido, 2017, peaje ~$49–51).
- Problemas: boleto de papel en efectivo, sin control digital de aforo ni información al usuario; cierres por clima.
- Detalle completo y fuentes: documento 01 de planeación (Word, en la carpeta compartida del equipo; no se sube al repositorio).

## 3. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | Metodología **Scrum** guiada por **prototipo gráfico** (Figma), sprints de 2 semanas | Validar con usuarios antes de codificar |
| D2 | **Una sola web app PWA** con roles (no app nativa + panel aparte) | Equipo de 5 que se inicia en un entorno real; 1 proyecto, sin tiendas de apps; la nativa costaría +40–60 % sin aportar nada indispensable |
| D3 | Roles: Pasajero, Chofer (mínimo), Administrador (= taquillero, genera reportes), Superadministrador | Simplificar; sin vista de autoridad ni de operador aparte |
| D4 | **Next.js + TypeScript** (frontend + API juntos), arquitectura limpia por carpetas (domain/application/infrastructure/app) | Un solo proyecto y lenguaje sin perder SOLID |
| D5 | **PostgreSQL + Prisma**; tiempo real por consultas periódicas (5–10 s), sin Redis ni WebSockets | Simplicidad; transacciones seguras para saldo y aforo |
| D6 | **El celular es la tarjeta:** QR dinámico TOTP generado en la PWA, **funciona sin internet**; el admin lo escanea (cámara o lector USB). Sin tarjetas NFC | Seguro contra capturas; no requiere hardware especial |
| D7 | Escaneo = **una transacción** (bloquear viaje → cupo → cobro → abordaje); QR de un solo uso | Cero sobreventa y cero cobro doble |
| D8 | Recarga **en taquilla** (efectivo, con el admin) **y en línea** con tarjeta vía **Mercado Pago o Stripe** (modo prueba en desarrollo) | Nunca tocamos datos de tarjeta; webhook firmado acredita el saldo |
| D9 | **Mapa en vivo con el GPS del celular del chofer** mientras el viaje está «En tránsito»; pantalla encendida con Wake Lock; MapLibre + OpenStreetMap | Rastreo real sin comprar hardware; limitación aceptada: requiere la página abierta |
| D10 | Seguridad admin: sin registro público, **computadoras autorizadas** por el superadmin, Argon2, bloqueo por intentos, sesiones que expiran, bitácora. **Sin restricción por IP** | Decisión del equipo: la IP era excesiva |
| D11 | Hosting **Vercel + Neon/Supabase**; GitHub + Actions; Vitest + Playwright | Gratuito y sencillo |
| D12 | Equipo de 5: Omar (PO + arquitectura), Pamela (Scrum Master + requisitos), Diego (frontend), José (UX/UI), Cova (BD). **Todos participan en todo** | Aprendizaje completo y sin dependencias de una persona |
| D13 | **Dos muelles con taquilla** (Coatzacoalcos y Villa Allende). Cada salida tiene origen y destino; cada admin y computadora autorizada pertenece a un muelle; el pasajero no elige dirección (la determina el muelle donde lo escanean) | Las embarcaciones cargan en ambos lados |
| D14 | Las embarcaciones **salen al llenarse** (sin horario fijo). Fila de embarcaciones por muelle; al llenarse pasa a Abordando la siguiente o se crea lista de espera para la próxima que llegue; al **Terminar viaje** se abre automáticamente la salida de regreso. Estados de la salida: En fila → Abordando → Abordaje cerrado → En tránsito → Finalizado | Así opera el cruce real |
| D15 | Al pasajero se le muestra, por muelle: embarcación cargando y ocupación, embarcación en camino con tiempo estimado de llegada y estimado de salida por ritmo de abordaje. «Horarios» = **horario de servicio** | No hay hora fija de salida |
| D16 | Misma tarifa en ambos sentidos | Confirmado por el equipo |
| D17 | **Venta**: un solo cobro puede incluir varios boletos (Venta 1:N Abordaje). La venta lleva canal (QR con saldo o taquilla), forma de pago y total; cada Abordaje es un boleto con su lugar y su tarifa. El máximo de boletos por venta es una regla de configuración | Observación del equipo («¿cómo compro más de un boleto?») |
| D18 | No hay compra de boletos en línea: en línea solo se recarga saldo. El boleto se genera al abordar (QR) o en la taquilla | La salida es «al llenarse» y el lugar se asigna en el muelle |
| D19 | **Incidente**: si una embarcación sufre un incidente, la salida afectada se reasigna (pasajeros a la lista de espera con prioridad, sin volver a cobrar) o se reembolsa. La fila de embarcaciones sigue siendo la Salida en estado «En fila» | Observación del equipo («reasignar por cualquier accidente») |
| D20 | Versiones: **Node 24 LTS**, **Next.js 16.4**, **React 19**, **Tailwind 4**, **Prisma 7.10.1 fijado** (la 8.0 aún es RC), **PostgreSQL 17** (misma versión en local, CI y Neon) | Estables y con soporte durante todo el proyecto |
| D21 | Entorno local: **Docker solo para los servicios** (PostgreSQL de desarrollo en el puerto **5434**, de pruebas en **5435**, Mailpit, Adminer) y Node instalado en cada computadora; la app en Docker queda como opción | En Windows, Next.js dentro de Docker es lento; el 5432 lo ocupa un PostgreSQL instalado en Windows |
| D22 | Mientras el equipo se integra, `develop` **no exige aprobación** en GitHub (sigue exigiendo pull request y sin force push); cada PR debe llevar al menos un comentario de revisión. `main` sigue con 2 aprobaciones | El equipo aún no participa en las revisiones y bloqueaba todo el avance |
| D23 | **Reparto por módulos** (19 módulos de los RF): Omar — acceso, superadministración, auditoría; Pamela — operación de muelles, flota, choferes, reportes; Diego — QR, viajes del chofer, mapa, PWA; José — cuenta, vehículos, información al pasajero, horario y avisos, notificaciones; Cova — saldo, abordaje y taquilla, tarifas. Detalle en `docs/MODULOS_Y_RESPONSABLES.md` | Cada quien es dueño de punta a punta de sus módulos |
| D24 | **Login propio, sin librería** (ADR 0002 aceptada el 2026-11-22): Argon2id + sesiones en la tabla `sessions` (solo el hash del token) con cookie `HttpOnly`, `requireRole` en servidor y `proxy.ts` solo como filtro rápido. Se descartó Auth.js (en mantenimiento) y Better Auth (exige sus tablas `account`/`verification` y cambiar `users`/`sessions`; las reglas del personal se programan igual) | Usar nuestras tablas tal cual y entender/controlar cada parte |
| D25 | **Seguridad del personal** (issue #9): bloqueo de 15 min (`lockout_minutes`) tras `max_failed_logins` intentos para chofer, admin y superadmin, no para el pasajero; computadora autorizada solo para admin (de su muelle) y superadmin (cualquiera aprobada); inactividad de `session_timeout_minutes_staff` para admin y superadmin. `authorized_devices.dock_id` pasa a ser opcional: sin muelle = computadora de oficina del superadmin | Al pasajero no se le puede dejar sin abordar con intentos maliciosos; el chofer usa su propio celular; el superadmin no tiene muelle |

## 4. Reglas que SIEMPRE se deben seguir

Este proyecto es **ingeniería de software**: todo código debe:
- Seguir **SOLID, DRY, KISS, YAGNI** y Clean Code.
- Respetar los **patrones de diseño** definidos (Repository, Strategy para tarifas, State para el ciclo del viaje y de
  la embarcación, Adapter para la pasarela de pagos, Factory, Unit of Work, inyección de dependencias).
- Cumplir los **atributos de calidad** (ISO/IEC 25010): rendimiento (escaneo < 2 s p95), disponibilidad ≥ 99.5 %,
  seguridad, integridad (0 sobreventas), usabilidad (abordar en ≤ 2 toques), mantenibilidad (≥ 80 % cobertura en dominio),
  escalabilidad, portabilidad (Chrome/Edge y Safari iOS 16.4+).
- Aplicar **principios de seguridad del software** (OWASP Top 10, mínimo privilegio, defensa en profundidad,
  validación de entradas, secretos fuera del repositorio, auditoría, LFPDPPP para datos personales y ubicación).
- Mantener actualizados `CLAUDE.md` (cómo trabajamos, estado, cambios, errores) y este archivo, y **subir los cambios
  constantemente** al repositorio mediante pull requests.

## 5. Línea de tiempo

### 2026-11-08 — Sprint 0: arranque
- Se definió la idea general del producto.
- Investigación en internet de historia, operadores, tarifas y problemática del cruce.
- Documento Word de planeación v1.0 (6 integrantes; app nativa + panel web + backend NestJS separado).
- Se crearon `CLAUDE.md` y este archivo.

### 2026-11-08 — Sprint 0: acuerdos del equipo (planeación v1.1)
- Felipe sale del equipo; quedan 5 integrantes con roles redefinidos y participación de todos en todo.
- El equipo aporta datos actuales: 2 lanchas operando (resto embargadas), 1 transbordador operando (otro descompuesto).
- Se simplifica la solución a **una sola web app PWA** y a los roles Pasajero, Chofer, Administrador y Superadministrador
  (decisiones D2–D12).
- Se descarta la restricción por IP para administradores.
- Se actualizan el Word (v1.1), `CLAUDE.md` y este archivo.

### 2026-11-08 — Sprint 0: operación en dos muelles y plan detallado (planeación v1.2)
- El equipo aclara que las embarcaciones cargan en Coatzacoalcos **y** en Villa Allende, salen al llenarse,
  puede haber fila de embarcaciones por muelle, ambos muelles tienen taquilla con internet y la tarifa es igual
  en ambos sentidos (decisiones D13–D16).
- **Pendientes de campo:** regla de salida si la lancha no se llena; si el transbordador sale al llenarse o por horario.
- En el Word, la organización del equipo pasa a la **sección 5** (después de la arquitectura) con responsabilidades por
  integrante y un **plan paso a paso por sprint** (0 a 7) que indica actividad, tecnología, responsable, participantes y resultado.
- El repositorio Git se creará más adelante, por decisión del equipo.
- **Siguiente:** visita de campo y Sprint 1 (requisitos funcionales y no funcionales + prototipo Figma).

### 2026-11-09 — Flujo de GitHub (borrador) y requisitos funcionales
- Existe la organización de GitHub **paso-de-lanchas** (sin repositorios todavía).
- `docs/02_Flujo_de_Trabajo_GitHub.docx` v1.0: **propuesta en borrador**, aún no aprobada; el equipo puede cambiarla.
  Propone 3 repos (**app** con todo el código, **documentacion**, **.github**), sin separar frontend y backend porque
  Next.js los une; ramas `main` (producción) y `develop` (integración/pruebas), ramas de trabajo
  `feature|fix|docs|chore|test/<issue>-descripcion` y `hotfix/`; PR con 1 aprobación de otra área y CI en verde;
  squash hacia develop; release por sprint con versión v0.N.0. Pendiente decidir si `app` es público o privado.
- `docs/03_Requisitos_Funcionales.docx` v1.0: **127 requisitos funcionales** (RF-001 a RF-127) en 19 módulos,
  redactados como «El sistema debe…» y clasificados como de **Usuario** (61) o de **Sistema** (66).
  RF-068 (regla de salida si la lancha no se llena) queda PENDIENTE de campo. Incluye propuestas a validar por el equipo:
  lista de espera (RF-062), corte de caja (RF-113), eliminación de cuenta (RF-016) y validación de descuentos (RF-017 a RF-020).
- **Siguiente:** revisión de los RF por el equipo, requisitos no funcionales y prototipo Figma.

### 2026-11-10 — Prototipo y modelo de datos
- Prototipo navegable en Claude Design: iteración 1 (inicio del pasajero, QR, confirmación de abordaje, taquilla con
  escaneo y sus resultados) e iteración 2 (mapa en vivo, pantallas del chofer, operación del muelle con fila de
  embarcaciones, lista de espera y cancelación de salida).
- Libro de diagramas en draw.io: modelo relacional (30 tablas, PostgreSQL/Prisma, con reglas de integridad) y
  entidad-relación en notación Chen (26 entidades, especialización de Usuario en 4 roles). El equipo lo está revisando.

### 2026-11-12 — Repositorios en GitHub
- Organización `paso-de-lanchas` con los repos **paso-de-lanchas-app** (público: todo el código, sin separar frontend y
  backend) y **.github** (perfil de la organización, plantillas de issues y pull requests, guía de contribución).
- Los documentos Word y diagramas **no** se suben: viven en la carpeta compartida en línea del equipo.
- Ramas `main` (producción) y `develop` (integración, rama por defecto), ambas protegidas: todo entra por pull request
  (1 aprobación hacia `develop`, 2 hacia `main`), sin force push ni borrado. Squash hacia `develop`; merge commit hacia `main`.
- **Siguiente:** que el equipo active 2FA y acepte la invitación, crear el team `desarrollo`, correcciones del diagrama ER.

### 2026-11-13 — Prototipo completo y modelo de datos final
- Prototipo en Claude Design terminado: **6 iteraciones, 31 pantallas**, que cubren los 127 RF (3: saldo, recargas y
  corte de caja; 4: cuenta, vehículos y descuentos; 5: flota, choferes, tarifas, horario, avisos y reportes;
  6: superadministrador, acceso del personal, venta en taquilla, lista de pasajeros, notificaciones y sin conexión).
- El equipo revisó el entidad-relación Chen y dejó observaciones (carrito, máximo de boletos, ticket en línea,
  reasignación por accidente) y una copia con una propuesta de carrito.
- Nueva hoja **Diagrama_ER-Final** (28 entidades) con esas observaciones resueltas: **Venta** en lugar de carrito,
  **Incidente** y reasignación a la lista de espera con prioridad (decisiones D17–D19).
- El relacional pasa a **v2.1** (32 tablas): nuevas `sales` e `incidents`; `boardings` apunta a `sales` y el pago, el
  administrador, la computadora y el turno de caja pasan a la venta; `waitlist_entries` gana `priority` y `origin_boarding_id`.
- **Pendiente:** definir el máximo de boletos por venta; revisión del ER final por el equipo.

### 2026-11-17 — Entorno de desarrollo y base del proyecto
- PRs #1 (documentación) y #2 (entorno Docker + guía `docs/ENTORNO_DESARROLLO.md`) fusionados a `develop`.
- `develop` deja de exigir aprobación (D22) porque el equipo aún no revisa.
- **Base del proyecto** (PR #3): Next.js 16 + TypeScript + Tailwind; `prisma/schema.prisma` con las **32 tablas**,
  19 enums y 68 llaves foráneas del relacional v2.1; migración inicial con los CHECK (saldo ≥ 0, cupo ≤ capacidad…),
  índices únicos parciales (un abordaje activo por pasajero y salida, una salida abordando por muelle, un viaje por
  chofer, una caja abierta por admin), exclusión de tarifas traslapadas y bitácora inmutable. Copia de consulta del
  script en `docs/base-de-datos/paso_lanchas_v2.1.sql`.
- Datos de ejemplo (`prisma/seed.ts`): 2 muelles, 5 embarcaciones, tarifas aproximadas, cuentas de prueba por rol.
- Vitest (13 pruebas: dinero, asignación de lugares y reglas de la BD), Playwright, ESLint, Prettier y CI en GitHub Actions.
- Pantallas temporales por rol y `GET /api/health`. Reparto de módulos (D23) y ADR 0002 (propuesta, D24).
- **Siguiente:** decidir ADR 0002, crear los issues del sprint 2 en GitHub, que el equipo prepare su computadora,
  visita de campo.

### 2026-11-18 — Arranca el sprint 2
- PR #3 fusionado a `develop` (CI en verde). Guía de contribución del repo `.github` actualizada (PR #1 de ese repo):
  enlaza la guía del entorno, pide `npm run check` antes de subir y aclara que nadie fusiona sin un comentario de revisión.
- Los 5 integrantes ya son miembros de la organización (Diego se unió el 18).
- Sprint 2 · Cimientos planeado en GitHub: milestone que vence el **sábado 21 de noviembre, 9:00 p. m.** (sprint corto
  para arrancar) y **17 issues (#4–#20)** asignados, cada uno con historia, criterios de aceptación, RF y pasos de
  programación (rama, archivos, casos de uso, pruebas y pantalla). Los módulos que no son login empiezan sin esperar a
  #7 usando los datos del seed.
- **Siguiente:** #4 (todos preparan su computadora), #5 (Omar decide la librería de login), visita de campo.

### 2026-11-22 — Decisión del login
- ADR 0002 **aceptada**: login propio sobre nuestras tablas (D24). No se instala librería de autenticación.
- Omar empieza a programar sus issues: #7 (iniciar y cerrar sesión, `requireRole`) primero, porque los demás módulos
  lo necesitan para quitar los usuarios de ejemplo; luego #6, #8 y #9.
- PRs #28 (índices únicos, #27), #29 (ADR) y #30 (login por rol, #7) fusionados a `develop`.
- Seguridad del personal (#9, D25): bloqueo por intentos, computadoras autorizadas con cookie de dispositivo (solo su
  hash en la base), cierre por inactividad, sesiones cortadas si se retira la computadora y bitácora de cada rechazo.
  Script de desarrollo `npm run dev:aprobar-computadoras` mientras llega la pantalla del superadmin (sprint 3).
- Registro de pasajero (#6): nombre, correo, celular a 10 dígitos y contraseña (8+ con letra y número); aviso de
  privacidad obligatorio (`privacy_accepted_at`). La cuenta nace `PENDING_VERIFICATION` con monedero en $0 y se activa
  con un enlace de 24 h que se confirma con un botón (no al abrirlo, para que los antivirus de correo no lo gasten).
  Si el correo ya existe, la pantalla responde igual y al dueño le llega un aviso. Correo por SMTP con nodemailer.
- Recuperar y cambiar contraseña (#8, 2026-11-23): "¿Olvidaste tu contraseña?" manda un enlace de 30 minutos y un
  solo uso (solo a cuentas activas, máximo 3 cada 30 minutos, misma respuesta exista o no el correo). Al usarlo se
  invalidan los demás enlaces, se quita el bloqueo por intentos y se cierran **todas** las sesiones. Cambiar la
  contraseña desde la cuenta pide la actual y cierra las demás sesiones. Con contraseña temporal
  (`must_change_password`, la que asigna el superadmin) el login lleva a `/cuenta/cambiar-contrasena` y `requireRole` /
  `assertRole` no dejan hacer nada más hasta cambiarla. Cada cambio avisa por correo al dueño.
