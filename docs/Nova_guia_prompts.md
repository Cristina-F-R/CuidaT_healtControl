# GUÍA MAESTRA DE DESARROLLO CUIDAT (CLEAN RESET)

Fuente: `Nova guía prompts.pdf`

> **Documentos de contexto.** `TECH_SPEC.md` y `STYLE_GUIDE.md` están en `docs/` (como `tech_spech.md` y `style_guide.md` hasta que se renombren). Al crear el proyecto se copian a la raíz con los nombres `TECH_SPEC.md` y `STYLE_GUIDE.md`; los prompts los referencian así. La versión compacta de la guía de estilos está en `.claude/style_guide.compact.md`.

## Funcionalidades objetivo

- Sistema de inicio de sesión profesional con base de datos y cifrado (Fase 3).
- Creación de un catálogo propio por usuario y calendario (Fase 2).
- Configuración del seguimiento de ítems mediante intensidad de 1 a 3 o duración en minutos (Fases 2 y 3).
- Altura de calendario adaptable, sin tarjetas ocultas (Fase 4).
- Modo invitado con calendario del mes actual usable al abrir la app, un único perfil, sin navegación entre meses y con un máximo de 3 síntomas y 3 triggers/medicación (el catálogo base de 6 ítems ya ocupa el límite). Al intentar superarlo aparece «Opción no disponible sin iniciar sesión.» con la acción «Crear cuenta» (Fases 2 y 4).
- Bloqueo de fechas y meses futuros para todos los usuarios (Fase 1, y validación en servidor en la Fase 3.2).
- Alta de usuario con una opción explícita para migrar o descartar los datos locales; la importación se hace en la misma transacción que el registro, sin usuarios anónimos (Fases 3 y 4).
- Gestión de calendarios, incluido el nombre y el avatar (Fase 4).
- Ventana temporal de correlación configurable por calendario: 2, 6, 12, 24, 36 o 48 horas (Fases 2 y 4).
- Resúmenes temporales paramétricos y filtros cruzados (Fase 4).
- Clasificación de coincidencias:
  - **Vigilar posible patrón:** entre 3 y 6 ocurrencias.
  - **Patrón detectado:** 7 o más ocurrencias.
- Modo de consulta de solo lectura para visitas médicas (Fase 2).
- Ciclo de vida del catálogo: edición con versionado cuando cambia la forma de los datos, archivado reversible y eliminación definitiva con aviso de cascada (Fases 2 y 4).
- Campo de notas de hasta 300 caracteres para todos los eventos (Fases 1 y 2).
- Hora concreta en cada evento, con atajos por franja del día (Fase 2).
- Filtros para visualizar síntomas, desencadenantes, coincidencias o todos los elementos (Fases 1 y 2).
- Navegador rápido de meses y años, **Quick Jump Navigator** (Fase 4).
- Vista multimes apilada, con selección simultánea de uno a tres meses (Fase 4).
- Espacio de trabajo responsivo de tres columnas (Fase 1).
- Colocación accesible de eventos: seleccionar y colocar para todos, arrastrar y soltar (HTML5 nativo) solo con puntero fino (Fase 1).
- Despliegue en una sola imagen Docker sobre Render, con la base de datos en Neon (Fase 5).
- Sesión mediante cookie `httpOnly` y observabilidad sin datos de salud (Fases 1 y 3).
- Edición directa al pulsar una tarjeta del calendario (Fase 2).
- Resumen cronológico al pulsar el espacio vacío de un día (Fase 2).
- Funcionamiento sin conexión para eventos, con cola de sincronización (Fase 3.2).

Esta guía define el flujo de desarrollo para reconstruir CuidaT con una arquitectura limpia. Los módulos de inteligencia artificial y PDF quedan temporalmente fuera del alcance, con el fin de priorizar la calidad del TFM, la experiencia de usuario clínica y la privacidad conforme al RGPD.

## Dependencias

### Frontend

| Dependencia | Tipo | Propósito principal |
|---|---|---|
| `vue`, `vite` | Core | Framework reactivo y empaquetador del cliente. |
| `vue-tsc` | Desarrollo | Comprobación de tipos de los `.vue` (viene con la plantilla `vue-ts`). |
| `pinia` | Producción | Gestión del estado global: perfiles, registros, catálogo, autenticación y sincronización. |
| `tailwindcss@3`, `postcss`, `autoprefixer` | Desarrollo | Utilidades CSS (Tailwind 3.4, configuración en `tailwind.config.js`). |
| `@fontsource-variable/nunito-sans` | Producción | Fuente Nunito Sans alojada en local (sin peticiones a Google). |
| `dayjs` | Producción | Manipulación, formato y cálculo de fechas. |
| `@lucide/vue` | Producción | Iconos vectoriales ligeros (sustituye a `lucide-vue-next`, obsoleto). |
| `dompurify`, `@types/dompurify` | Producción / Desarrollo | Sanitización de textos para mitigar ataques XSS. |
| `vite-plugin-pwa` | Producción | Manifiesto y *service workers* para la PWA. |
| `localforage` | Producción | Almacenamiento asíncrono en IndexedDB y cola de sincronización sin conexión. |
| `@sentry/vue` | Producción | Observabilidad y monitorización de errores del cliente. |

