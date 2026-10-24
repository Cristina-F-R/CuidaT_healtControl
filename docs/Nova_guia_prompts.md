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
| `vitest`, `@vitest/coverage-v8` | Desarrollo | Pruebas unitarias y cobertura (100 % en `correlation.ts` y `catalog.ts`). |
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
npm install zod -w shared
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

1. La base de datos de Neon es la rama principal (`main` en esta guía; en tu proyecto se llama `production`, el nombre no importa) y se usa directamente. Se crea y se llena con el esquema **una vez**, al final de la Fase 2 (sección 2.3; aún no hay usuarios reales).
2. Copia de Neon las dos cadenas de conexión: la *pooled* (host con `-pooler`) y la directa.
3. Crea `server/.env.example` y `client/.env.example` como en `TECH_SPEC.md`, sección 4, y copia el primero a `server/.env`. `JWT_SECRET` debe tener al menos 32 caracteres aleatorios (`openssl rand -base64 48`).
4. Cuando el esquema esté creado y antes de tener usuarios reales, crea desde la rama principal las ramas `dev` (desarrollo) y `test` (E2E y CI). Heredan el esquema y se pueden reiniciar sin riesgo. A partir de ahí, `server/.env` apunta a `dev`.

`DATABASE_URL` (pooled) lo usa la API. `DATABASE_URL_DIRECT` lo usan `db:migrate` y `db:reset`. No hay PostgreSQL local, así que `sslmode=verify-full` funciona siempre.

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
> 3. Maqueta un diseño con `SidebarDock`, `CalendarGrid` y `MonthlyInsightsSummary`. Con el breakpoint `lg` (1024 px) se muestran en tres columnas; por debajo, en una sola. El panel derecho debe mostrar dos secciones: «Vigilar posible patrón» y «Patrón detectado». En esta fase quedan vacías; las coincidencias reales se conectan en la Fase 2.
> 4. Valida con Day.js las fechas futuras para todos los usuarios. Los días posteriores a la fecha actual deben aparecer deshabilitados (`cursor-not-allowed`, `opacity-50`) y conservar un botón de día con `aria-disabled="true"` que muestre el *toast* «No se pueden registrar métricas en fechas futuras.» sin abrir modales ni aceptar elementos arrastrados. El botón de mes siguiente se deshabilita al llegar al mes actual.
> 5. Importa la fuente en local con `@fontsource-variable/nunito-sans` desde `main.ts`. No uses enlaces a Google Fonts.
> 6. Antes de escribir código, explica cómo separarás los dos modos de colocación en `useInteraction.ts`: seleccionar y colocar para todos (los elementos del dock son botones con `aria-pressed`) y arrastrar y soltar con la API HTML5 nativa (`draggable`, `dragstart`, `dragover`, `drop`), sin librerías, solo cuando `matchMedia('(hover: hover) and (pointer: fine)')` coincide.
> 7. Configura `app.config.errorHandler` en `main.ts` y crea un componente sencillo `FallbackError.vue` para evitar pantallas en blanco.
> 8. Durante el arrastre, ilumina los días válidos como zonas de destino. Los días futuros bloqueados no deben reaccionar.
> 9. Estructura cada celda según el ADR-015: contenedor no interactivo, botón de día extendido sobre toda la celda (`after:absolute after:inset-0`) y puntos de evento como botones hermanos con `relative z-10`. Usa elementos semánticos, `aria-label` en botones sin texto, foco atrapado en los modales y `aria-live="polite"` en los *toasts*.
> 10. Inicializa `@sentry/vue` en `main.ts` y vincúlalo con el controlador global de errores. Sin datos de salud: DSN de región UE, `attachErrorHandler: false` (el error se reporta desde el controlador global), `dataCollection` con todo desactivado (Sentry 11 sustituyó `sendDefaultPii` por este objeto), sin Session Replay, `beforeSend` y `beforeBreadcrumb` que eliminen cuerpos de petición, notas, nombres de ítems y *query strings*, y que descarte los breadcrumbs `ui.*` (su `aria-label` contiene nombres de ítem y fechas), y el UUID del usuario como único identificador.
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
> 4. Si `authMode` es `guest`: un perfil, solo el mes actual (flechas de mes, Quick Jump y selector de densidad bloqueados) y un máximo de 3 síntomas y 3 triggers/medicación (`GUEST_MAX_SYMPTOMS`, `GUEST_MAX_TRIGGERS` en `shared/src/constants.ts`; las reglas en `shared/src/guestLimits.ts`, que `useGuestLimits.ts` expone a la interfaz; los archivados siguen contando y los eliminados liberan hueco). Al intentar navegar o superar el límite, muestra el *toast* «Opción no disponible sin iniciar sesión.» con la acción «Crear cuenta» que abre `AuthModal.vue`. Los datos de meses anteriores siguen guardados localmente. El bloqueo de futuro ya es general.
> 5. Crea `shared/src/presets.ts` con `PRESET_ITEMS`: síntomas Vómito, Heces blandas y Malestar / dolor; triggers Pescado y Lácteos; medicación Medicación (sin «Picor»). El perfil de invitado se inicializa con ellos en la primera carga; son ítems normales (editables, archivables y eliminables). Cada ítem pertenece a una categoría. En `EventLogModal.vue`, la hora es obligatoria: por defecto la hora actual si el día es hoy, y si no una franja (Mañana 08:00, Mediodía 13:00, Tarde 18:00, Noche 22:00) con ajuste fino en pasos de 15 minutos. Para hoy, la hora se limita al instante actual. Muestra dinámicamente intensidad (1 a 3) y duración en minutos según el ítem.
> 6. Al pulsar el botón de día de una celda, abre `DaySummaryModal.vue`. En modo normal, permite editar y eliminar. En «Modo Consulta», utiliza solo lectura. Cada registro se muestra con los campos de su propia versión de ítem.
> 7. En la gestión de ítems, incluye un selector visual de emojis, la categoría (bloqueada al editar), `track_intensity` y `track_duration`, el aviso de que los cambios de nombre y emoji son retroactivos, «Archivar» como opción principal y «Eliminar definitivamente» con el número de registros afectados y una casilla de aceptación.
> 8. Antes de guardar en Pinia, pasa las notas (300 caracteres) y los nombres de ítem por `sanitizeText()` (`client/src/application/sanitizeText.ts`). Internamente usa DOMPurify con `RETURN_DOM_FRAGMENT` y devuelve solo texto. No guardes la salida de `DOMPurify.sanitize()` directamente: devuelve HTML. Vue muestra el texto por interpolación: `v-html` sigue prohibido.
> 9. Conecta `detectCorrelations()` con el panel derecho (`MonthlyInsightsSummary.vue` y `PatternSection.vue`): muestra las coincidencias del mes visible en «Vigilar posible patrón» y «Patrón detectado», con los nombres de la versión vigente de cada ítem. Las coincidencias usan los registros del mes visible y de la ventana previa a él. Los filtros por periodo, síntomas y desencadenantes son de la Fase 4 (punto 5 del Prompt 4).
> 10. Verifica el resultado con `npm run typecheck`, `npm run lint` y `npm run test:coverage`.

