# Entorno de desarrollo — paso a paso

> Guía para que las 5 personas del equipo tengan **el mismo entorno** en su computadora, sepan **qué cuentas** hay que
> crear (y quién las crea) y entiendan **dónde vive la base de datos** en cada etapa.
> Versión 1.1 · 2026-11-17 · Sistema principal: Windows 10/11 (al final hay notas para macOS).

---

## 0. La idea en una tabla

| Dónde | Qué corre | Para qué | Quién lo usa |
|---|---|---|---|
| **Tu computadora (Docker)** | PostgreSQL 17, base de pruebas, Mailpit (correo falso), Adminer | Programar y probar sin internet ni costos | Todo el equipo |
| **Tu computadora (Node 24)** | La app Next.js (`npm run dev`) | Ver tus cambios al instante en `http://localhost:3000` | Todo el equipo |
| **GitHub Actions** | Lint, pruebas y build en cada pull request, con su propio PostgreSQL temporal | Que nada roto llegue a `develop` | Automático |
| **Neon (nube)** | PostgreSQL de **pruebas** (`develop`) y de **producción** (`main`) | La base que usa la app publicada | Solo la app desplegada |
| **Vercel (nube)** | La app publicada | Vista previa por PR, *staging* (`develop`) y producción (`main`) | Pasajeros, choferes, admins |

**Regla de oro:** cada quien programa contra **su propia base local en Docker**. Nadie se conecta a la base de la nube
desde su computadora, y nadie modifica tablas a mano: todo cambio de la base es una **migración de Prisma** que entra por
pull request.

---

## 1. Instalar en tu computadora (una sola vez)

Abre **PowerShell como administrador** (clic derecho en Inicio → *Terminal (administrador)*) y sigue el orden.

### 1.1 Revisar que la virtualización esté activa

Docker la necesita. Abre el **Administrador de tareas → Rendimiento → CPU** y busca **Virtualización: Habilitado**.
Si dice *Deshabilitado*, actívala en el BIOS (busca "Intel VT-x" o "AMD SVM" según tu equipo) y reinicia.

### 1.2 WSL 2 (Linux dentro de Windows, lo usa Docker)

```powershell
wsl --install
```

Reinicia la computadora. Al volver, se abrirá Ubuntu y te pedirá un usuario y contraseña de Linux (pueden ser
cualquiera; anótalos). Si ya lo tenías, solo actualiza:

```powershell
wsl --update
```

### 1.3 Git

```powershell
winget install --id Git.Git -e
```

Cierra y abre la terminal, y configura tu nombre y el **mismo correo de tu cuenta de GitHub**:

```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo-de-github@ejemplo.com"
git config --global init.defaultBranch main
```

### 1.4 Node.js 24 (LTS) con fnm

Usamos **Node 24 LTS** (soporte hasta abril de 2028, más que la duración del proyecto). Lo instalamos con **fnm** para que
todos tengan exactamente la misma versión; el repo trae el archivo `.node-version` y fnm la elige solo.

```powershell
winget install --id Schniz.fnm -e
```

Agrega fnm a tu terminal (una sola vez):

```powershell
if (!(Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }
Add-Content $PROFILE 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
```

Si PowerShell dice que no puede ejecutar scripts, ejecuta esto **una vez** y responde `S`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Cierra y abre la terminal, e instala Node:

```powershell
fnm install 24
fnm default 24
node --version   # debe decir v24.x.x
npm --version
```

> Si ya tienes Node instalado con el instalador de nodejs.org y es versión 24, también sirve.

### 1.5 Docker Desktop

```powershell
winget install --id Docker.DockerDesktop -e
```

1. Reinicia si te lo pide y abre **Docker Desktop**.
2. Acepta los términos. Es **gratis** para uso personal y educativo; puedes omitir el inicio de sesión (*Skip*).
3. En **Settings → General** deja marcado **Use the WSL 2 based engine**.
4. Comprueba en la terminal:

```powershell
docker --version
docker compose version
docker run --rm hello-world
```

Si el último comando imprime *Hello from Docker!*, quedó listo.

### 1.6 Editor: Visual Studio Code

```powershell
winget install --id Microsoft.VisualStudioCode -e
```