### Backend

| Dependencia | Tipo | Propósito principal |
|---|---|---|
| `express`, `@types/express` | Producción / Desarrollo | API REST y enrutamiento HTTP. |
| `pg`, `@types/pg` | Producción / Desarrollo | Cliente de PostgreSQL (Neon). |
| `zod` | Producción | Validación estricta de esquemas y cargas de entrada. |
| `bcrypt`, `@types/bcrypt` | Producción / Desarrollo | Hash seguro de contraseñas con *salt*. |
| `jsonwebtoken`, `@types/jsonwebtoken` | Producción / Desarrollo | Generación y validación de JWT (viaja en cookie `httpOnly`). |
| `helmet` | Producción | Cabeceras HTTP de seguridad. |
| `cors`, `@types/cors` | Producción / Desarrollo | Configuración de intercambio de recursos entre orígenes (con credenciales). |
| `cookie-parser`, `@types/cookie-parser` | Producción / Desarrollo | Lectura de la cookie de sesión `httpOnly`. |
| `dotenv` | Producción | Carga de variables de entorno. |
| `tsx`, `typescript`, `@types/node` | Desarrollo | Ejecución y compilación de TypeScript en Node.js. |
| `express-rate-limit` | Producción | Limitación de solicitudes para mitigar fuerza bruta y abuso. |
| `@sentry/node`, `@sentry/profiling-node` | Producción | Trazabilidad de errores y rendimiento del servidor. |
| `supertest`, `@types/supertest` | Desarrollo | Pruebas de integración de la API. |

### Pruebas y calidad (raíz)

| Dependencia | Tipo | Propósito principal |
|---|---|---|
| `vitest`, `@vitest/coverage-v8` | Desarrollo | Pruebas unitarias y cobertura (100 % en `correlation.ts`). |
| `jsdom`, `@vue/test-utils` | Desarrollo | Entorno y utilidades para pruebas de componentes y stores. |
| `@playwright/test` | Desarrollo | Pruebas de extremo a extremo (incluye el *runner*). |
| `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-vue`, `globals` | Desarrollo | Linter que hace cumplir `STYLE_GUIDE.md`. |
| `husky`, `lint-staged` | Desarrollo | *Hooks* de Git y linter solo sobre archivos *staged*. |
| `@commitlint/cli`, `@commitlint/config-conventional` | Desarrollo | Valida Conventional Commits. |

## Instalación inicial

### 1. Inicialización del monorepo

Carpetas en la raíz: `client`, `server` y `shared`.

```bash
npm init -y
npm pkg set name="cuidat" type="module"
npm pkg set private=true --json   # sin --json se guardaría como texto "true"
npm pkg set workspaces.0="shared" workspaces.1="client" workspaces.2="server"

mkdir -p shared/src server/src
(cd shared && npm init -y && npm pkg set name="@cuidat/shared" type="module" \
  main="dist/index.js" types="dist/index.d.ts" exports.".".types="./dist/index.d.ts" exports.".".default="./dist/index.js" \
  scripts.build="tsc -b" scripts.typecheck="tsc -b")
(cd server && npm init -y && npm pkg set name="@cuidat/server" type="module" \
  scripts.dev="tsx watch src/main.ts" scripts.build="tsc -b" scripts.typecheck="tsc --noEmit" \
  scripts.db:migrate="tsx src/db/migrate.ts" scripts.db:reset="tsx src/db/reset.ts")

npm create vite@latest client -- --template vue-ts --no-interactive
npm pkg set name="@cuidat/client" scripts.typecheck="vue-tsc -b" -w client

# Scripts de la raíz
npm pkg set scripts.dev:client="npm run dev -w client"
npm pkg set scripts.dev:server="npm run dev -w server"
npm pkg set scripts.build="npm run build -w shared && npm run build -w client && npm run build -w server"
npm pkg set scripts.typecheck="npm run typecheck -w shared && npm run typecheck -w client && npm run typecheck -w server"
npm pkg set scripts.lint="eslint . --max-warnings 0"
npm pkg set scripts.test:unit="vitest run"
npm pkg set scripts.test:coverage="vitest run --coverage"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.db:migrate="npm run db:migrate -w server"
npm pkg set scripts.db:reset="npm run db:reset -w server"
```

`shared` necesita su `tsconfig.json` (`composite: true`, `declaration: true`, `outDir: dist`, `rootDir: src`, `strict: true`, `module`/`moduleResolution: NodeNext`) y un `src/index.ts` que reexporte todo. `server` necesita el suyo con `references` a `../shared`, y el `tsconfig` del cliente también referencia a `shared`. El agente los crea en la Fase 1. En `client/vite.config.ts`, un alias apunta `@cuidat/shared` a `../shared/src/index.ts` para que Vite empaquete el código fuente sin recompilar `shared` en desarrollo; los tipos siguen viniendo de su `dist` (referencia de proyecto).

### 2. Dependencias del frontend

```bash
npm install @cuidat/shared -w client -w server
npm install pinia dayjs @lucide/vue dompurify vite-plugin-pwa localforage @sentry/vue @fontsource-variable/nunito-sans -w client
npm install -D tailwindcss@3 postcss autoprefixer @types/dompurify -w client

cd client && npx tailwindcss init -p && cd ..
```