### 2.3. Esquema en Neon (al final de esta fase)

Se hace **una sola vez**, al terminar esta fase y antes de empezar la Fase 3, porque el servidor y sus migraciones dependen de este esquema.

Antes de ejecutar nada:

- Crea el proyecto en Neon con **PostgreSQL 17** (valor por defecto; 16 también sirve) y **región de la UE** (Frankfurt). Así los datos quedan en la UE (RGPD) y cerca del servicio de Render de la Fase 5.
- La base se llama `neondb` y la rama inicial es `main`.

> [!WARNING]
> El paso 1 elimina por completo el esquema `public` (tablas, datos, relaciones, índices) de la base a la que estés conectado. En un proyecto nuevo no hay nada que perder, pero comprueba en Neon que estás en la rama `main` y la base `neondb` antes de pulsar **Run**.

En el **SQL Editor** de Neon, ejecuta en este orden (pega el contenido de cada archivo y pulsa **Run**):

| Paso | Archivo | Qué hace |
|---|---|---|
| 1 | `docs/neon/reset.sql` | **Destructivo.** `DROP SCHEMA public CASCADE` y lo recrea vacío. |
| 2 | `docs/neon/001_init.sql` | Crea las tablas, restricciones, índices y las reglas de integridad (triggers). Sin `DROP`. |
| 3 | `docs/neon/register_001.sql` | Crea `schema_migrations` y marca `001_init` como aplicada. |
| 4 | `docs/neon/smoke_test.sql` | Prueba de humo: debe terminar con el aviso `SMOKE TEST OK`. Corre en un bloque que se revierte entero si falla y borra sus propios datos al terminar. |

Después, crea las ramas `dev` y `test` desde `main` (paso 0.3.4) y comprueba que ambas tienen el esquema. Las migraciones de la Fase 3 se aplican sobre este mismo esquema.

Pasos manuales en la consola de Neon (no los hace la IA):
1. **Branches → Create branch**, origen `production` (la principal), nombre `dev`. Después, otro con nombre `test`.
2. Cambia `server/.env` a los endpoints de `dev` (`DATABASE_URL` y `DATABASE_URL_DIRECT`). La URL de `production` se guarda aparte: la usará Render en la Fase 5.
3. Opcional hasta la Fase 5: crea un proyecto de Sentry en la región UE y copia su DSN en `SENTRY_DSN`.

`dev` lo necesita el smoke test del Prompt 3 y `test` lo necesitan los E2E de la Fase 3.1, así que estos pasos van antes de empezar la Fase 3.

