# Contexto del proyecto â€” lÃ©elo primero

> Documento para cualquier persona o IA que vea este proyecto por primera vez. Cuenta **quÃ© construimos, por quÃ©,
> quÃ© se ha decidido y en quÃ© punto estamos**, desde el inicio hasta hoy. Se actualiza en orden cronolÃ³gico
> (agrega entradas al final de la secciÃ³n Â«LÃ­nea de tiempoÂ»; no borres historia).

## 1. QuÃ© es

Proyecto de **ingenierÃ­a de software** de un equipo de 5 estudiantes (Omar, Pamela, Diego, JosÃ© y Cova):
una plataforma **totalmente funcional** para digitalizar el **paso de lanchas y el transbordador** que cruzan el rÃ­o
Coatzacoalcos entre **Coatzacoalcos y Villa Allende, Veracruz, MÃ©xico**.

Es **una sola aplicaciÃ³n web progresiva (PWA)**: el pasajero la usa en su celular (instalable en la pantalla de inicio)
y el personal la usa en las computadoras del muelle. Funciona como un **metro donde el celular es la tarjeta**:
el pasajero muestra un QR dinÃ¡mico, el administrador lo escanea, se cobra del saldo y se asigna un **nÃºmero de lugar en
la embarcaciÃ³n que estÃ¡ cargando en ese muelle**. Hay dos muelles (Coatzacoalcos y Villa Allende); las embarcaciones
cargan en ambos, salen al llenarse y alternan de muelle. Nunca se permite abordar a mÃ¡s personas (o vehÃ­culos) que la capacidad de la salida.

### Roles (todos en la misma web app)
- **Pasajero:** registro/inicio de sesiÃ³n, saldo, recargas (taquilla o en lÃ­nea con tarjeta), historial de viajes,
  **galerÃ­a de vehÃ­culos** (elige con cuÃ¡l cruza en el transbordador), unidades activas, tiempo a la prÃ³xima salida,
  datos de la embarcaciÃ³n (nombre, color, capacidad, chofer), **mapa en vivo** y su **QR para abordar**.
- **Chofer:** solo Â«Mis embarcacionesÂ», **Iniciar viaje** (comparte su GPS en vivo a todos) y **Terminar viaje**.
- **Administrador:** es tambiÃ©n el taquillero. Escanea QR, recarga en efectivo, registra abordajes de taquilla
  (personas sin celular), cierra abordaje, puede iniciar/terminar viajes como respaldo, administra flota, choferes,
  horarios, tarifas y avisos, ve ocupaciÃ³n en vivo y listas de pasajeros, y **genera los reportes**.
- **Superadministrador:** crea cuentas de administrador y chofer, aprueba las computadoras del muelle y consulta la auditorÃ­a.

No hay vista para autoridades: el administrador genera y entrega los reportes.

## 2. Contexto real (investigaciÃ³n + informaciÃ³n del equipo, nov-2026)

- Lanchas operadas por la **Sociedad Cooperativa de Transporte Fluvial (Transfluvial)**. Lanchas de ~40 pasajeros.
  **Hoy solo operan 2 lanchas**; las demÃ¡s estÃ¡n embargadas por el SAT. 2 muelles del lado de Coatzacoalcos.
- Tarifa lancha desde 15-dic-2025: **$7 general, $5 estudiante/INAPAM**.
- Transbordador municipal (Grijalva: autos, motos y personas; Laguna de Coapa: motos y personas).
  **Hoy solo funciona 1 transbordador**; el otro estÃ¡ descompuesto. Tarifas reportadas: ~$15 auto, $5 moto, $1 peatÃ³n (por verificar).
- Por eso la flota es **ilimitada y con estados** (Activa, En mantenimiento, Embargada, Fuera de servicio);
  al pasajero solo se le muestran las activas.
- Demanda reportada: cayÃ³ de ~11,000 a ~5,000 usuarios diarios (efecto del TÃºnel Sumergido, 2017, peaje ~$49â€“51).
- Problemas: boleto de papel en efectivo, sin control digital de aforo ni informaciÃ³n al usuario; cierres por clima.
- Detalle completo y fuentes: documento 01 de planeaciÃ³n (Word, en la carpeta compartida del equipo; no se sube al repositorio).