Al abrir el repo, VS Code te ofrecerá instalar las **extensiones recomendadas** (vienen en `.vscode/extensions.json`):
ESLint, Prettier, Prisma, Tailwind CSS, Container Tools (Docker), EditorConfig, Playwright, Vitest y el corrector en
español. Acepta.

### 1.7 GitHub CLI (opcional, recomendado)

```powershell
winget install --id GitHub.cli -e
gh auth login
```

Sirve para abrir pull requests desde la terminal (`gh pr create`).

### 1.8 Comprobación final

```powershell
git --version; node --version; npm --version; docker --version; docker compose version
```

Si los cinco comandos responden, tu computadora está lista.

---

## 2. Cuentas: cuáles, quién y cuándo

**Hoy solo necesitas tu cuenta de GitHub.** Las demás las crea **una sola persona** (la dueña del servicio) cuando
llegue el sprint en que se usan, y luego invita al resto si el servicio lo permite. Así las claves no quedan regadas en
cuentas personales.

| Servicio | Para qué | Plan | Quién la crea | Cuándo |
|---|---|---|---|---|
| **GitHub** | Código, pull requests, CI | Gratis | Cada integrante (ya hecho) + **activar 2FA** | Ya |
| **Docker Desktop** | Entorno local | Gratis (personal/educativo) | Cada integrante, sin cuenta obligatoria | Ya |
| **Neon** | PostgreSQL en la nube | Free (100 proyectos, 1 GB por proyecto, 10 ramas) | Cova (dueña de la BD) e invita a Omar | Sprint del primer despliegue |
| **Vercel** | Publicar la app | Hobby gratis (ver nota) | Omar | Sprint del primer despliegue |
| **Mercado Pago Developers** | Recargas en línea en **modo prueba** | Gratis (cobra comisión solo en real) | Omar o Cova | Sprint de recargas en línea |
| **Resend** | Enviar correos reales (recuperar contraseña) | Free | Omar | Sprint del primer despliegue |
| **Sentry** | Ver errores de la app publicada | Developer gratis (1 usuario) | Omar | Sprint del primer despliegue |
| **OpenFreeMap** | Mapa base (estilo OSM) | Gratis, **sin cuenta ni clave** | — | — |

Cómo crear cada una cuando toque:

1. **Neon** — entra a neon.com → *Sign up with GitHub* → *Create project* `paso-de-lanchas`, región **AWS US East**
   (la más cercana disponible), **Postgres 17**. Crea dos ramas: `production` (la principal) y `staging`. En
   *Settings → Members* invita a Omar. Copia las dos cadenas de conexión (*Connection string*, con *pooled* activado)
   **directo a Vercel**, nunca a un chat ni a un archivo del repo.
2. **Vercel** — vercel.com → *Sign up with GitHub* → *Add New → Project* → importa `paso-de-lanchas/paso-de-lanchas-app`.
   Rama de producción: `main`. En *Settings → Environment Variables* pega las variables de `.env.example` con los
   valores reales: las de **Production** usan la rama `production` de Neon y las de **Preview** la rama `staging`.
3. **Mercado Pago** — mercadopago.com.mx/developers → *Tus integraciones → Crear aplicación* (pagos en línea, Checkout
   Pro). Usa solo las **credenciales de prueba** y los **usuarios de prueba** que genera el panel. El webhook apunta a la
   URL de *staging* de Vercel.
4. **Resend** — resend.com → *Sign up with GitHub* → crea una API key con permiso solo de envío. Sin dominio propio
   solo puede mandar correos a tu propia dirección; para producción hay que verificar un dominio.
5. **Sentry** — sentry.io → plan Developer → proyecto *Next.js*. El DSN va en Vercel.

> **Notas sobre Vercel Hobby** (a confirmar cuando despleguemos):
> - Vercel no permite desplegar en Hobby repos **privados** de una organización. El nuestro es **público**, así que debería
>   funcionar; si Vercel lo bloquea, desplegamos con GitHub Actions + Vercel CLI (gratis) o pasamos a Pro.
> - Hobby es para uso **no comercial**. Para el proyecto escolar está bien; si la app se usa en la operación real del
>   muelle cobrando a pasajeros, hay que pasar a **Vercel Pro** (de pago) o a otro hosting.

---

## 3. Primer arranque del proyecto

### 3.1 Clonar el repo