Qué comprueba la prueba de humo: email en minúsculas y único; `profile_type` no vacío (texto libre), `category`, ventanas, intensidad y duración válidos; notas no vacías; que un ítem, su padre, su raíz y un registro nunca referencien otro calendario; una sola versión vigente por ítem; que las métricas de un registro sean las de su versión; que no se registre en el futuro; que la categoría y las métricas de un ítem no cambien en sitio y que una versión sustituida no vuelva a estar vigente; que borrar la raíz elimine todo su linaje y sus registros; y que borrar el usuario elimine todo en cascada.

Validación: los scripts se han comprobado en local con PGlite (PostgreSQL 18), que no es Neon. La comprobación definitiva es el paso 4 en Neon: si falla, no sigas a la Fase 3.

Cuando exista el servidor (Fase 3), el mismo flujo estará disponible por terminal:

- `npm run db:migrate`: crea `schema_migrations` si no existe y aplica, en orden y en una transacción, las migraciones pendientes. Es idempotente y nunca borra datos.
- `npm run db:reset`: reinicia el esquema y llama a la misma lógica. Solo funciona con `ALLOW_DB_RESET=true` y la bandera `--yes`, e imprime el host y la base antes de actuar. Tras el reinicio de la rama principal, `ALLOW_DB_RESET` vuelve a `false`.

```bash
ALLOW_DB_RESET=true npm run db:reset -- --yes
```

## Fase 3: backend, base de datos y autenticación

**Objetivo:** levantar Express sobre el esquema de Neon creado al final de la Fase 2 y dejar la autenticación funcionando, también en el cliente.

### Prompt de la Fase 3

> **Prompt 3**
>
> Inicia la Fase 3 de backend y persistencia con la arquitectura de la sección 3.1 de `TECH_SPEC.md`:
>
> 1. Copia `docs/neon/001_init.sql` a `server/src/db/migrations/` sin modificarlo y crea `migrate.ts` y `reset.ts` como se describe en la sección 2.3 (sin `DROP` en la migración; `reset.ts` con las salvaguardas `ALLOW_DB_RESET` y `--yes`). Usa `DATABASE_URL_DIRECT` para ambos y `DATABASE_URL` para la API.
> 2. Verifica que `server/src/db/migrations/001_init.sql` es idéntico a `docs/neon/001_init.sql` y que el esquema de `dev` coincide con `TECH_SPEC.md`, sección 5 (restricciones, claves compuestas, índice de versión vigente y triggers). Ejecuta `smoke_test.sql` contra `dev` (en `main` ya pasó al final de la Fase 2).
> 3. Configura Express con `trust proxy`, Helmet, `cookie-parser` y CORS con credenciales solo para `CLIENT_ORIGIN`. La sesión es un JWT en la cookie `httpOnly` `cuidat_session` (`Secure` en producción, `SameSite=Lax`, caducidad `JWT_EXPIRES_IN`); añade `POST /api/auth/logout` y `GET /api/auth/me`. Las peticiones que modifican estado deben llevar la cabecera `X-CuidaT-Client: web` y un `Origin` igual a `CLIENT_ORIGIN`. Define la jerarquía `AppError` y un middleware que la traduzca a HTTP.
> 4. Implementa `POST /api/auth/register` con un `guestData` opcional. Si llega, crea el usuario y importa el contenido de `@cuidat_guest_v1` en la misma transacción, validándolo con las reglas normales (1 perfil, máximo 3 síntomas y 3 triggers/medicación, sin eventos futuros, textos saneados) y **regenerando todos los ids** en el servidor. No existe endpoint `upgrade` ni usuarios anónimos. El cliente borra `@cuidat_guest_v1` y su copia de seguridad tras una respuesta correcta (ADR-020).
> 5. Crea el endpoint de inicio de sesión y protege las contraseñas mediante bcrypt.
> 6. Configura `express-rate-limit`: `AUTH_RATE_LIMIT_MAX` solicitudes (por defecto 20) cada 15 minutos para `POST /api/auth/register` y `POST /api/auth/login`, y 100 solicitudes por minuto para el resto de la API, incluido `DELETE /api/auth/account`.
> 7. Crea `server/Dockerfile` multietapa (contexto en la raíz del repositorio, porque necesita `shared`): compila `shared`, `client` y `server` y deja una imagen en la que, con `SERVE_CLIENT=true`, Express sirve la API en `/api` y el cliente compilado (`client/dist`, con *fallback* a `index.html`) desde el mismo origen. Añade un `docker-compose.yml` en la raíz que levante esa imagen leyendo `server/.env`. No hay PostgreSQL local: la base es Neon.
> 8. Configura `@sentry/node` con las mismas reglas de privacidad que el cliente (sin datos de salud, sin PII, solo el UUID del usuario).
> 9. Comprueba que Husky ejecuta `lint-staged`, `npm run typecheck` y `npm run test:unit` en `pre-commit` y commitlint en `commit-msg`.
> 10. Muestra la lista de rutas, los esquemas Zod y los errores de cada una antes de escribir los controladores.
> 11. Cliente de autenticación: convierte `AuthModal.vue` (marcador de la Fase 2) en formulario de inicio de sesión y registro, con los esquemas Zod de `shared`. Al arrancar, llama a `GET /api/auth/me` para restaurar la sesión. Hasta la Fase 3.2 el inicio de sesión solo cambia la sesión y el cabecero, que muestra la cuenta; los datos siguen en el navegador (modo local), porque los repositorios de API llegan en la 3.2 (ADR-007). El interruptor de migración de datos llega en la Fase 4 (punto 2).
> 12. Requisitos OWASP Top 10 (2021) del servidor, además de los puntos anteriores:
>     - **A03 Inyección:** todas las consultas con parámetros (`$1`, `$2`) del driver `pg`; ningún texto de usuario concatenado en SQL.
>     - **A02 Fallos criptográficos:** bcrypt con coste de al menos 12; HTTPS en Render y cookie `Secure` en producción; `JWT_SECRET` aleatorio, nunca en el repositorio.
>     - **A05 Configuración de seguridad:** CSP con Helmet (`default-src 'self'`, scripts solo del mismo origen, `connect-src` con el DSN de Sentry), `x-powered-by` desactivado, `express.json({ limit: '100kb' })` y, en producción, errores sin stack traces.
>     - **A07 Autenticación:** contraseña de al menos 12 caracteres; `POST /api/auth/login` responde igual exista o no el email; `jwt.verify` fija `algorithms: ['HS256']`; el arranque falla si `JWT_SECRET` tiene menos de 32 caracteres o falta.
>     - **A09 Registro de eventos:** registrar eventos de seguridad (login fallido, registro, borrado de cuenta) con el UUID y sin email ni datos de salud, en la salida del servidor.
>     - **A08 Integridad:** imagen Docker con versión de base fijada y `npm ci` con el lockfile; las acciones de GitHub se fijan a su SHA (Fase 3.3).
>     - **Manejo de errores:** los errores no esperados devuelven un 500 genérico; el detalle solo va a Sentry, con el mismo filtrado de la Fase 1.


