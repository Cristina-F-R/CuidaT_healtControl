# Cuidat

Aplicación para registrar el cuidado de perfiles (mascotas, niños, adultos) y correlacionar síntomas y desencadenantes. Monorepo con `shared`, `client` (Vue) y `server` (Express + Neon PostgreSQL). Los detalles de diseño están en `TECH_SPEC.md` y `STYLE_GUIDE.md`.

## Demo pública

**URL:** _pendiente: sustituir por la URL de Render tras el primer despliegue (`https://<servicio>.onrender.com`)._

> [!NOTE]
> La demo usa el plan gratuito de Render: el servicio se duerme tras unos 15 minutos sin tráfico y **la primera carga puede tardar hasta un minuto**. Después responde con normalidad.

- **Modo invitado:** al abrir la página ya puedes usar la app sin cuenta («Modo Local»), con un calendario de ejemplo. Los datos se guardan solo en ese navegador.
- **Registrarse:** **Iniciar sesión → Crear cuenta**, con un email y una contraseña de al menos 12 caracteres. Puedes migrar a la cuenta los datos que ya tengas como invitado.

> [!WARNING]
> **Privacidad:** es una demo académica. No introduzcas datos de salud reales ni contraseñas que uses en otros sitios. Los datos de las cuentas se guardan en Neon (UE) y pueden borrarse sin aviso. Desde el menú de la cuenta puedes descargar tus datos o eliminar la cuenta y todos sus datos.

### Acceso para la corrección

Usuario de prueba para corrección profesorado Master en Desarrollo en IA. En la app, **Iniciar sesión → Acceso rápido profesorado** entra directamente con:

- Usuario: `profesorado@cuidat.test`
- Contraseña: `MasterIA-Correccion-2026`

Si la cuenta aún no existe en la base de datos, el botón la crea la primera vez con el calendario de ejemplo (Moby). Las credenciales son públicas: no guardes datos reales en ella.

## Puesta en marcha local

```bash
npm ci
cp server/.env.example server/.env   # rellena DATABASE_URL, DATABASE_URL_DIRECT y JWT_SECRET
npm run db:migrate
npm run dev:server   # en una terminal
npm run dev:client   # en otra
```

