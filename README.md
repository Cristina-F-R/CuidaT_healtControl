# Cuidat

Aplicación para registrar el cuidado de perfiles (mascotas, niños, adultos) y correlacionar síntomas y desencadenantes. Monorepo con `shared`, `client` (Vue) y `server` (Express + Neon PostgreSQL). Los detalles de diseño están en `TECH_SPEC.md` y `STYLE_GUIDE.md`.

**Demo pública:** _pendiente de la Fase 5 (Render). Sustituir por la URL cuando exista._

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

La imagen se construye con `server/Dockerfile` (contexto: raíz del repositorio). El despliegue en Render se describe en la Fase 5. Prueba local de la imagen:

```bash
docker compose up --build   # http://localhost:3000
```