> **Decisiones tomadas al implementar la Fase 3** (el código manda; esto las deja por escrito):
> - El cuerpo JSON general admite 100 kB. Solo `POST /api/auth/register` admite 1 MB, porque lleva el calendario del invitado (hasta 5000 registros).
> - `trust proxy` vale `1` (un salto: el router de Render), no `true`.
> - El registro responde 409 `EMAIL_TAKEN` si el email ya existe. Es una enumeración aceptada a cambio de una experiencia clara; el límite por IP la acota. El login no la permite.
> - El cliente de Sentry y el del servidor eliminan los valores de las excepciones antes de enviarlas: los mensajes de error de PostgreSQL pueden incluir la fila completa (por ejemplo, las notas).
> - Las pruebas de integración usan PostgreSQL 18 en memoria (PGlite) a través de su servidor de socket, con el driver `pg` real. Los branches `dev` y `test` de Neon se usan solo para las pruebas E2E (desde la Fase 3.1).
> - La imagen ejecuta `node dist/db/migrate.js` (compilado) antes de arrancar: `tsx` es devDependency y no está en la imagen de producción. Así se resuelve el punto de la Fase 5.
> - `server/Dockerfile` usa `.dockerignore` para que ningún `.env` entre en la imagen.
> - La imagen base se fija por versión exacta y digest (`ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:…`, A08). Para actualizarla: `docker buildx imagetools inspect node:22.x.y-bookworm-slim`.
> - Punto 11, hasta la Fase 3.2: la sesión (`useAuthStore().user`) y el modo de datos (`authMode`) van por separado. Con sesión iniciada, `authMode` sigue en `guest`: repositorios locales, límites de invitado y la etiqueta «Modo Local». Si se alcanza un límite con sesión, el aviso es «Opción disponible cuando tus datos se sincronicen con tu cuenta.» (sin «Crear cuenta»). En la 3.2, el inicio de sesión pasará `authMode` a `authenticated`.
> - Contradicción entre los puntos 4 y 11, resuelta así: el registro envía siempre el calendario local como `guestData` (la migración está activada hasta que la Fase 4 añada el interruptor) y **no** borra `@cuidat_guest_v1`. Borrarlo dejaría el calendario vacío, porque la Fase 3 no puede leer datos del servidor. El borrado tras el registro (ADR-020) llega con la Fase 3.2 o con el interruptor de la Fase 4.
> - En desarrollo, Vite redirige `/api` a `http://localhost:3000`, así que `client/.env` no es obligatorio y `VITE_API_URL` queda vacío por defecto. La página y la API comparten origen, como en producción.

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
> 4. Crea `DELETE /api/auth/account`. Las restricciones `ON DELETE CASCADE` deberán eliminar los calendarios y registros asociados dentro de una transacción. El servidor borra la cookie de sesión. En el cliente, vacía los stores (`resetState()`) y limpia `@cuidat_guest_v1` y su copia de seguridad `@cuidat_guest_v1.corrupto`. La cola de sincronización se vacía también cuando exista (Fase 3.2).
> 5. Crea `playwright.config.ts` con `webServer` para cliente y servidor y la rama `test` de Neon.
> 6. Escribe la prueba E2E `tests/e2e/account-deletion.spec.ts` con Playwright. Debe comprobar el registro e inicio de sesión, la apertura del modal, el bloqueo sin la palabra requerida, la confirmación correcta y el regreso de la interfaz a «Modo Local».
> 7. Comprueba que `npm run typecheck`, `npm run lint` y `npm run test:e2e` finalizan correctamente.