### 3. Dependencias del backend

```bash
npm install express cors cookie-parser helmet dotenv zod pg bcrypt jsonwebtoken express-rate-limit @sentry/node @sentry/profiling-node -w server
npm install -D typescript@~6.0.3 @types/express @types/cors @types/cookie-parser @types/node @types/pg @types/bcrypt @types/jsonwebtoken tsx supertest @types/supertest -w server
```

### 4. Herramientas de calidad

```bash
npm install -D typescript@~6.0.3 vitest @vitest/coverage-v8 jsdom @vue/test-utils @playwright/test \
  eslint @eslint/js typescript-eslint eslint-plugin-vue globals \
  husky lint-staged @commitlint/cli @commitlint/config-conventional
# En redes con inspección TLS, Node necesita los certificados del sistema.
# --with-deps instala librerías del sistema y requiere sudo; omítelo si ya están.
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt npx playwright install chromium
npx husky init
```

`husky init` crea un `pre-commit` con `npm test`, que no existe en este proyecto. Sustitúyelo por la puerta de calidad real y añade el hook de commits:

```bash
printf 'npx lint-staged\nnpm run typecheck\nnpm run test:unit\n' > .husky/pre-commit
printf 'npx --no -- commitlint --edit "$1"\n' > .husky/commit-msg
```

`.lintstagedrc.json`:

```json
{ "*.{ts,vue}": "eslint --max-warnings 0" }
```

`commitlint.config.js`:

```js
export default { extends: ['@commitlint/config-conventional'] };
```

## 0. Preparación e inicialización

### 0.1. Entorno

Usa Node.js 22 LTS o posterior (Vite exige 20.19+). En WSL: `nvm install 22`.

> [!NOTE]
> **TypeScript se fija en `~6.0` en todos los paquetes.** TypeScript 7 (la versión nativa) ya es la última en npm, pero `typescript-eslint` solo admite hasta la 6.0 y `vue-tsc` depende de su API. Instalar `typescript` sin versión rompe la resolución de dependencias.

Crea el archivo `.gitignore` en la raíz:

```gitignore
node_modules
dist
coverage
playwright-report
test-results
*.tsbuildinfo
.env
.env.*
!.env.example
```

Crea también `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### 0.2. ESLint (hace cumplir `STYLE_GUIDE.md`)

`eslint.config.js` en la raíz:

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default defineConfig(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'client/public/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'vue/no-v-html': 'error',
    },
  },
  {
    files: ['shared/src/**/*.ts', 'server/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  {
    files: ['server/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "ThrowStatement > NewExpression[callee.name='Error']",
        message: 'Use an AppError subclass (ValidationError, NotFoundError, UnauthorizedError).',
      }],
    },
  },
  {
    files: ['client/src/**/*.vue'],
    rules: {
      'max-lines': ['error', { max: 180, skipBlankLines: true, skipComments: true }],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
    },
  },
);
```

### 0.3. Neon y variables de entorno

1. La base de datos ya existente en Neon es la rama principal y se usa directamente. Su contenido actual se borra **una vez** en la sección 3.1 (aún no hay usuarios reales).
2. Copia de Neon las dos cadenas de conexión: la *pooled* (host con `-pooler`) y la directa.
3. Crea `server/.env.example` y `client/.env.example` como en `TECH_SPEC.md`, sección 4, y copia el primero a `server/.env`. `JWT_SECRET` debe tener al menos 32 caracteres aleatorios (`openssl rand -base64 48`).
4. Cuando el esquema esté creado y antes de tener usuarios reales, crea desde la rama principal las ramas `dev` (desarrollo) y `test` (E2E y CI). Heredan el esquema y se pueden reiniciar sin riesgo. A partir de ahí, `server/.env` apunta a `dev`.

`DATABASE_URL` (pooled) lo usa la API. `DATABASE_URL_DIRECT` lo usan `db:migrate` y `db:reset`. No hay PostgreSQL local, así que `sslmode=require` funciona siempre.

### 0.4. Prompt 0: inicialización del agente

Abre un nuevo chat en el IDE, por ejemplo en Cursor, Cline o Roo, y utiliza este prompt:

> **Prompt 0**
>
> Actúa como arquitecto de software sénior y desarrollador *full stack* experto en Vue 3, Node.js y PostgreSQL. Tu contexto principal son los archivos `TECH_SPEC.md` y `STYLE_GUIDE.md` de la raíz.
>
> Antes de escribir código, analiza esos archivos, el modelo de datos compuesto, la arquitectura por capas de la sección 3.1 de `TECH_SPEC.md` (Clean Architecture) y la política Zero-any de TypeScript. Confirma que entiendes:
>
> - Las restricciones técnicas.
> - La lógica de umbrales de patrones: «Vigilar posible patrón» frente a «Patrón detectado», y que se agrupa por linaje de ítem (`root_id`).
> - La configuración paramétrica de los ítems (intensidad frente a duración) y el ciclo de vida del catálogo: qué ediciones crean versión, cuáles son retroactivas, qué es archivar y qué es eliminar.
> - El modelo de hora de los eventos y el bloqueo de fechas futuras para todos los usuarios.
> - La diferencia entre el modo invitado (mes actual, un perfil, 3 síntomas + 3 triggers/medicación, sin navegación, sin usuarios anónimos) y el modo registrado, y que el registro con migración es una sola operación.
>
> No generes código todavía. Devuelve primero un resumen ejecutivo.

