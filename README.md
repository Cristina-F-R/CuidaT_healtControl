# CuidaT

CuidaT es una aplicación web para llevar en un calendario los síntomas, los posibles desencadenantes (*triggers*, como un alimento) y la medicación de una mascota, un niño o un adulto. A partir de esos registros, detecta coincidencias que se repiten, por ejemplo «Vómito» en las 48 horas siguientes a comer «Pescado». También genera informes en PDF para llevar a una visita médica o al veterinario.

Proyecto final del **Máster en Desarrollo en IA**.

> [!WARNING]
> **Privacidad:** es una demo académica. No introduzcas datos de salud reales ni contraseñas que uses en otros sitios. Los datos de las cuentas se guardan en Neon (región UE) y pueden borrarse sin aviso.

## Índice

1. [Ver la demo desplegada](#1-ver-la-demo-desplegada)
2. [Qué hace la aplicación](#2-qué-hace-la-aplicación)
3. [Arquitectura y tecnologías](#3-arquitectura-y-tecnologías)
4. [Instalar y ejecutar en local](#4-instalar-y-ejecutar-en-local)
5. [Tests y comprobaciones de calidad](#5-tests-y-comprobaciones-de-calidad)
6. [Integración continua](#6-integración-continua)
7. [Despliegue](#7-despliegue)
8. [Documentación del proyecto](#8-documentación-del-proyecto)

---

## 1. Ver la demo desplegada

**URL de la demo:** <https://cuidat.onrender.com/>

> [!NOTE]
> La demo usa el plan gratuito de Render: el servicio se duerme tras unos 15 minutos sin tráfico y **la primera carga puede tardar hasta un minuto**. Después responde con normalidad.

### Entrar con el usuario de prueba

Hay un usuario de prueba para la corrección del profesorado del Máster en Desarrollo en IA:

| Usuario | Contraseña |
| --- | --- |
| `profesorado@cuidat.test` | `MasterIA-Correccion-2026` |

No hace falta escribirlos:

1. Abre la URL de la demo.
2. Pulsa **Iniciar sesión** (arriba a la derecha).
3. En el recuadro *«Usuario de prueba para corrección profesorado Master en Desarrollo en IA»*, pulsa **Acceso rápido profesorado**.

Si la cuenta aún no existe en la base de datos, el botón la crea la primera vez y entra. La cuenta empieza con un calendario de ejemplo («Moby», una mascota) y seis ítems: tres síntomas, dos *triggers* y una medicación. Es una cuenta compartida: no guardes en ella nada que no quieras que vean otros.

### Otras formas de probarla

- **Modo invitado:** al abrir la página ya puedes usar la app sin cuenta («Modo Local» en la cabecera). Los datos se guardan solo en ese navegador, con límites: un calendario, solo el mes actual y seis ítems.
- **Cuenta propia:** **Iniciar sesión → Crear cuenta**, con cualquier email y una contraseña de al menos 12 caracteres. Al registrarte puedes migrar a la cuenta lo que hayas hecho como invitado.

### Visita guiada (unos 10 minutos)

1. **Registrar un evento.** En el panel de la izquierda (el *dock*), pulsa un ítem, por ejemplo «Pescado», y después un día del calendario. Elige la hora y guarda. En un ordenador también puedes arrastrar el ítem hasta el día.
2. **Provocar un patrón.** Registra «Pescado» un día y, unas horas después (ese día o el siguiente), «Vómito». Repítelo en tres días distintos. El síntoma debe ser posterior al *trigger* y caer dentro de la ventana del calendario (48 horas por defecto). El panel de la derecha mostrará **«Vigilar posible patrón»** (de 3 a 6 coincidencias) y, a partir de 7, **«Patrón detectado»**.
3. **Ver resúmenes.** Pulsa **Ver resúmenes**: puedes cambiar el periodo y filtrar qué síntomas y *triggers* entran en el análisis. Desde ahí, **Guardar como informe**.
4. **Informes guardados.** En el menú de la cuenta (tu email, arriba a la derecha), abre **Informes guardados**: puedes verlo en pantalla o pulsar **Descargar PDF**.
5. **Modo consulta.** Activa el interruptor **Modo consulta**, a la derecha de los filtros. Es una vista de solo lectura pensada para enseñarla en una visita médica: desaparece el *dock* y se marcan en el calendario los días con la posible causa de un patrón.
6. **Varios meses y calendarios.** Cambia la densidad a `2M` o `3M` para ver meses apilados, pulsa el nombre del mes para saltar a otro, y crea otro calendario desde el menú central de la cabecera (**Nuevo calendario**).
7. **Catálogo.** En **Gestionar ítems** puedes crear, editar, archivar o eliminar ítems. Al editar un ítem, el historial se conserva.
8. **Sin conexión.** Con la sesión iniciada, activa *Offline* en las DevTools del navegador (pestaña *Network*) y registra un evento. La cabecera muestra «Pendiente (1)»; al volver la conexión se sincroniza solo.
9. **Tus datos (RGPD).** En el menú de la cuenta: **Descargar mis datos (JSON)** y **Eliminar cuenta y datos**. Mejor no elimines la cuenta de prueba: el botón de acceso rápido la volvería a crear, pero se perderían los registros y los informes guardados.

---

## 2. Qué hace la aplicación

- **Calendarios por persona o mascota**, cada uno con su color, su tipo y su ventana de correlación (2, 6, 12, 24, 36 o 48 horas).
- **Registro rápido** de síntomas, *triggers* y medicación, con hora, intensidad (leve, moderada, grave), duración y notas, según cómo esté definido cada ítem. No se pueden registrar eventos en el futuro.
- **Detección de patrones determinista**: cada síntoma se compara con los *triggers* y medicaciones anteriores dentro de la ventana del calendario. No hay IA ni estadística opaca: son reglas fijas y explicables, en `shared/src/correlation.ts`.
- **Resúmenes e informes**: análisis por periodo con filtros, y hasta 5 informes guardados por usuario, que se ven en pantalla o se descargan en PDF (el PDF se genera en el navegador).
- **Modo consulta**: una vista de solo lectura para mostrar en una visita médica.
- **Modo invitado sin registro** y migración de esos datos al crear la cuenta, siempre con consentimiento explícito.
- **Funciona sin conexión** (PWA): los registros se guardan en una cola local y se sincronizan al volver la conexión.
- **Privacidad y seguridad**: sesión en cookie `httpOnly`, protección CSRF, límite de peticiones, contraseñas con bcrypt, aislamiento de datos entre usuarios, exportación y borrado de datos (RGPD, artículos 17 y 20) y Sentry sin datos de salud.
- **Accesible**: se puede usar entero con teclado, tiene etiquetas ARIA y los colores cumplen el contraste WCAG AA. La información nunca depende solo del color.

---

## 3. Arquitectura y tecnologías

Monorepo con *npm workspaces* y arquitectura limpia (las reglas de negocio no dependen de Vue ni de Express):

| Paquete | Contenido |
| --- | --- |
| `shared/` | Núcleo de dominio común: tipos, esquemas Zod, motor de correlaciones, reglas del catálogo e informes. Lo usan el cliente y el servidor. |
| `client/` | Vue 3 + Vite + Pinia + Tailwind CSS. Capas `application` (stores y composables), `infrastructure` (API, almacenamiento local, cola de sincronización, PDF) y `presentation` (componentes). |
| `server/` | Express + TypeScript + PostgreSQL (`pg`). Capas `domain`, `application` (casos de uso), `infrastructure` (repositorios, bcrypt, JWT) e `interfaces/http` (rutas y *middleware*). Migraciones SQL en `server/src/db/migrations`. |
| `tests/e2e/` | Pruebas de extremo a extremo con Playwright. |

- **Base de datos:** PostgreSQL en Neon (UE), con ramas separadas para producción, desarrollo y tests.
- **Producción:** una sola imagen Docker en la que Express sirve el cliente compilado y la API desde el mismo origen, desplegada en Render.
- **Calidad:** Vitest, Playwright, ESLint, Husky, lint-staged, commitlint, GitHub Actions y Snyk.

El diseño completo, con las decisiones de arquitectura (ADR), está en [`TECH_SPEC.md`](TECH_SPEC.md).

---

## 4. Instalar y ejecutar en local

### Requisitos

- [Node.js 22](https://nodejs.org/) (incluye npm) y [Git].
- Para la aplicación completa, una base de datos PostgreSQL 16 o 17: [Docker Desktop](https://www.docker.com/products/docker-desktop/) **o** una cuenta gratuita de [Neon](https://neon.tech).

[Git]: https://git-scm.com/

### Clonar e instalar

```bash
git clone https://github.com/Cristina-F-R/CuidaT_healtControl.git
cd CuidaT_healtControl
npm ci
```

Todos los comandos se ejecutan desde la raíz del repositorio. En Windows funcionan igual en PowerShell y en Git Bash.

### Opción A: solo el cliente, en modo invitado (sin base de datos)

```bash
npm run dev:client
```

Abre http://localhost:5173. Sin servidor la app entra en modo invitado («Modo Local»), y se puede probar el calendario, los patrones y el modo consulta. No funcionan el inicio de sesión, el registro ni los informes guardados.

### Opción B: la aplicación completa

**1. Prepara la base de datos.** Elige una de estas dos opciones:

- **PostgreSQL local con Docker** (lo más rápido):

  ```bash
  docker run -d --name cuidat-db -e POSTGRES_PASSWORD=cuidat -e POSTGRES_DB=cuidat -p 5432:5432 postgres:17
  ```

  Las dos cadenas de conexión son la misma: `postgresql://postgres:cuidat@localhost:5432/cuidat`

- **Neon** (como en producción): crea un proyecto gratuito en la región de Frankfurt y copia desde **Connect** dos cadenas: la *pooled* (su host contiene `-pooler`) y la directa. Termina las dos con `?sslmode=verify-full`.

**2. Configura el servidor.** Copia el archivo de ejemplo:

```bash
cp server/.env.example server/.env
```

y edita en `server/.env` estas tres líneas (el resto puede quedarse como está):

```dotenv
DATABASE_URL=postgresql://postgres:cuidat@localhost:5432/cuidat
DATABASE_URL_DIRECT=postgresql://postgres:cuidat@localhost:5432/cuidat
JWT_SECRET=<al menos 32 caracteres aleatorios>
```

Para generar `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

`server/.env` está en `.gitignore`: no se sube nunca al repositorio.

**3. Crea las tablas y arranca:**

```bash
npm run db:migrate     # crea el esquema; se puede repetir sin riesgo
npm run dev:server     # API en http://localhost:3000 (déjalo abierto)
npm run dev:client     # en otra terminal: app en http://localhost:5173
```

**4. Entra** en http://localhost:5173 con **Iniciar sesión → Acceso rápido profesorado**. En una base nueva, el botón crea la cuenta de prueba la primera vez.

Al terminar, puedes borrar la base local con `docker rm -f cuidat-db`.

### Opción C: la imagen de producción con Docker

Con `server/.env` configurado como en la opción B:

```bash
docker compose up --build    # http://localhost:3000
```

Es la misma imagen que se despliega en Render: Express sirve la app y la API en el puerto 3000, y aplica las migraciones al arrancar. Si usas el PostgreSQL local de la opción B, cambia `localhost` por `host.docker.internal` en las dos cadenas, porque dentro del contenedor `localhost` es el propio contenedor.

---

## 5. Tests y comprobaciones de calidad

```bash
npm run typecheck      # TypeScript en los tres paquetes y en los E2E
npm run lint           # ESLint, sin avisos permitidos
npm run test:unit      # Vitest: cliente, servidor y shared
npm run test:coverage  # lo mismo, con informe de cobertura en coverage/
```

Los tests unitarios y de integración **no necesitan base de datos**: los del servidor levantan un PostgreSQL en memoria (PGlite) y aplican las migraciones reales.

Las pruebas de extremo a extremo (`npm run test:e2e`, Playwright) sí necesitan una base de datos que se pueda borrar entera. Leen `server/.env.test`, que debe apuntar a la rama `test` de Neon (nunca a la de producción). En el CI se ejecutan en cada *pull request*.

Antes de cada *commit*, Husky ejecuta ESLint sobre los archivos modificados, `typecheck` y los tests unitarios. commitlint exige mensajes con el formato *Conventional Commits*.

---

## 6. Integración continua

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
| `JWT_SECRET` | `ci.yml` (`e2e`) | Al menos 32 caracteres aleatorios. |
| `SNYK_TOKEN` | `snyk.yml` | Token de la cuenta de Snyk. |

`GITHUB_TOKEN` lo aporta GitHub automáticamente; basta con que el repositorio permita a los flujos escribir paquetes. Nunca se configuran aquí las URL de las ramas de producción o `dev` de Neon: `db:reset` borra la base, y el CI solo debe apuntar a `test`.

### Protección de la rama `main`

`main` debe exigir, antes de fusionar, que pasen los tres trabajos: `quality` y `e2e` (de `ci.yml`) y `dependencies` (de `snyk.yml`), como pide [`style_guide.md`](style_guide.md) (*Settings → Branches → Require status checks to pass*). Si falta o caduca `SNYK_TOKEN`, `dependencies` falla y bloquea las fusiones: es intencionado.

### Riesgos aceptados

- `npm audit` se ejecuta solo sobre dependencias de producción (`--omit=dev`). Las vulnerabilidades de herramientas de desarrollo que dependen de Tailwind 3 no llegan a la imagen final y se aceptan como riesgo. Revisar al migrar a Tailwind 4.
- Las herramientas de compilación del cliente (Vite, `vite-plugin-pwa` y Workbox) son `devDependencies`: solo se ejecutan en `npm run build` y no forman parte de la imagen. Por eso ni Snyk ni `npm audit --omit=dev` analizan sus dependencias, como `picomatch`, que no tiene versión corregida.
- En los *pull requests* desde forks, GitHub no expone los secretos: `e2e` y Snyk no pueden ejecutarse allí.

---

## 7. Despliegue

La imagen se construye con `server/Dockerfile` (contexto: raíz del repositorio). Express sirve el cliente compilado y la API desde el mismo origen (ADR-019). Al arrancar, el contenedor aplica las migraciones pendientes (`node dist/db/migrate.js`, idempotente) y después inicia el servidor en `PORT`. `GET /api/health` responde 200 sin tocar la base de datos ni contar para el límite de peticiones.

### Render

El servicio está descrito en [`render.yaml`](render.yaml) (Blueprint): servicio web gratuito con Docker, región Frankfurt, `healthCheckPath: /api/health` y despliegue automático en cada fusión a `main`.

1. En Neon, copia de la rama de **producción** (nunca `dev` ni `test`) la conexión *pooled* y la directa. Termina las dos con `?sslmode=verify-full` (con `require`, `pg` muestra un aviso de seguridad al arrancar).
2. Genera un `JWT_SECRET` nuevo, distinto del de desarrollo (ver el comando en la sección 4).
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
5. Comprueba `https://<servicio>.onrender.com/api/health` y pon la URL en la sección 1 de este README.

### Mantener despierto el servicio (opcional)

`.github/workflows/keep-warm.yml` pide `/api/health` cada 10 minutos para que la demo no se duerma. Está desactivado por defecto: solo actúa si existe la variable de repositorio `PUBLIC_URL` (*Settings → Secrets and variables → Actions → Variables*) con la URL pública. Para desactivarlo, borra la variable. Ten en cuenta que un servicio encendido todo el mes consume casi todas las horas gratuitas mensuales de Render, y que GitHub pausa los flujos programados tras 60 días sin actividad en el repositorio.

---

## 8. Documentación del proyecto

| Documento | Contenido |
| --- | --- |
| [`TECH_SPEC.md`](TECH_SPEC.md) | Especificación técnica: casos de uso, diseño, esquema de la base de datos, algoritmo de correlación, seguridad y decisiones de arquitectura (ADR). |
| [`style_guide.md`](style_guide.md) | Normas de código, componentes, accesibilidad y calidad. |
| [`docs/Nova_guia_prompts.md`](docs/Nova_guia_prompts.md) | Guía de desarrollo por fases con los *prompts* usados para construir el proyecto con IA. |
| [`docs/neon/`](docs/neon/) | Scripts SQL de la puesta en marcha inicial en Neon. |