> **Decisiones tomadas al implementar la Fase 3.1:**
> - La etiqueta de la cabecera (`useSyncStatus.ts`) indica dónde están los datos: depende de `authMode`, no solo de la sesión. Hasta la Fase 3.2, un usuario con sesión iniciada sigue viendo «Modo Local», porque sus datos aún están en el navegador. «Sincronizado» sería falso. «Pendiente (N)» ya está implementado y espera la cola de la 3.2.
> - El «menú de perfil» es un menú de cuenta en la cabecera, junto al email, con «Descargar mis datos (JSON)», «Eliminar cuenta y datos» y «Cerrar sesión». En la app, «perfil» es cada calendario, y estas acciones afectan a la cuenta entera.
> - La exportación lee todos los calendarios, con todas las versiones de cada ítem y sus registros, a través de los repositorios. Hasta la 3.2 exporta lo que el usuario ve, que son los datos locales. La copia que el servidor recibió al registrarse no se incluye. Con los repositorios de API, el mismo código exportará los datos del servidor.
> - `DELETE /api/auth/account` responde 204 aunque el usuario ya no exista (borrado idempotente). Registra el evento `account_deleted` solo con el UUID.
> - Tras el borrado, el cliente vacía los stores, borra `@cuidat_guest_v1` y `@cuidat_guest_v1.corrupto` y carga un calendario de invitado nuevo, sin recargar la página.
> - Playwright levanta su propia API (puerto 3100, con `server/.env.test`) y su propio cliente (puerto 5180, con el proxy de Vite apuntando a 3100). Nunca reutiliza un servidor ya arrancado: la API de desarrollo del puerto 3000 apunta a la rama `dev`. En CI, las variables llegan como secretos; `dotenv` no las sobrescribe y la ausencia de `.env.test` no da error.
> - `npm run typecheck` comprueba también `playwright.config.ts` y `tests/e2e` (`tsconfig.e2e.json`).

## Fase 3.2: API de datos y sincronización sin conexión

**Objetivo:** completar el camino de datos del modo registrado: CRUD en el servidor, repositorios de API en el cliente y cola de sincronización.

### Prompt de la Fase 3.2

> **Prompt 3.2**
>
> Implementa la Fase 3.2. Todas las rutas requieren JWT, validan con los esquemas Zod de `shared` y acceden a datos solo a través de repositorios que filtran por usuario mediante el `JOIN` con `calendar_profiles`:
>
> 1. Perfiles: `GET/POST/PATCH/DELETE /api/profiles`. `POST` crea el perfil vacío (el tipo es texto libre, de 1 a 50 caracteres, saneado). Añade `POST /api/profiles/:profileId/items/presets`, que crea `PRESET_ITEMS` en una transacción (acción «Añadir ítems de ejemplo»). El borrado rechaza (`ValidationError`) el último perfil del usuario; para evitar la carrera de dos borrados simultáneos, ejecútalo en una transacción que bloquee las filas de perfiles del usuario (`SELECT ... FOR UPDATE`) antes de contar.
> 2. Ítems de un perfil: `GET /api/profiles/:profileId/items?status=`, `POST`, `PATCH /:id` (aplica las reglas de `shared/src/catalog.ts`: versionado, edición del linaje, `category` inmutable; al cambiar la forma de un ítem, marca primero la versión vigente como `superseded` y después inserta la nueva, porque el índice único parcial y los triggers de `001_init.sql` lo exigen; las métricas nunca se actualizan en sitio), `POST /:id/archive`, `POST /:id/restore`, `GET /:id/impact` (número de registros afectados) y `DELETE /:id` (eliminación definitiva de todo el linaje y sus registros).
> 3. Eventos: `GET /api/profiles/:profileId/events?from=&to=` (por defecto, los últimos tres meses), `PUT /api/profiles/:profileId/events/:id` (idempotente, con el id generado por el cliente y validado como UUID; si el registro existe en ese mismo calendario solo se actualiza cuando `updated_at` es más reciente, y si el id pertenece a otro calendario responde 409 sin modificar nada; `updated_at` lo envía el cliente y el servidor lo acota a `now() + 5 min`) y `DELETE /api/profiles/:profileId/events/:id` (idempotente).
> 4. Validaciones de servidor: `logged_at` no puede superar `now() + 5 minutos`; los ítems archivados no admiten registros nuevos (los registros que llegan de la cola de sincronización se aceptan aunque su ítem esté archivado o sustituido, ADR-007); `intensity` y `duration_minutes` solo si el ítem los registra; notas saneadas y de hasta 300 caracteres.
> 5. En el cliente, crea `ApiEventRepository`, `ApiItemRepository` y `ApiProfileRepository`, y haz que el store elija la implementación según `authMode`.
> 6. Implementa la sincronización sin conexión del ADR-007 con `SyncQueue` (LocalForage, clave `@cuidat_sync_queue_v1`) y `useSyncStore`: entradas `{ opId, type, entityId, payload, createdAt, attempts }`, fusión de operaciones (varios `upsert` se combinan, crear y borrar se cancelan), vaciado al iniciar, al evento `online`, al pasar la pestaña a visible, tras cada mutación con conexión y con reintentos de espera exponencial (5 s hasta 5 min). Los errores 4xx pasan a una lista de fallos y avisan al usuario; los de red o 5xx se reintentan. La Background Sync API, si existe, es solo una mejora opcional. Los perfiles y el catálogo requieren conexión en esta versión.
> 7. Configura `vite-plugin-pwa` (manifiesto, iconos y *service worker* con caché de la aplicación).
> 8. Pruebas: Vitest para la cola y las reglas de catálogo, y `supertest` contra la rama `test` para la API (aislamiento entre usuarios, invariante del último perfil, fecha futura, idempotencia).
> 9. Comprueba que `npm run typecheck`, `npm run lint` y `npm run test:unit` finalizan correctamente.