## Fase 1: scaffolding y UI básica

**Objetivo:** crear el monorepo y maquetar el panel interactivo sin persistencia real.

### 1.1. Instalación

La instalación base se corresponde con los apartados de inicialización del monorepo, dependencias del frontend y herramientas de calidad descritos anteriormente.

### 1.2. Prompt de la Fase 1

> **Prompt 1**
>
> Inicia la Fase 1 siguiendo `TECH_SPEC.md` y `STYLE_GUIDE.md`:
>
> 1. Configura la estructura del monorepo (`shared`, `client`, `server`) con sus `tsconfig` y referencias, y las carpetas por capas de la sección 3.1. En `shared/src/types.ts`, define interfaces TypeScript estrictas e incluye categoría (`symptom`, `trigger`, `medication`), estado del ítem, `rootId`, campos de duración, intensidad y umbrales de patrón. Reexporta todo desde `shared/src/index.ts`.
> 2. En `client`, configura Tailwind CSS 3.4 en `tailwind.config.js` con los tokens de `TECH_SPEC.md`, sección 2: escala completa `slate` (DEFAULT 600), `peach`, `sky`, `mint`, `tint`, `canvas` y `danger`/`danger-dark`. Define `fontFamily.sans` como Nunito Sans Variable.
> 3. Maqueta un diseño con `SidebarDock`, `CalendarGrid` y `MonthlyInsightsSummary`. Con el breakpoint `lg` (1024 px) se muestran en tres columnas; por debajo, en una sola. El panel derecho debe mostrar dos secciones: «Vigilar posible patrón» y «Patrón detectado».
> 4. Valida con Day.js las fechas futuras para todos los usuarios. Los días posteriores a la fecha actual deben aparecer deshabilitados (`cursor-not-allowed`, `opacity-50`) y conservar un botón de día con `aria-disabled="true"` que muestre el *toast* «No se pueden registrar métricas en fechas futuras.» sin abrir modales ni aceptar elementos arrastrados. El botón de mes siguiente se deshabilita al llegar al mes actual.
> 5. Importa la fuente en local con `@fontsource-variable/nunito-sans` desde `main.ts`. No uses enlaces a Google Fonts.
> 6. Antes de escribir código, explica cómo separarás los dos modos de colocación en `useInteraction.ts`: seleccionar y colocar para todos (los elementos del dock son botones con `aria-pressed`) y arrastrar y soltar con la API HTML5 nativa (`draggable`, `dragstart`, `dragover`, `drop`), sin librerías, solo cuando `matchMedia('(hover: hover) and (pointer: fine)')` coincide.
> 7. Configura `app.config.errorHandler` en `main.ts` y crea un componente sencillo `FallbackError.vue` para evitar pantallas en blanco.
> 8. Durante el arrastre, ilumina los días válidos como zonas de destino. Los días futuros bloqueados no deben reaccionar.
> 9. Estructura cada celda según el ADR-015: contenedor no interactivo, botón de día extendido sobre toda la celda (`after:absolute after:inset-0`) y puntos de evento como botones hermanos con `relative z-10`. Usa elementos semánticos, `aria-label` en botones sin texto, foco atrapado en los modales y `aria-live="polite"` en los *toasts*.
> 10. Inicializa `@sentry/vue` en `main.ts` y vincúlalo con el controlador global de errores. Sin datos de salud: DSN de región UE, `attachErrorHandler: false` (el error se reporta desde el controlador global), `dataCollection` con todo desactivado (Sentry 11 sustituyó `sendDefaultPii` por este objeto), sin Session Replay, `beforeSend` y `beforeBreadcrumb` que eliminen cuerpos de petición, notas, nombres de ítems y *query strings*, y el UUID del usuario como único identificador.
> 11. Comprueba que `npm run typecheck` y `npm run lint` finalizan sin errores.

## Fase 2: motor, estado Pinia y restricciones del modo invitado

**Objetivo:** implementar la lógica de dominio, los umbrales de correlación, la configuración de ítems y el almacenamiento local.

### 2.1. Configuración de pruebas

Crea `vitest.config.ts` en la raíz con tres proyectos (`shared` y `server` en entorno Node, `client` en `jsdom`) y un umbral de cobertura del 100 % para `shared/src/correlation.ts` y `shared/src/catalog.ts`.

### 2.2. Prompt de la Fase 2