## 3. Decisiones tomadas

| # | DecisiÃ³n | Motivo |
|---|---|---|
| D1 | MetodologÃ­a **Scrum** guiada por **prototipo grÃ¡fico** (Figma), sprints de 2 semanas | Validar con usuarios antes de codificar |
| D2 | **Una sola web app PWA** con roles (no app nativa + panel aparte) | Equipo de 5 que se inicia en un entorno real; 1 proyecto, sin tiendas de apps; la nativa costarÃ­a +40â€“60 % sin aportar nada indispensable |
| D3 | Roles: Pasajero, Chofer (mÃ­nimo), Administrador (= taquillero, genera reportes), Superadministrador | Simplificar; sin vista de autoridad ni de operador aparte |
| D4 | **Next.js + TypeScript** (frontend + API juntos), arquitectura limpia por carpetas (domain/application/infrastructure/app) | Un solo proyecto y lenguaje sin perder SOLID |
| D5 | **PostgreSQL + Prisma**; tiempo real por consultas periÃ³dicas (5â€“10 s), sin Redis ni WebSockets | Simplicidad; transacciones seguras para saldo y aforo |
| D6 | **El celular es la tarjeta:** QR dinÃ¡mico TOTP generado en la PWA, **funciona sin internet**; el admin lo escanea (cÃ¡mara o lector USB). Sin tarjetas NFC | Seguro contra capturas; no requiere hardware especial |
| D7 | Escaneo = **una transacciÃ³n** (bloquear viaje â†’ cupo â†’ cobro â†’ abordaje); QR de un solo uso | Cero sobreventa y cero cobro doble |
| D8 | Recarga **en taquilla** (efectivo, con el admin) **y en lÃ­nea** con tarjeta vÃ­a **Mercado Pago o Stripe** (modo prueba en desarrollo) | Nunca tocamos datos de tarjeta; webhook firmado acredita el saldo |
| D9 | **Mapa en vivo con el GPS del celular del chofer** mientras el viaje estÃ¡ Â«En trÃ¡nsitoÂ»; pantalla encendida con Wake Lock; MapLibre + OpenStreetMap | Rastreo real sin comprar hardware; limitaciÃ³n aceptada: requiere la pÃ¡gina abierta |
| D10 | Seguridad admin: sin registro pÃºblico, **computadoras autorizadas** por el superadmin, Argon2, bloqueo por intentos, sesiones que expiran, bitÃ¡cora. **Sin restricciÃ³n por IP** | DecisiÃ³n del equipo: la IP era excesiva |
| D11 | Hosting **Vercel + Neon/Supabase**; GitHub + Actions; Vitest + Playwright | Gratuito y sencillo |
| D12 | Equipo de 5: Omar (PO + arquitectura), Pamela (Scrum Master + requisitos), Diego (frontend), JosÃ© (UX/UI), Cova (BD). **Todos participan en todo** | Aprendizaje completo y sin dependencias de una persona |
| D13 | **Dos muelles con taquilla** (Coatzacoalcos y Villa Allende). Cada salida tiene origen y destino; cada admin y computadora autorizada pertenece a un muelle; el pasajero no elige direcciÃ³n (la determina el muelle donde lo escanean) | Las embarcaciones cargan en ambos lados |
| D14 | Las embarcaciones **salen al llenarse** (sin horario fijo). Fila de embarcaciones por muelle; al llenarse pasa a Abordando la siguiente o se crea lista de espera para la prÃ³xima que llegue; al **Terminar viaje** se abre automÃ¡ticamente la salida de regreso. Estados de la salida: En fila â†’ Abordando â†’ Abordaje cerrado â†’ En trÃ¡nsito â†’ Finalizado | AsÃ­ opera el cruce real |
| D15 | Al pasajero se le muestra, por muelle: embarcaciÃ³n cargando y ocupaciÃ³n, embarcaciÃ³n en camino con tiempo estimado de llegada y estimado de salida por ritmo de abordaje. Â«HorariosÂ» = **horario de servicio** | No hay hora fija de salida |
| D16 | Misma tarifa en ambos sentidos | Confirmado por el equipo |
| D17 | **Venta**: un solo cobro puede incluir varios boletos (Venta 1:N Abordaje). La venta lleva canal (QR con saldo o taquilla), forma de pago y total; cada Abordaje es un boleto con su lugar y su tarifa. El mÃ¡ximo de boletos por venta es una regla de configuraciÃ³n | ObservaciÃ³n del equipo (Â«Â¿cÃ³mo compro mÃ¡s de un boleto?Â») |
| D18 | No hay compra de boletos en lÃ­nea: en lÃ­nea solo se recarga saldo. El boleto se genera al abordar (QR) o en la taquilla | La salida es Â«al llenarseÂ» y el lugar se asigna en el muelle |
| D19 | **Incidente**: si una embarcaciÃ³n sufre un incidente, la salida afectada se reasigna (pasajeros a la lista de espera con prioridad, sin volver a cobrar) o se reembolsa. La fila de embarcaciones sigue siendo la Salida en estado Â«En filaÂ» | ObservaciÃ³n del equipo (Â«reasignar por cualquier accidenteÂ») |
| D20 | Versiones: **Node 24 LTS**, **Next.js 16.4**, **React 19**, **Tailwind 4**, **Prisma 7.10.1 fijado** (la 8.0 aÃºn es RC), **PostgreSQL 17** (misma versiÃ³n en local, CI y Neon) | Estables y con soporte durante todo el proyecto |
| D21 | Entorno local: **Docker solo para los servicios** (PostgreSQL de desarrollo en el puerto **5434**, de pruebas en **5435**, Mailpit, Adminer) y Node instalado en cada computadora; la app en Docker queda como opciÃ³n | En Windows, Next.js dentro de Docker es lento; el 5432 lo ocupa un PostgreSQL instalado en Windows |
| D22 | *(Reemplazada por D26 el 2026-11-23.)* Mientras el equipo se integra, `develop` **no exige aprobaciÃ³n** en GitHub (sigue exigiendo pull request y sin force push); cada PR debe llevar al menos un comentario de revisiÃ³n. `main` sigue con 2 aprobaciones | El equipo aÃºn no participa en las revisiones y bloqueaba todo el avance |
| D23 | **Reparto por mÃ³dulos** (19 mÃ³dulos de los RF): Omar â€” acceso, superadministraciÃ³n, auditorÃ­a; Pamela â€” operaciÃ³n de muelles, flota, choferes, reportes; Diego â€” QR, viajes del chofer, mapa, PWA; JosÃ© â€” cuenta, vehÃ­culos, informaciÃ³n al pasajero, horario y avisos, notificaciones; Cova â€” saldo, abordaje y taquilla, tarifas. Detalle en `docs/MODULOS_Y_RESPONSABLES.md` | Cada quien es dueÃ±o de punta a punta de sus mÃ³dulos |
| D24 | **Login propio, sin librerÃ­a** (ADR 0002 aceptada el 2026-11-22): Argon2id + sesiones en la tabla `sessions` (solo el hash del token) con cookie `HttpOnly`, `requireRole` en servidor y `proxy.ts` solo como filtro rÃ¡pido. Se descartÃ³ Auth.js (en mantenimiento) y Better Auth (exige sus tablas `account`/`verification` y cambiar `users`/`sessions`; las reglas del personal se programan igual) | Usar nuestras tablas tal cual y entender/controlar cada parte |
| D25 | **Seguridad del personal** (issue #9): bloqueo de 15 min (`lockout_minutes`) tras `max_failed_logins` intentos para chofer, admin y superadmin, no para el pasajero; computadora autorizada solo para admin (de su muelle) y superadmin (cualquiera aprobada); inactividad de `session_timeout_minutes_staff` para admin y superadmin. `authorized_devices.dock_id` pasa a ser opcional: sin muelle = computadora de oficina del superadmin | Al pasajero no se le puede dejar sin abordar con intentos maliciosos; el chofer usa su propio celular; el superadmin no tiene muelle |
| D26 | **Permisos en GitHub** (reemplaza a D22): equipo `desarrollo` con permiso de **escritura** en `paso-de-lanchas-app` para los 5. En `develop`: todo entra por PR (sin push directo, sin force push ni borrado), la CI (Â«Lint, tipos, pruebas y buildÂ») debe estar en verde y se exige la **aprobaciÃ³n del responsable del cÃ³digo** (`.github/CODEOWNERS` = Omar); un cambio subido despuÃ©s de aprobar pide aprobar de nuevo. Solo Omar fusiona; como administrador puede fusionar sus propios PRs sin aprobaciÃ³n (GitHub no deja aprobarse a uno mismo), pero tambiÃ©n con la CI en verde. Los compaÃ±eros siguen revisando con comentarios segÃºn la tabla de `docs/MODULOS_Y_RESPONSABLES.md`. `main` sigue con 2 aprobaciones | Con solo lectura nadie mÃ¡s podÃ­a subir ramas al repo (quien no usaba *fork* no podÃ­a hacer push) ni aprobar el PR de `develop` â†’ `main`; al dar escritura, sin estas reglas cualquiera podrÃ­a fusionar su propio PR o subir directo a `develop` (la regla anterior no exigÃ­a PR, aunque D22 lo decÃ­a) |

## 4. Reglas que SIEMPRE se deben seguir

Este proyecto es **ingenierÃ­a de software**: todo cÃ³digo debe:
- Seguir **SOLID, DRY, KISS, YAGNI** y Clean Code.
- Respetar los **patrones de diseÃ±o** definidos (Repository, Strategy para tarifas, State para el ciclo del viaje y de
  la embarcaciÃ³n, Adapter para la pasarela de pagos, Factory, Unit of Work, inyecciÃ³n de dependencias).
- Cumplir los **atributos de calidad** (ISO/IEC 25010): rendimiento (escaneo < 2 s p95), disponibilidad â‰¥ 99.5 %,
  seguridad, integridad (0 sobreventas), usabilidad (abordar en â‰¤ 2 toques), mantenibilidad (â‰¥ 80 % cobertura en dominio),
  escalabilidad, portabilidad (Chrome/Edge y Safari iOS 16.4+).
- Aplicar **principios de seguridad del software** (OWASP Top 10, mÃ­nimo privilegio, defensa en profundidad,
  validaciÃ³n de entradas, secretos fuera del repositorio, auditorÃ­a, LFPDPPP para datos personales y ubicaciÃ³n).
- Mantener actualizados `CLAUDE.md` (cÃ³mo trabajamos, estado, cambios, errores) y este archivo, y **subir los cambios
  constantemente** al repositorio mediante pull requests.

## 5. LÃ­nea de tiempo

### 2026-11-08 â€” Sprint 0: arranque
- Se definiÃ³ la idea general del producto.
- InvestigaciÃ³n en internet de historia, operadores, tarifas y problemÃ¡tica del cruce.
- Documento Word de planeaciÃ³n v1.0 (6 integrantes; app nativa + panel web + backend NestJS separado).
- Se crearon `CLAUDE.md` y este archivo.

### 2026-11-08 â€” Sprint 0: acuerdos del equipo (planeaciÃ³n v1.1)
- Felipe sale del equipo; quedan 5 integrantes con roles redefinidos y participaciÃ³n de todos en todo.
- El equipo aporta datos actuales: 2 lanchas operando (resto embargadas), 1 transbordador operando (otro descompuesto).
- Se simplifica la soluciÃ³n a **una sola web app PWA** y a los roles Pasajero, Chofer, Administrador y Superadministrador
  (decisiones D2â€“D12).
- Se descarta la restricciÃ³n por IP para administradores.
- Se actualizan el Word (v1.1), `CLAUDE.md` y este archivo.

### 2026-11-08 â€” Sprint 0: operaciÃ³n en dos muelles y plan detallado (planeaciÃ³n v1.2)
- El equipo aclara que las embarcaciones cargan en Coatzacoalcos **y** en Villa Allende, salen al llenarse,
  puede haber fila de embarcaciones por muelle, ambos muelles tienen taquilla con internet y la tarifa es igual
  en ambos sentidos (decisiones D13â€“D16).
- **Pendientes de campo:** regla de salida si la lancha no se llena; si el transbordador sale al llenarse o por horario.
- En el Word, la organizaciÃ³n del equipo pasa a la **secciÃ³n 5** (despuÃ©s de la arquitectura) con responsabilidades por
  integrante y un **plan paso a paso por sprint** (0 a 7) que indica actividad, tecnologÃ­a, responsable, participantes y resultado.
- El repositorio Git se crearÃ¡ mÃ¡s adelante, por decisiÃ³n del equipo.
- **Siguiente:** visita de campo y Sprint 1 (requisitos funcionales y no funcionales + prototipo Figma).

### 2026-11-09 â€” Flujo de GitHub (borrador) y requisitos funcionales
- Existe la organizaciÃ³n de GitHub **paso-de-lanchas** (sin repositorios todavÃ­a).
- `docs/02_Flujo_de_Trabajo_GitHub.docx` v1.0: **propuesta en borrador**, aÃºn no aprobada; el equipo puede cambiarla.
  Propone 3 repos (**app** con todo el cÃ³digo, **documentacion**, **.github**), sin separar frontend y backend porque
  Next.js los une; ramas `main` (producciÃ³n) y `develop` (integraciÃ³n/pruebas), ramas de trabajo
  `feature|fix|docs|chore|test/<issue>-descripcion` y `hotfix/`; PR con 1 aprobaciÃ³n de otra Ã¡rea y CI en verde;
  squash hacia develop; release por sprint con versiÃ³n v0.N.0. Pendiente decidir si `app` es pÃºblico o privado.
- `docs/03_Requisitos_Funcionales.docx` v1.0: **127 requisitos funcionales** (RF-001 a RF-127) en 19 mÃ³dulos,
  redactados como Â«El sistema debeâ€¦Â» y clasificados como de **Usuario** (61) o de **Sistema** (66).
  RF-068 (regla de salida si la lancha no se llena) queda PENDIENTE de campo. Incluye propuestas a validar por el equipo:
  lista de espera (RF-062), corte de caja (RF-113), eliminaciÃ³n de cuenta (RF-016) y validaciÃ³n de descuentos (RF-017 a RF-020).
- **Siguiente:** revisiÃ³n de los RF por el equipo, requisitos no funcionales y prototipo Figma.

### 2026-11-10 â€” Prototipo y modelo de datos
- Prototipo navegable en Claude Design: iteraciÃ³n 1 (inicio del pasajero, QR, confirmaciÃ³n de abordaje, taquilla con
  escaneo y sus resultados) e iteraciÃ³n 2 (mapa en vivo, pantallas del chofer, operaciÃ³n del muelle con fila de
  embarcaciones, lista de espera y cancelaciÃ³n de salida).
- Libro de diagramas en draw.io: modelo relacional (30 tablas, PostgreSQL/Prisma, con reglas de integridad) y
  entidad-relaciÃ³n en notaciÃ³n Chen (26 entidades, especializaciÃ³n de Usuario en 4 roles). El equipo lo estÃ¡ revisando.

### 2026-11-12 â€” Repositorios en GitHub
- OrganizaciÃ³n `paso-de-lanchas` con los repos **paso-de-lanchas-app** (pÃºblico: todo el cÃ³digo, sin separar frontend y
  backend) y **.github** (perfil de la organizaciÃ³n, plantillas de issues y pull requests, guÃ­a de contribuciÃ³n).
- Los documentos Word y diagramas **no** se suben: viven en la carpeta compartida en lÃ­nea del equipo.
- Ramas `main` (producciÃ³n) y `develop` (integraciÃ³n, rama por defecto), ambas protegidas: todo entra por pull request
  (1 aprobaciÃ³n hacia `develop`, 2 hacia `main`), sin force push ni borrado. Squash hacia `develop`; merge commit hacia `main`.
- **Siguiente:** que el equipo active 2FA y acepte la invitaciÃ³n, crear el team `desarrollo`, correcciones del diagrama ER.

### 2026-11-13 â€” Prototipo completo y modelo de datos final
- Prototipo en Claude Design terminado: **6 iteraciones, 31 pantallas**, que cubren los 127 RF (3: saldo, recargas y
  corte de caja; 4: cuenta, vehÃ­culos y descuentos; 5: flota, choferes, tarifas, horario, avisos y reportes;
  6: superadministrador, acceso del personal, venta en taquilla, lista de pasajeros, notificaciones y sin conexiÃ³n).
- El equipo revisÃ³ el entidad-relaciÃ³n Chen y dejÃ³ observaciones (carrito, mÃ¡ximo de boletos, ticket en lÃ­nea,
  reasignaciÃ³n por accidente) y una copia con una propuesta de carrito.
- Nueva hoja **Diagrama_ER-Final** (28 entidades) con esas observaciones resueltas: **Venta** en lugar de carrito,
  **Incidente** y reasignaciÃ³n a la lista de espera con prioridad (decisiones D17â€“D19).
- El relacional pasa a **v2.1** (32 tablas): nuevas `sales` e `incidents`; `boardings` apunta a `sales` y el pago, el
  administrador, la computadora y el turno de caja pasan a la venta; `waitlist_entries` gana `priority` y `origin_boarding_id`.
- **Pendiente:** definir el mÃ¡ximo de boletos por venta; revisiÃ³n del ER final por el equipo.

### 2026-11-17 â€” Entorno de desarrollo y base del proyecto
- PRs #1 (documentaciÃ³n) y #2 (entorno Docker + guÃ­a `docs/ENTORNO_DESARROLLO.md`) fusionados a `develop`.
- `develop` deja de exigir aprobaciÃ³n (D22) porque el equipo aÃºn no revisa.
- **Base del proyecto** (PR #3): Next.js 16 + TypeScript + Tailwind; `prisma/schema.prisma` con las **32 tablas**,
  19 enums y 68 llaves forÃ¡neas del relacional v2.1; migraciÃ³n inicial con los CHECK (saldo â‰¥ 0, cupo â‰¤ capacidadâ€¦),
  Ã­ndices Ãºnicos parciales (un abordaje activo por pasajero y salida, una salida abordando por muelle, un viaje por
  chofer, una caja abierta por admin), exclusiÃ³n de tarifas traslapadas y bitÃ¡cora inmutable. Copia de consulta del
  script en `docs/base-de-datos/paso_lanchas_v2.1.sql`.
- Datos de ejemplo (`prisma/seed.ts`): 2 muelles, 5 embarcaciones, tarifas aproximadas, cuentas de prueba por rol.
- Vitest (13 pruebas: dinero, asignaciÃ³n de lugares y reglas de la BD), Playwright, ESLint, Prettier y CI en GitHub Actions.
- Pantallas temporales por rol y `GET /api/health`. Reparto de mÃ³dulos (D23) y ADR 0002 (propuesta, D24).
- **Siguiente:** decidir ADR 0002, crear los issues del sprint 2 en GitHub, que el equipo prepare su computadora,
  visita de campo.

### 2026-11-18 â€” Arranca el sprint 2
- PR #3 fusionado a `develop` (CI en verde). GuÃ­a de contribuciÃ³n del repo `.github` actualizada (PR #1 de ese repo):
  enlaza la guÃ­a del entorno, pide `npm run check` antes de subir y aclara que nadie fusiona sin un comentario de revisiÃ³n.
- Los 5 integrantes ya son miembros de la organizaciÃ³n (Diego se uniÃ³ el 18).
- Sprint 2 Â· Cimientos planeado en GitHub: milestone que vence el **sÃ¡bado 21 de noviembre, 9:00 p. m.** (sprint corto
  para arrancar) y **17 issues (#4â€“#20)** asignados, cada uno con historia, criterios de aceptaciÃ³n, RF y pasos de
  programaciÃ³n (rama, archivos, casos de uso, pruebas y pantalla). Los mÃ³dulos que no son login empiezan sin esperar a
  #7 usando los datos del seed.
- **Siguiente:** #4 (todos preparan su computadora), #5 (Omar decide la librerÃ­a de login), visita de campo.

### 2026-11-22 â€” DecisiÃ³n del login
- ADR 0002 **aceptada**: login propio sobre nuestras tablas (D24). No se instala librerÃ­a de autenticaciÃ³n.
- Omar empieza a programar sus issues: #7 (iniciar y cerrar sesiÃ³n, `requireRole`) primero, porque los demÃ¡s mÃ³dulos
  lo necesitan para quitar los usuarios de ejemplo; luego #6, #8 y #9.
- PRs #28 (Ã­ndices Ãºnicos, #27), #29 (ADR) y #30 (login por rol, #7) fusionados a `develop`.
- Seguridad del personal (#9, D25): bloqueo por intentos, computadoras autorizadas con cookie de dispositivo (solo su
  hash en la base), cierre por inactividad, sesiones cortadas si se retira la computadora y bitÃ¡cora de cada rechazo.
  Script de desarrollo `npm run dev:aprobar-computadoras` mientras llega la pantalla del superadmin (sprint 3).
- Registro de pasajero (#6): nombre, correo, celular a 10 dÃ­gitos y contraseÃ±a (8+ con letra y nÃºmero); aviso de
  privacidad obligatorio (`privacy_accepted_at`). La cuenta nace `PENDING_VERIFICATION` con monedero en $0 y se activa
  con un enlace de 24 h que se confirma con un botÃ³n (no al abrirlo, para que los antivirus de correo no lo gasten).
  Si el correo ya existe, la pantalla responde igual y al dueÃ±o le llega un aviso. Correo por SMTP con nodemailer.
- Recuperar y cambiar contraseÃ±a (#8, 2026-11-23): "Â¿Olvidaste tu contraseÃ±a?" manda un enlace de 30 minutos y un
  solo uso (solo a cuentas activas, mÃ¡ximo 3 cada 30 minutos, misma respuesta exista o no el correo). Al usarlo se
  invalidan los demÃ¡s enlaces, se quita el bloqueo por intentos y se cierran **todas** las sesiones. Cambiar la
  contraseÃ±a desde la cuenta pide la actual y cierra las demÃ¡s sesiones. Con contraseÃ±a temporal
  (`must_change_password`, la que asigna el superadmin) el login lleva a `/cuenta/cambiar-contrasena` y `requireRole` /
  `assertRole` no dejan hacer nada mÃ¡s hasta cambiarla. Cada cambio avisa por correo al dueÃ±o.

### 2026-11-23 â€” Permisos del equipo en GitHub
- Un integrante no podÃ­a hacer push de su rama: todos tenÃ­an solo **lectura** en el repo de la organizaciÃ³n. Pamela y
  JosÃ© trabajaban desde un *fork*, por eso sÃ­ podÃ­an abrir PRs. La guÃ­a de contribuciÃ³n pedÃ­a clonar el repo de la
  organizaciÃ³n, que sin escritura no deja hacer push.
- Se revisaron las reglas: `develop` solo impedÃ­a borrar y hacer force push; **no exigÃ­a PR** (lo contrario a D22).
- D26: equipo `desarrollo` con escritura; `develop` exige PR, CI en verde y la aprobaciÃ³n de Omar (`.github/CODEOWNERS`).
  Ahora tambiÃ©n se puede completar el PR de `develop` â†’ `main` (2 aprobaciones de personas con escritura).
- Pendiente: actualizar el documento Word 02 Â«Flujo de trabajo en GitHubÂ» (v1.2).
### 2026-11-24 — Fila y salidas (#43, PR #58)
- Se reforzó la operación de fila y abordaje con bitácora obligatoria (prismaAuditLogger), bloqueo transaccional por muelle (FOR UPDATE), validación de embarcación activa en todos los muelles respaldada por índice único parcial en departures y prueba E2E de flujo de abordaje.

### 2026-11-24 — Cancelar salida y regreso (#46, PR #59)
- Se integraron los cambios de #58, se invoca startNextBoarding al cancelar una salida BOARDING, se hace obligatorio ecordCashRefund (CASH_REFUND_READY) y unitOfWork, y se reutiliza processBoardingRefunds.