> **Decisiones tomadas al implementar la Fase 3.2:**
> - **Rutas del catálogo:** `:rootId` es el id de la primera versión del linaje. Editar, archivar, restaurar, el impacto y el borrado actúan sobre el linaje completo, y la respuesta devuelve todas sus versiones. Las reglas siguen siendo las funciones puras de `shared/src/catalog.ts`. El repositorio las ejecuta sobre el linaje bloqueado (`SELECT … FOR UPDATE`) y escribe la diferencia en una transacción, primero el `superseded` y después la versión nueva.
> - **Puertos del cliente:** pasan a ser operaciones (`create`, `edit`, `archive`, `restore`, `deleteImpact`, `removeLineage`, `addPresets`) en lugar de «guardar la lista». Con la API, las reglas las aplica el servidor. Los repositorios locales aplican las mismas reglas de `shared`.
> - **`authMode`** se deriva de la sesión. Los stores resuelven el repositorio en cada llamada (`currentRepositories()`), así que iniciar o cerrar sesión cambia el origen de los datos y recarga el espacio de trabajo.
> - **Registro:** envía el calendario local como `guestData` y, tras una respuesta correcta, borra `@cuidat_guest_v1` y su copia (ADR-020). El interruptor para no migrar llegó en la Fase 4.
> - **Cuenta sin calendarios:** hasta la Fase 4 se creaba «Mi calendario» (tipo «Adulto»), vacío. Desde la Fase 4 se muestra el onboarding «Crea tu primer calendario».
> - **Registros que vienen de la cola:** `PUT /events/:id` acepta `deferred: true` para los registros grabados antes y enviados después (sin conexión o en reintentos). Esos se aceptan aunque su ítem esté archivado o sustituido, como pide el ADR-007. El primer envío inmediato con conexión va con `deferred: false`, y el servidor rechaza los ítems archivados. Un registro no puede cambiar de ítem.
> - **Cola:** las entradas siguen la forma del ADR, con `userId`, `isNew` y `offline` en `payload`. La cola nunca fusiona una operación sobre otra que se está enviando, para que el acuse de recibo no borre una edición posterior. Las de otra cuenta no se envían. Un 429 se reintenta igual que un 5xx. Un 401 detiene el vaciado sin gastar intentos y pide iniciar sesión.
> - **Caché sin conexión (`@cuidat_cache_v1`, IndexedDB):** guarda los últimos perfiles, ítems y registros leídos de la API, para que la PWA abra sin red. Es del usuario que la creó, y se borra al cerrar sesión y al eliminar la cuenta. El *service worker* solo guarda la aplicación, nunca respuestas de la API.
> - **Cierre de sesión:** se rechaza mientras haya registros pendientes de sincronizar, para no perderlos.
> - **Rangos:** la carga inicial pide los tres meses de calendario más la ventana máxima (48 h) anterior. Al navegar a un mes más antiguo se pide el tramo que falta. La exportación RGPD pide todo el historial.
> - **Vitest:** `maxWorkers: 8`. En un checkout de WSL sobre `/mnt/c`, cada worker tarda segundos en arrancar, y con más en paralelo alguno superaba el tiempo de arranque. La ejecución fallaba de forma aleatoria, y con ella el `pre-commit`.

## Fase 3.3: CI, seguridad y calidad continua

**Objetivo:** automatizar la puerta de calidad descrita en `STYLE_GUIDE.md`.