> **Prompt 2**
>
> Inicia la Fase 2 de estado reactivo y lógica de dominio:
>
> 1. Crea `detectCorrelations()` en `shared/src/correlation.ts` siguiendo la sección 6 de `TECH_SPEC.md`: orden estable por `(loggedAt, createdAt, id)`, coincidencia con `0 <= deltaHours <= ventana` (el instante idéntico cuenta), agrupación por linaje (`rootItemId`) y categorías «Vigilar posible patrón» (3 a 6) y «Patrón detectado» (7 o más). La ventana en horas se inyecta desde el perfil activo. Obtén un 100 % de cobertura en Vitest.
> 2. Crea `shared/src/catalog.ts` con funciones puras para el ciclo de vida del catálogo (sección 1.9 de la spec): editar `name`/`emoji` en el linaje completo, editar `track_intensity`/`track_duration` creando una nueva versión (`superseded` + nueva fila con el mismo `rootId` y `parentId`), bloquear el cambio de `category`, archivar, restaurar y calcular el impacto de una eliminación definitiva (número de registros). 100 % de cobertura.
> 3. Define interfaces de repositorio (`EventRepository`, `ItemRepository`, `ProfileRepository`) y su implementación local `Local...Repository` sobre `localStorage`, bajo la clave `@cuidat_guest_v1`. Los ids se generan con `crypto.randomUUID()`. Implementa Pinia sobre esas interfaces; al crear un perfil local, permite seleccionar una ventana de correlación de 2, 6, 12, 24, 36 o 48 horas.
> 4. Si `authMode` es `guest`: un perfil, solo el mes actual (flechas de mes, Quick Jump y selector de densidad bloqueados) y un máximo de 3 síntomas y 3 triggers/medicación (`GUEST_MAX_SYMPTOMS`, `GUEST_MAX_TRIGGERS`, en `useGuestLimits.ts`; los archivados siguen contando y los eliminados liberan hueco). Al intentar navegar o superar el límite, muestra el *toast* «Opción no disponible sin iniciar sesión.» con la acción «Crear cuenta» que abre `AuthModal.vue`. Los datos de meses anteriores siguen guardados localmente. El bloqueo de futuro ya es general.
> 5. Crea `shared/src/presets.ts` con `PRESET_ITEMS`: síntomas Vómito, Heces blandas y Malestar / dolor; triggers Pescado y Lácteos; medicación Medicación (sin «Picor»). El perfil de invitado se inicializa con ellos en la primera carga; son ítems normales (editables, archivables y eliminables). Cada ítem pertenece a una categoría. En `EventLogModal.vue`, la hora es obligatoria: por defecto la hora actual si el día es hoy, y si no una franja (Mañana 08:00, Mediodía 13:00, Tarde 18:00, Noche 22:00) con ajuste fino en pasos de 15 minutos. Para hoy, la hora se limita al instante actual. Muestra dinámicamente intensidad (1 a 3) y duración en minutos según el ítem.
> 6. Al pulsar el botón de día de una celda, abre `DaySummaryModal.vue`. En modo normal, permite editar y eliminar. En «Modo Consulta», utiliza solo lectura. Cada registro se muestra con los campos de su propia versión de ítem.
> 7. En la gestión de ítems, incluye un selector visual de emojis, la categoría (bloqueada al editar), `track_intensity` y `track_duration`, el aviso de que los cambios de nombre y emoji son retroactivos, «Archivar» como opción principal y «Eliminar definitivamente» con el número de registros afectados y una casilla de aceptación.
> 8. Antes de guardar en Pinia, aplica `DOMPurify.sanitize()` a las notas (300 caracteres) y a los nombres de ítem.
> 9. Verifica el resultado con `npm run typecheck`, `npm run lint` y `npm run test:coverage`.

## Fase 3: backend, base de datos y autenticación

**Objetivo:** levantar Express sobre Neon, aplicar el nuevo esquema borrando el contenido anterior una sola vez y dejar la autenticación funcionando.

### 3.1. Creación de las tablas en Neon

La base asociada al proyecto en Neon (rama principal) se vacía **una vez** y se recrea con el esquema nuevo. A partir de ahí se trabaja con migraciones que no borran datos. Los scripts están en `docs/neon/` y se han validado en PostgreSQL 16 (Neon usa 16 o 17).

> [!WARNING]
> El paso 1 elimina por completo el esquema `public` (tablas, datos, relaciones, índices) de la base a la que estés conectado. Antes de ejecutarlo, comprueba en Neon que estás en la rama principal y en la base prevista.

En el **SQL Editor** de Neon, ejecuta en este orden (pega el contenido de cada archivo y pulsa **Run**):

| Paso | Archivo | Qué hace |
|---|---|---|
| 1 | `docs/neon/reset.sql` | **Destructivo.** `DROP SCHEMA public CASCADE` y lo recrea vacío. |
| 2 | `docs/neon/001_init.sql` | Crea las cuatro tablas, restricciones e índices (sin `DROP`). |
| 3 | `docs/neon/register_001.sql` | Crea `schema_migrations` y marca `001_init` como aplicada. |
| 4 | `docs/neon/smoke_test.sql` | Prueba de humo: debe terminar con el aviso `SMOKE TEST OK`. No deja datos. |

Qué comprueba la prueba de humo: email en minúsculas y único; `profile_type` no vacío (texto libre), `category`, ventanas, intensidad y duración válidos; que un ítem, su padre, su raíz y un registro nunca referencien otro calendario; una sola versión vigente por ítem; que borrar la raíz elimine todo su linaje y sus registros sin tocar otros ítems; y que borrar el usuario elimine todo en cascada.

Después, copia `docs/neon/001_init.sql` a `server/src/db/migrations/001_init.sql`. Cuando exista el servidor, el mismo flujo está disponible por terminal:

- `npm run db:migrate`: crea `schema_migrations` si no existe y aplica, en orden y en una transacción, las migraciones pendientes. Es idempotente y nunca borra datos.
- `npm run db:reset`: reinicia el esquema y llama a la misma lógica. Solo funciona con `ALLOW_DB_RESET=true` y la bandera `--yes`, e imprime el host y la base antes de actuar. Tras el reinicio de la rama principal, `ALLOW_DB_RESET` vuelve a `false`.

```bash
ALLOW_DB_RESET=true npm run db:reset -- --yes
```

### 3.2. Prompt de la Fase 3

> **Prompt 3**
>
> Inicia la Fase 3 de backend y persistencia con la arquitectura de la sección 3.1 de `TECH_SPEC.md`:
>
> 1. Copia `docs/neon/001_init.sql` a `server/src/db/migrations/` sin modificarlo y crea `migrate.ts` y `reset.ts` como se describe en la sección 3.1 (sin `DROP` en la migración; `reset.ts` con las salvaguardas `ALLOW_DB_RESET` y `--yes`). Usa `DATABASE_URL_DIRECT` para ambos y `DATABASE_URL` para la API.
> 2. Verifica que el esquema aplicado coincide con `TECH_SPEC.md`, sección 5 (restricciones, claves compuestas, índice de versión vigente) y ejecuta `smoke_test.sql` contra la rama `dev`.
> 3. Configura Express con `trust proxy`, Helmet, `cookie-parser` y CORS con credenciales solo para `CLIENT_ORIGIN`. La sesión es un JWT en la cookie `httpOnly` `cuidat_session` (`Secure` en producción, `SameSite=Lax`, caducidad `JWT_EXPIRES_IN`); añade `POST /api/auth/logout` y `GET /api/auth/me`. Las peticiones que modifican estado deben llevar la cabecera `X-CuidaT-Client: web` y un `Origin` igual a `CLIENT_ORIGIN`. Define la jerarquía `AppError` y un middleware que la traduzca a HTTP.
> 4. Implementa `POST /api/auth/register` con un `guestData` opcional. Si llega, crea el usuario y importa el contenido de `@cuidat_guest_v1` en la misma transacción, validándolo con las reglas normales (1 perfil, máximo 3 síntomas y 3 triggers/medicación, sin eventos futuros, textos saneados) y **regenerando todos los ids** en el servidor. No existe endpoint `upgrade` ni usuarios anónimos.
> 5. Crea el endpoint de inicio de sesión y protege las contraseñas mediante bcrypt.
> 6. Configura `express-rate-limit`: `AUTH_RATE_LIMIT_MAX` solicitudes (por defecto 20) cada 15 minutos para `POST /api/auth/register` y `POST /api/auth/login`, y 100 solicitudes por minuto para el resto de la API, incluido `DELETE /api/auth/account`.
> 7. Crea `server/Dockerfile` multietapa (contexto en la raíz del repositorio, porque necesita `shared`): compila `shared`, `client` y `server` y deja una imagen en la que, con `SERVE_CLIENT=true`, Express sirve la API en `/api` y el cliente compilado (`client/dist`, con *fallback* a `index.html`) desde el mismo origen. Añade un `docker-compose.yml` en la raíz que levante esa imagen leyendo `server/.env`. No hay PostgreSQL local: la base es Neon.
> 8. Configura `@sentry/node` con las mismas reglas de privacidad que el cliente (sin datos de salud, sin PII, solo el UUID del usuario).
> 9. Comprueba que Husky ejecuta `lint-staged`, `npm run typecheck` y `npm run test:unit` en `pre-commit` y commitlint en `commit-msg`.
> 10. Muestra el script SQL final antes de escribir los controladores.

## Fase 3.1: sesión y derechos RGPD

**Objetivo:** implementar funciones relacionadas con los artículos 17 y 20 del RGPD.

### Prompt de la Fase 3.1

> **Prompt 3.1**
>
> Implementa la Fase 3.1 de gobernanza RGPD:
>
> 1. Haz que `AppHeader.vue` muestre dinámicamente «Modo Local», «Sincronizado», «Pendiente (N)» o «Sin conexión» (los dos últimos se activan con la Fase 3.2).
> 2. Añade al menú de perfil la opción «Descargar mis datos (JSON)», que generará y descargará un `Blob` en el cliente y revocará la URL.
> 3. Añade «Eliminar cuenta y datos». Abre `DeleteAccountModal.vue` y exige escribir `ELIMINAR` para habilitar el botón de confirmación.
> 4. Crea `DELETE /api/auth/account`. Las restricciones `ON DELETE CASCADE` deberán eliminar los calendarios y registros asociados dentro de una transacción. El servidor borra la cookie de sesión. En el cliente, vacía la cola de sincronización y los stores (`resetState()`), y limpia también `@cuidat_guest_v1`.
> 5. Crea `playwright.config.ts` con `webServer` para cliente y servidor y la rama `test` de Neon.
> 6. Escribe la prueba E2E `tests/e2e/account-deletion.spec.ts` con Playwright. Debe comprobar el registro e inicio de sesión, la apertura del modal, el bloqueo sin la palabra requerida, la confirmación correcta y el regreso de la interfaz a «Modo Local».
> 7. Comprueba que `npm run typecheck`, `npm run lint` y `npm run test:e2e` finalizan correctamente.