## Comprobaciones de calidad

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run test:e2e     # usa la rama `test` de Neon (server/.env.test)
```

## Integración continua

Los flujos viven en `.github/workflows/`:

| Archivo | Cuándo se ejecuta | Qué hace |
| --- | --- | --- |
| `ci.yml` | `pull_request` y `push` a `main` | Trabajo `quality`: `npm ci`, `typecheck`, `lint`, `test:coverage` y `npm audit --omit=dev --audit-level=high` (A06). Trabajo `e2e`: instala Chromium, reinicia la rama `test` de Neon (`ALLOW_DB_RESET=true npm run db:reset -- --yes`) y lanza `npm run test:e2e`. Sube `playwright-report` como artefacto. |
| `snyk.yml` | `pull_request` y cada lunes | Análisis de dependencias con Snyk. |
| `docker-publish.yml` | `push` a `main` | Construye `server/Dockerfile` y publica la imagen en `ghcr.io/<propietario>/<repositorio>` con las etiquetas `latest` y `sha-<commit>`. |
| `keep-warm.yml` | Cada 10 minutos (opcional) | Pide `/api/health` a la demo para que Render no la duerma. Solo actúa si existe la variable `PUBLIC_URL` (ver «Despliegue»). |

El trabajo `e2e` usa `concurrency` (`e2e-neon-test`) para que nunca haya dos ejecuciones a la vez sobre la misma rama de Neon. Las acciones de terceros están fijadas a su SHA (A08); la versión queda en el comentario de cada línea.

### Secretos necesarios

Se definen en *Settings → Secrets and variables → Actions* del repositorio.

| Secreto | Lo usa | Contenido |
| --- | --- | --- |
| `DATABASE_URL` | `ci.yml` (`e2e`) | Conexión *pooled* de Neon, **rama `test`**. |
| `DATABASE_URL_DIRECT` | `ci.yml` (`e2e`) | Conexión directa de Neon, **rama `test`**, para `db:reset`. |
| `JWT_SECRET` | `ci.yml` (`e2e`) | Al menos 32 caracteres aleatorios (`openssl rand -base64 48`). |
| `SNYK_TOKEN` | `snyk.yml` | Token de la cuenta de Snyk. |

`GITHUB_TOKEN` lo aporta GitHub automáticamente; basta con que el repositorio permita a los flujos escribir paquetes. Nunca se configuran aquí las URL de las ramas `main` o `dev` de Neon: `db:reset` borra la base, y el CI solo debe apuntar a `test`.

### Protección de la rama `main`

`main` debe exigir, antes de fusionar, que pasen los tres trabajos: `quality` y `e2e` (de `ci.yml`) y `dependencies` (de `snyk.yml`), como pide `STYLE_GUIDE.md` (*Settings → Branches → Require status checks to pass*). Si falta o caduca `SNYK_TOKEN`, `dependencies` falla y bloquea las fusiones: es intencionado.

### Riesgos aceptados

- `npm audit` se ejecuta solo sobre dependencias de producción (`--omit=dev`). Las vulnerabilidades de herramientas de desarrollo que dependen de Tailwind 3 no llegan a la imagen final y se aceptan como riesgo. Revisar al migrar a Tailwind 4.
- Las herramientas de compilación del cliente (Vite, `vite-plugin-pwa` y Workbox) son `devDependencies`: solo se ejecutan en `npm run build` y no forman parte de la imagen. Por eso ni Snyk ni `npm audit --omit=dev` analizan sus dependencias, como `picomatch`, que no tiene versión corregida.
- En los *pull requests* desde forks, GitHub no expone los secretos: `e2e` y Snyk no pueden ejecutarse allí.

## Despliegue

La imagen se construye con `server/Dockerfile` (contexto: raíz del repositorio). Express sirve el cliente compilado y la API desde el mismo origen (ADR-019). Al arrancar, el contenedor aplica las migraciones pendientes (`node dist/db/migrate.js`, idempotente) y después inicia el servidor en `PORT`. Prueba local de la imagen:

```bash
docker compose up --build   # http://localhost:3000
curl http://localhost:3000/api/health   # {"status":"ok"}
```

### Render

El servicio está descrito en `render.yaml` (Blueprint): servicio web gratuito con Docker, región Frankfurt, `healthCheckPath: /api/health` y despliegue automático en cada fusión a `main`.

1. En Neon, copia de la rama de **producción** (nunca `dev` ni `test`) la conexión *pooled* y la directa. Termina las dos con `?sslmode=verify-full` (con `require`, `pg` muestra un aviso de seguridad al arrancar).
2. Genera un `JWT_SECRET` nuevo: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.
3. En Render: **New → Blueprint**, elige este repositorio y rellena los secretos que pide:

   | Variable | Contenido |
   | --- | --- |
   | `DATABASE_URL` | Conexión *pooled* de Neon, rama de producción. |
   | `DATABASE_URL_DIRECT` | Conexión directa de Neon, rama de producción (migraciones). |
   | `JWT_SECRET` | El del paso 2. |
   | `SENTRY_DSN` | Opcional. DSN de Sentry (región UE). |
   | `VITE_SENTRY_DSN` | Opcional. Se lee al compilar la imagen (`ARG` del Dockerfile). |

   No definas `CLIENT_ORIGIN` (se usa `RENDER_EXTERNAL_URL`) ni `ALLOW_DB_RESET`.
4. En los logs del primer despliegue deben aparecer `Migraciones aplicadas: …` y `CuidaT API escuchando en el puerto …`.
5. Comprueba `https://<servicio>.onrender.com/api/health` y actualiza la URL al principio de este README.

`GET /api/health` responde 200 sin tocar la base de datos ni contar para el límite de peticiones.

### Mantener despierto el servicio (opcional)

`.github/workflows/keep-warm.yml` pide `/api/health` cada 10 minutos para que la demo no se duerma. Está desactivado por defecto: solo actúa si existe la variable de repositorio `PUBLIC_URL` (*Settings → Secrets and variables → Actions → Variables*) con la URL pública. Para desactivarlo, borra la variable. Ten en cuenta que un servicio encendido todo el mes consume casi todas las horas gratuitas mensuales de Render, y que GitHub pausa los flujos programados tras 60 días sin actividad en el repositorio.