### Prompt de la Fase 3.3

> **Prompt 3.3**
>
> Crea la integración continua (acciones de terceros fijadas a su SHA, A08):
>
> 1. `.github/workflows/ci.yml` con dos trabajos. `quality`: instalación con `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:coverage` y `npm audit --omit=dev --audit-level=high` (A06). Las vulnerabilidades de herramientas de desarrollo que dependan de Tailwind 3 se documentan como riesgo aceptado. `e2e`: instala Chromium, ejecuta `ALLOW_DB_RESET=true npm run db:reset -- --yes` contra la rama `test` de Neon (secretos `DATABASE_URL`, `DATABASE_URL_DIRECT`, `JWT_SECRET`) y lanza `npm run test:e2e`. Usa `concurrency` para que no haya dos ejecuciones E2E a la vez sobre la misma rama y sube el informe de Playwright como artefacto.
> 2. `.github/workflows/snyk.yml` con el trabajo `dependencies`: análisis de dependencias de producción con Snyk (secreto `SNYK_TOKEN`, umbral `high`) en cada *pull request* y cada semana.
> 3. `.github/workflows/docker-publish.yml`: publica la imagen Docker en GitHub Container Registry (`latest` y `sha-<commit>`) en cada fusión a `main`. El despliegue se describe en la Fase 5 (Render).
> 4. Documenta en el README los secretos necesarios, la URL pública de la demo y que `main` debe exigir los trabajos `quality`, `e2e` y `dependencies` antes de fusionar (`STYLE_GUIDE.md`).

## Fase 4: ergonomía multimes y analítica

**Objetivo:** implementar la navegación avanzada, la vista multimes y el CRUD de calendarios con sus configuraciones.

### Prompt de la Fase 4

> **Prompt 4**
>
> Inicia la Fase 4 de experiencia de usuario clínica:
>
> 1. Crea o modifica `ProfileEditModal.vue` para editar el nombre, el tipo de perfil (combobox: sugerencias Mascota, Niño/a y Adulto más los tipos que el usuario ya haya creado; si escribe uno nuevo, se crea), el avatar y la ventana de correlación, con valores de 2, 6, 12, 24, 36 o 48 horas. Añade el onboarding «Crea tu primer calendario» para usuarios registrados sin perfil (solo si no se importó ninguno; pide únicamente nombre y tipo, el resto con valores por defecto) y el estado vacío del dock con «Añadir ítems de ejemplo». Añade la eliminación mediante `DELETE /api/profiles/:id` y deshabilítala cuando `!canDeleteProfile` (`profiles.length > 1` es la condición para poder borrar).
> 2. En `AuthModal.vue`, añade la opción «Conservar y migrar datos locales existentes a mi cuenta». Si está activada, envía `guestData` en `POST /api/auth/register`; si está desactivada, no lo envíes y elimina los datos locales. Tras una respuesta correcta de `POST /api/auth/register`, en ambos casos, borra `@cuidat_guest_v1` y `@cuidat_guest_v1.corrupto` (ADR-020).
> 3. Convierte el título del mes en un *popover* que permita saltar rápidamente entre meses y años, sin permitir meses futuros. Para invitados queda bloqueado con el aviso «Opción no disponible sin iniciar sesión.».
> 4. Añade el selector `[1M | 2M | 3M]`. Los usuarios registrados podrán mostrar hasta tres meses. Renderiza instancias consecutivas de `CalendarGrid` en disposición apilada, permitiendo que las celdas crezcan sin ocultar tarjetas.
> 5. Crea un panel o modal para filtrar correlaciones por periodo, síntomas y desencadenantes, y recalcular los resultados en tiempo real. Las secciones «Vigilar posible patrón» y «Patrón detectado» ya muestran las coincidencias del mes visible desde la Fase 2; aquí se añade el filtro sobre ellas. Si el periodo supera los tres meses ya cargados, solicita al servidor el rango que falta.
> 6. En la carga inicial, solicita únicamente los registros de los últimos tres meses.
> 7. Crea la pantalla de gestión del catálogo con el ciclo de vida de la spec: edición según las reglas de versionado, sección «Archivados» con «Restaurar» y eliminación definitiva con recuento de registros y casilla de aceptación.
> 8. Confirma que el diseño es responsivo (`lg`) y que ningún componente `.vue` supera las 180 líneas de código. El límite no se aplica a pruebas, stores, migraciones SQL ni configuración.
> 9. Comprueba que `npm run typecheck`, `npm run lint`, `npm run test:coverage` y `npm run test:e2e` finalizan correctamente.