## Fase 3.2: API de datos y sincronización sin conexión

**Objetivo:** completar el camino de datos del modo registrado: CRUD en el servidor, repositorios de API en el cliente y cola de sincronización.

### Prompt de la Fase 3.2

> **Prompt 3.2**
>
> Implementa la Fase 3.2. Todas las rutas requieren JWT, validan con los esquemas Zod de `shared` y acceden a datos solo a través de repositorios que filtran por usuario mediante el `JOIN` con `calendar_profiles`:
>
> 1. Perfiles: `GET/POST/PATCH/DELETE /api/profiles`. `POST` crea el perfil vacío (el tipo es texto libre, de 1 a 50 caracteres, saneado). Añade `POST /api/profiles/:profileId/items/presets`, que crea `PRESET_ITEMS` en una transacción (acción «Añadir ítems de ejemplo»). El borrado rechaza (`ValidationError`) el último perfil del usuario; para evitar la carrera de dos borrados simultáneos, ejecútalo en una transacción que bloquee las filas de perfiles del usuario (`SELECT ... FOR UPDATE`) antes de contar.
> 2. Ítems de un perfil: `GET /api/profiles/:profileId/items?status=`, `POST`, `PATCH /:id` (aplica las reglas de `shared/src/catalog.ts`: versionado, edición del linaje, `category` inmutable), `POST /:id/archive`, `POST /:id/restore`, `GET /:id/impact` (número de registros afectados) y `DELETE /:id` (eliminación definitiva de todo el linaje y sus registros).
> 3. Eventos: `GET /api/profiles/:profileId/events?from=&to=` (por defecto, los últimos tres meses), `PUT /api/profiles/:profileId/events/:id` (idempotente, con el id generado por el cliente y validado como UUID; si el registro existe en ese mismo calendario solo se actualiza cuando `updated_at` es más reciente, y si el id pertenece a otro calendario responde 409 sin modificar nada) y `DELETE /api/profiles/:profileId/events/:id` (idempotente).
> 4. Validaciones de servidor: `logged_at` no puede superar `now() + 5 minutos`; los ítems archivados no admiten registros nuevos; `intensity` y `duration_minutes` solo si el ítem los registra; notas saneadas y de hasta 300 caracteres.
> 5. En el cliente, crea `ApiEventRepository`, `ApiItemRepository` y `ApiProfileRepository`, y haz que el store elija la implementación según `authMode`.
> 6. Implementa la sincronización sin conexión del ADR-007 con `SyncQueue` (LocalForage, clave `@cuidat_sync_queue_v1`) y `useSyncStore`: entradas `{ opId, type, entityId, payload, createdAt, attempts }`, fusión de operaciones (varios `upsert` se combinan, crear y borrar se cancelan), vaciado al iniciar, al evento `online`, al pasar la pestaña a visible, tras cada mutación con conexión y con reintentos de espera exponencial (5 s hasta 5 min). Los errores 4xx pasan a una lista de fallos y avisan al usuario; los de red o 5xx se reintentan. La Background Sync API, si existe, es solo una mejora opcional. Los perfiles y el catálogo requieren conexión en esta versión.
> 7. Configura `vite-plugin-pwa` (manifiesto, iconos y *service worker* con caché de la aplicación).
> 8. Pruebas: Vitest para la cola y las reglas de catálogo, y `supertest` contra la rama `test` para la API (aislamiento entre usuarios, invariante del último perfil, fecha futura, idempotencia).
> 9. Comprueba que `npm run typecheck`, `npm run lint` y `npm run test:unit` finalizan correctamente.

## Fase 3.3: CI, seguridad y calidad continua

**Objetivo:** automatizar la puerta de calidad descrita en `STYLE_GUIDE.md`.

### Prompt de la Fase 3.3

> **Prompt 3.3**
>
> Crea la integración continua:
>
> 1. `.github/workflows/ci.yml` con dos trabajos. `quality`: instalación con `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`. `e2e`: instala Chromium, ejecuta `ALLOW_DB_RESET=true npm run db:reset -- --yes` contra la rama `test` de Neon (secretos `DATABASE_URL`, `DATABASE_URL_DIRECT`, `JWT_SECRET`) y lanza `npm run test:e2e`. Usa `concurrency` para que no haya dos ejecuciones E2E a la vez sobre la misma rama y sube el informe de Playwright como artefacto.
> 2. `.github/workflows/snyk.yml` con el análisis de dependencias de Snyk (secreto `SNYK_TOKEN`) en cada *pull request* y de forma semanal.
> 3. Publica la imagen Docker en GitHub Container Registry en cada fusión a `main`. El despliegue se describe en la Fase 5 (Render).
> 4. Documenta en el README los secretos necesarios, la URL pública de la demo y que `main` debe exigir ambos trabajos antes de fusionar.

## Fase 4: ergonomía multimes y analítica

**Objetivo:** implementar la navegación avanzada, la vista multimes y el CRUD de calendarios con sus configuraciones.

### Prompt de la Fase 4