```powershell
cd $HOME\Documents
git clone https://github.com/paso-de-lanchas/paso-de-lanchas-app.git
cd paso-de-lanchas-app
code .
```

### 3.2 Crear tu archivo de variables

```powershell
Copy-Item .env.example .env.local
```

Los valores de base de datos y correo ya funcionan tal cual. Genera tus dos secretos locales y pégalos en
`AUTH_SECRET` y `QR_SIGNING_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`.env.local` está en `.gitignore`: **nunca** se sube. Si agregas una variable nueva, agrégala también (sin valor real)
a `.env.example` en tu pull request.

### 3.3 Levantar los servicios con Docker

Con **Docker Desktop abierto**:

```powershell
docker compose up -d
docker compose ps
```

Debes ver `db`, `db-test` y `mailpit` en estado *running (healthy)*. Qué quedó corriendo:

| Servicio | Dirección | Usuario / contraseña |
|---|---|---|
| PostgreSQL de desarrollo | `localhost:5434`, base `paso_lanchas` | `paso` / `paso_dev` |
| PostgreSQL de pruebas | `localhost:5435`, base `paso_lanchas_test` | `paso` / `paso_test` |
| Mailpit (correos atrapados) | http://localhost:8025 | — |
| Adminer (opcional) | http://localhost:8080 | servidor `db`, `paso` / `paso_dev` |

Adminer se enciende aparte, solo si quieres ver las tablas en el navegador:

```powershell
docker compose --profile tools up -d
```

Estas contraseñas son **solo para tu computadora**; en la nube son otras y nadie las tiene en su equipo.

### 3.4 Correr la app

Con los servicios de Docker encendidos:

```powershell
npm ci                        # instala dependencias exactas del package-lock.json (y genera el cliente de Prisma)
npm run db:migrate            # crea/actualiza las 32 tablas en TU base local
npm run db:seed               # carga datos de ejemplo (muelles, flota, tarifas, usuarios de prueba)
npm run dev                   # abre http://localhost:3000
```

Comprueba que todo quedó bien abriendo **http://localhost:3000/api/health**: debe decir
`{"status":"ok","database":"ok"}`. Las cuentas de prueba y su contraseña están al inicio de `prisma/seed.ts`.

Para las pruebas:

```powershell
npm run db:test:prepare       # una vez por sesión: prepara la base de pruebas (puerto 5435)
npm test                      # pruebas unitarias y de integración
npm run check                 # lint + tipos + pruebas: córrelo antes de abrir tu PR
```

**Alternativa todo en Docker** (si no quieres instalar Node o algo falla en tu equipo):

```powershell
docker compose --profile app up -d
docker compose logs -f app
```

Es más lento en Windows porque los archivos se comparten entre Windows y Linux; por eso la opción recomendada es Node en
tu computadora y solo los servicios en Docker.

### 3.5 Apagar

```powershell
docker compose stop        # pausa; los datos se quedan
docker compose down        # apaga y quita contenedores; los datos se quedan
docker compose down -v     # apaga y BORRA tu base local (para empezar de cero)
```

---

## 4. Cómo se "sube" la base de datos

La base **no se sube como archivo**. Lo que viaja por GitHub es la **definición** de la base y sus cambios:

```
prisma/schema.prisma           ← el modelo (traducción del relacional v2.1: 32 tablas)
prisma/migrations/2026…_init/  ← cada cambio, como SQL generado por Prisma
prisma/seed.ts                 ← datos de ejemplo (nunca datos reales)
```

### 4.1 El recorrido de un cambio en la base

1. **En tu rama** cambias `schema.prisma` (por ejemplo, agregar `priority` a `waitlist_entries`).
2. Ejecutas `npx prisma migrate dev --name agregar-prioridad-lista-espera`. Prisma crea la carpeta de migración y la
   aplica en **tu** base local de Docker.
3. Haces commit del esquema **y** de la carpeta de migración, y abres el pull request.
4. **GitHub Actions** levanta un PostgreSQL temporal, aplica todas las migraciones desde cero y corre las pruebas. Si
   falla, el PR no se puede fusionar.
5. Cova (o quien revise de otra área) revisa el SQL de la migración.
6. Al fusionar a `develop`, Vercel publica *staging* y ejecuta `prisma migrate deploy` contra la rama `staging` de Neon.
7. Al cierre del sprint, `develop` → `main`: Vercel publica producción y aplica las mismas migraciones en la rama
   `production` de Neon.

Cuando hagas `git pull` y entren migraciones de tus compañeros, ejecuta otra vez `npx prisma migrate dev` para ponerte
al día.

### 4.2 Reglas

- **Nunca** edites tablas a mano en Neon ni en Adminer para "arreglar" algo: haz una migración.
- **Nunca** modifiques una migración que ya está en `develop`; crea una nueva.
- **Nunca** copies datos reales de pasajeros a tu computadora. Para probar, usa el *seed*.
- Si tu base local se descompone: `docker compose down -v`, `docker compose up -d`, `npx prisma migrate dev` y
  `npm run db:seed`.
- Las cadenas de conexión de Neon solo existen en **Vercel** y en los **secretos de GitHub**
  (*Settings → Secrets and variables → Actions*), que administra Omar.

---

## 5. Rutina diaria

```powershell
# 1. Abrir Docker Desktop
git switch develop
git pull
git switch -c feature/23-escaneo-qr-admin     # tu rama, con el número del issue
docker compose up -d
npm run db:migrate                            # por si entraron migraciones nuevas
npm run dev