> **Decisiones tomadas al implementar la Fase 4:**
> - **Selector de calendarios:** el prompt exige poder eliminar perfiles (`canDeleteProfile`) pero no dice dónde se crean ni se cambian. `ProfileMenu.vue` sustituye a la etiqueta del perfil en la cabecera: lista los calendarios, «Editar calendario» y «Nuevo calendario». Para invitados, «Nuevo calendario» muestra el aviso «Opción no disponible sin iniciar sesión.». Cambiar o borrar el calendario activo recarga su catálogo y sus registros.
> - **`ProfileEditModal.vue`** sirve para crear y para editar. Expone nombre, tipo, avatar, tema de color y ventana. El color (`ProfileColorField.vue`) se elige con píldoras de la paleta (`slate`, `peach`, `sky`, `mint`; `PROFILE_COLOR_THEMES` en `shared`) y tiñe el avatar del selector de calendarios. Se valida en el dominio, en los esquemas Zod y en la base de datos (migración `002_color_theme_check.sql`). El tipo es un `<input list>` con `<datalist>`: sugiere Mascota, Niño/a y Adulto más los tipos ya usados, y uno nuevo se crea al escribirlo. Eliminar pide confirmación y avisa de que se borran ítems y registros.
> - **Onboarding:** `loadWorkspace` ya no crea «Mi calendario». Una cuenta sin calendarios muestra `FirstCalendarOnboarding.vue` (solo nombre y tipo) y la cabecera sin menú de calendarios. Las que migraron un calendario no lo ven. El estado vacío del dock ofrece «Añadir ítems de ejemplo» solo a cuentas registradas y sin ningún ítem.
> - **Registro:** `AuthModal.vue` añade el interruptor (activado por defecto). Desactivado, `guestData` **no se envía**; en ambos casos, tras un registro correcto, se borran `@cuidat_guest_v1` y `@cuidat_guest_v1.corrupto` (ADR-020). Si el registro falla, no se borra nada.
> - **Vista multimes:** `CalendarGrid.vue` pasa a ser un solo mes (`monthKey`) y `CalendarPanel.vue` apila hasta tres. Los meses van del más reciente al más antiguo, porque nunca puede haber meses futuros y así el mes activo queda arriba. Los invitados quedan fijos en `1M`. Al cambiar de densidad se carga hasta el mes visible más antiguo.
> - **Panel derecho:** «Vigilar posible patrón» y «Patrón detectado» siguen mostrando solo el mes activo (el de arriba). El filtro por periodo es un modal aparte, «Ver resúmenes» (`CorrelationFilterModal.vue`), con periodos rápidos (1, 3, 6 y 12 meses), fechas libres, y casillas de síntomas y desencadenantes (los archivados también aparecen). Si el periodo supera los meses cargados, pide al servidor el tramo que falta. Para invitados el periodo queda fijo en el mes actual.
> - **Ya existían** y solo se comprobaron: la carga inicial de tres meses (punto 6) y la pantalla de gestión del catálogo con «Archivados», «Restaurar» y borrado con recuento (punto 7).
> - **Límite de 180 líneas:** `ItemManagerModal.vue` tenía 185. Se extrajo `CatalogItemList.vue` (ahora 122). El resto de componentes queda por debajo de 180.
> - **Cola al eliminar un calendario:** tras un borrado correcto, `deleteCalendar` descarta las operaciones pendientes de ese calendario (`SyncQueue.discardCalendar`), porque el servidor ya borró sus registros en cascada. Así no llegan a la lista de fallidos (ADR-007). Una operación que ya se estaba enviando termina por su cuenta.
> - **Revisión posterior:** se eliminó la copia obsoleta del proyecto dentro de `tests/`, que se había añadido por error en la Fase 2. `tests/` contiene ahora solo `tests/e2e`. Esa copia hacía que Playwright se cargara dos veces en local y que Snyk (`--all-projects`) analizara dependencias que no se usan. Se añadió `.gitattributes` para fijar los finales de línea en LF, como `.editorconfig`, y se actualizó `dompurify` a 3.4.17 (aviso crítico de `npm audit`).

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
> 3. Haz que el contenedor ejecute `npm run db:migrate` (idempotente, con `DATABASE_URL_DIRECT`) antes de arrancar el servidor, porque el plan gratuito no tiene comando previo al despliegue, y que el servidor escuche en `process.env.PORT`. `tsx` es `devDependency`: la imagen debe conservarlo (o compilar las migraciones con `tsc`) para que `db:migrate` funcione en producción.
> 4. En producción, `CLIENT_ORIGIN` usa `RENDER_EXTERNAL_URL` si no está definido, la cookie lleva `Secure`, y `VITE_API_URL` queda vacío para que el cliente use rutas relativas `/api`.
> 5. Añade un flujo opcional `.github/workflows/keep-warm.yml`, programado cada 10 minutos, que haga una petición a `/api/health` de la URL pública (variable `PUBLIC_URL`). Déjalo desactivado por defecto y documenta que es opcional.
> 6. Documenta en el README: la URL pública, que la primera carga puede tardar hasta un minuto, cómo probar el modo invitado y cómo registrarse, y el aviso de privacidad de los datos de la demo.
> 7. Verifica en local con `docker compose up` que la imagen sirve el cliente y la API desde `http://localhost:3000` y que el inicio de sesión funciona con la cookie.