> **Prompt 4**
>
> Inicia la Fase 4 de experiencia de usuario clínica:
>
> 1. Crea o modifica `ProfileEditModal.vue` para editar el nombre, el tipo de perfil (combobox: sugerencias Mascota, Niño/a y Adulto más los tipos que el usuario ya haya creado; si escribe uno nuevo, se crea), el avatar y la ventana de correlación, con valores de 2, 6, 12, 24, 36 o 48 horas. Añade el onboarding «Crea tu primer calendario» para usuarios registrados sin perfil (solo si no se importó ninguno; pide únicamente nombre y tipo, el resto con valores por defecto) y el estado vacío del dock con «Añadir ítems de ejemplo». Añade la eliminación mediante `DELETE /api/profiles/:id` y deshabilítala cuando `!canDeleteProfile` (`profiles.length > 1` es la condición para poder borrar).
> 2. En `AuthModal.vue`, añade la opción «Conservar y migrar datos locales existentes a mi cuenta». Si está activada, envía `guestData` en `POST /api/auth/register`; si está desactivada, no lo envíes y elimina los datos locales.
> 3. Convierte el título del mes en un *popover* que permita saltar rápidamente entre meses y años, sin permitir meses futuros. Para invitados queda bloqueado con el aviso «Opción no disponible sin iniciar sesión.».
> 4. Añade el selector `[1M | 2M | 3M]`. Los usuarios registrados podrán mostrar hasta tres meses. Renderiza instancias consecutivas de `CalendarGrid` en disposición apilada, permitiendo que las celdas crezcan sin ocultar tarjetas.
> 5. Crea un panel o modal para filtrar correlaciones por periodo, síntomas y desencadenantes, y recalcular los resultados en tiempo real. Si el periodo supera los tres meses ya cargados, solicita al servidor el rango que falta.
> 6. En la carga inicial, solicita únicamente los registros de los últimos tres meses.
> 7. Crea la pantalla de gestión del catálogo con el ciclo de vida de la spec: edición según las reglas de versionado, sección «Archivados» con «Restaurar» y eliminación definitiva con recuento de registros y casilla de aceptación.
> 8. Confirma que el diseño es responsivo (`lg`) y que ningún componente `.vue` supera las 180 líneas de código. El límite no se aplica a pruebas, stores, migraciones SQL ni configuración.
> 9. Comprueba que `npm run typecheck`, `npm run lint`, `npm run test:coverage` y `npm run test:e2e` finalizan correctamente.

## Fase 5: despliegue en Render

**Objetivo:** publicar la demo en una URL pública para que el profesor la pruebe. El código, el CI y la imagen viven en GitHub; la aplicación se ejecuta en Render (servicio web gratuito, ADR-019) y los datos en Neon.

### 5.1. Preparación manual

1. Crea el servicio en Render conectando el repositorio de GitHub (o importando el `render.yaml`). Región de la UE, la más cercana a la base de Neon.
2. Define los secretos en Render: `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT`, `JWT_SECRET`, `SENTRY_DSN` y `VITE_SENTRY_DSN` (este último, como variable de compilación). No definas `ALLOW_DB_RESET`.
3. Deja `CLIENT_ORIGIN` sin definir: el servidor usa `RENDER_EXTERNAL_URL`.

> [!NOTE]
> El servicio gratuito se duerme tras unos 15 minutos sin tráfico y tarda alrededor de un minuto en despertar. Comprueba los límites vigentes en la documentación de Render antes de entregar.

### 5.2. Prompt de la Fase 5

> **Prompt 5**
>
> Prepara el despliegue en Render:
>
> 1. Añade `GET /api/health`, que responda 200 sin tocar la base de datos y que no cuente para el límite de peticiones.
> 2. Crea `render.yaml` en la raíz: un servicio `web` con `runtime: docker`, `dockerfilePath: ./server/Dockerfile`, `dockerContext: .`, `plan: free`, región de la UE, `healthCheckPath: /api/health`, `autoDeploy: true` y las variables `NODE_ENV=production` y `SERVE_CLIENT=true`; los secretos con `sync: false`.
> 3. Haz que el contenedor ejecute `npm run db:migrate` (idempotente, con `DATABASE_URL_DIRECT`) antes de arrancar el servidor, porque el plan gratuito no tiene comando previo al despliegue, y que el servidor escuche en `process.env.PORT`.
> 4. En producción, `CLIENT_ORIGIN` usa `RENDER_EXTERNAL_URL` si no está definido, la cookie lleva `Secure`, y `VITE_API_URL` queda vacío para que el cliente use rutas relativas `/api`.
> 5. Añade un flujo opcional `.github/workflows/keep-warm.yml`, programado cada 10 minutos, que haga una petición a `/api/health` de la URL pública (variable `PUBLIC_URL`). Déjalo desactivado por defecto y documenta que es opcional.
> 6. Documenta en el README: la URL pública, que la primera carga puede tardar hasta un minuto, cómo probar el modo invitado y cómo registrarse, y el aviso de privacidad de los datos de la demo.
> 7. Verifica en local con `docker compose up` que la imagen sirve el cliente y la API desde `http://localhost:3000` y que el inicio de sesión funciona con la cookie.
