# Paso de Lanchas Coatzacoalcos ⇄ Villa Allende

Aplicación web progresiva (PWA) para digitalizar el paso de lanchas y el transbordador que cruzan el río Coatzacoalcos
entre **Coatzacoalcos** y **Villa Allende**, Veracruz.

El celular del pasajero es su tarjeta: muestra un **QR dinámico** que funciona sin internet, el administrador del muelle
lo escanea, se cobra del saldo y se le asigna un **lugar en la embarcación** que está cargando en ese muelle, sin pasarse
nunca de la capacidad. El chofer comparte su ubicación durante el viaje y los pasajeros ven las lanchas en un **mapa en vivo**.

> **Estado:** base del proyecto lista (Next.js 16 + Prisma 7 con las 32 tablas). Empieza la programación por módulos.

## Roles

| Rol | Qué hace |
|---|---|
| Pasajero | Saldo y recargas, QR para abordar, galería de vehículos, mapa en vivo, historial |
| Chofer | Sus embarcaciones, iniciar y terminar viaje compartiendo su GPS |
| Administrador | Taquilla: escanea QR, recarga en efectivo, opera la fila del muelle, flota, tarifas, avisos y reportes |
| Superadministrador | Crea cuentas de administrador y chofer, autoriza computadoras del muelle, consulta la bitácora |

## Stack

Next.js 16 + React 19 + TypeScript · Tailwind CSS 4 · PostgreSQL 17 + Prisma 7 · Zod · Argon2 · otplib (QR TOTP) ·
MapLibre GL + OpenStreetMap · Mercado Pago (modo prueba) · Vitest + Playwright · GitHub Actions · Vercel + Neon ·
Docker para los servicios locales.

## Empezar rápido

```powershell
docker compose up -d
Copy-Item .env.example .env.local
npm ci
npm run db:migrate
npm run db:seed; npm run dev
```

Abre http://localhost:3000. La guía completa (instalar Git, Node, Docker…) está en
[docs/ENTORNO_DESARROLLO.md](docs/ENTORNO_DESARROLLO.md), y quién programa cada módulo en
[docs/MODULOS_Y_RESPONSABLES.md](docs/MODULOS_Y_RESPONSABLES.md).

## Estructura

```
src/domain/          entidades y reglas de negocio (sin dependencias externas)
src/application/     casos de uso (AbordarConQR, RecargarSaldo, IniciarViaje…)
src/infrastructure/  repositorios Prisma, pasarela de pagos, firma de QR
src/app/             páginas por rol + rutas API delgadas
prisma/              esquema y migraciones
tests/               pruebas unitarias (Vitest) y de punta a punta (Playwright)
docs/                contexto del proyecto y decisiones de arquitectura (ADR)
```

## Cómo trabajamos

- Ramas: `main` (producción) y `develop` (integración). El trabajo diario va en ramas
  `feature/`, `fix/`, `docs/`, `chore/` o `test/` con el número del issue, por ejemplo `feature/23-escaneo-qr-admin`.
- Todo entra por **pull request hacia `develop`**, con revisión de alguien de otra área.
- Mensajes de commit con **Conventional Commits**: `feat(boarding): cobrar y asignar lugar al escanear QR`.
- Guía completa: [CONTRIBUTING.md](https://github.com/paso-de-lanchas/.github/blob/main/CONTRIBUTING.md).

Para preparar tu computadora (Git, Node, Docker y la base de datos local), sigue
[docs/ENTORNO_DESARROLLO.md](docs/ENTORNO_DESARROLLO.md).

Antes de empezar, lee [CLAUDE.md](CLAUDE.md) (cómo trabajamos y estado actual) y
[docs/CONTEXTO_PROYECTO.md](docs/CONTEXTO_PROYECTO.md) (historia y decisiones del proyecto).

## Equipo

Omar (Product Owner + Arquitectura) · Pamela (Scrum Master + Requisitos) · Diego (Frontend) · José (UX/UI) ·
Cova (Base de datos). Todos participan en todo.