# ... programar, probar ...
npm run check
git add .
git commit -m "feat(boarding): cobrar y asignar lugar al escanear QR"
git push -u origin feature/23-escaneo-qr-admin
gh pr create --base develop                   # o desde la página de GitHub
```

---

## 6. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker: command not found` / Docker no abre | Docker Desktop cerrado o WSL viejo | Abre Docker Desktop; ejecuta `wsl --update` |
| *Virtualization support not detected* | Virtualización apagada en BIOS | Paso 1.1 |
| `port 5434 is already allocated` o `Authentication failed` en la base | Otro programa usa ese puerto | Crea un archivo `.env` junto a `compose.yaml` con `DB_PORT=5436` y cambia el puerto en `DATABASE_URL` de tu `.env.local`. (Por eso el proyecto no usa el 5432: lo ocupa PostgreSQL si lo instalaste en Windows.) |
| `fnm` no se reconoce | No se agregó al perfil de PowerShell | Repite el paso 1.4 y abre una terminal nueva |
| `Can't reach database server at localhost:5434` | Los contenedores no están encendidos | `docker compose up -d` y `docker compose ps` |
| Los cambios no se recargan con `--profile app` | Windows no avisa los cambios a Docker | Ya está activado el *polling*; si sigue lento, usa Node local (3.4) |
| Archivos con todas las líneas cambiadas en el PR | Finales de línea CRLF | El repo fuerza LF con `.gitattributes`; ejecuta `git add --renormalize .` |
| Docker ocupa mucho disco | Imágenes viejas | `docker system prune` (no borra tus volúmenes) |

---

## 7. Notas para macOS

- En lugar de `winget` usa Homebrew: `brew install git fnm gh` y `brew install --cask docker visual-studio-code`.
- No necesitas WSL. Agrega fnm a tu terminal con `echo 'eval "$(fnm env --use-on-cd)"' >> ~/.zshrc`.
- `Copy-Item .env.example .env.local` se escribe `cp .env.example .env.local`.

---

## 8. Decisiones pendientes que afectan el entorno

| Tema | Situación | Propuesta |
|---|---|---|
| **Auth.js** | Desde septiembre de 2025, el equipo de Auth.js trabaja en **Better Auth**. Auth.js solo recibe parches de seguridad y recomiendan Better Auth para proyectos nuevos. | Hacer un ADR antes de programar el login y decidir entre seguir con Auth.js o cambiar a Better Auth (también usa Argon2/sesiones en BD y Prisma). |
| **Pasarela de pago** | El stack dice "Mercado Pago o Stripe". | Mercado Pago: es la opción común en México y acepta tarjetas, OXXO y saldo de la app. |
| **Versión de Node** | Node 26 ya es LTS activo (octubre 2026); Node 24 sigue con soporte hasta abril de 2028. | Quedarnos en 24 mientras las librerías del stack lo soporten mejor; revisarlo al cierre del semestre. |
| **Hosting de producción** | Vercel Hobby es no comercial. | Si se usa en la operación real, presupuestar Vercel Pro o mover a otro hosting. |
