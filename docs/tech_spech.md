# TECH_SPEC.md: CuidaT Core System Specification

This document serves as the single source of truth for the development of CuidaT. Any AI coding agent must consult and adhere strictly to this specification before introducing structural, architectural, or logic changes.

---

## 1. Product Vision & Operational Constraints

CuidaT is a reactive web application designed for visual tracking, deterministic correlation, and management of symptoms, potential triggers, and medication schedules across pets, children, and adults.

- Core Use Cases & Behavioral Contracts:
  1. Quick Event Logging, Editing & Deletion:
     - Creation: User drags a badge onto a calendar day (fine pointer) or selects it and taps/activates a day (any device, keyboard included), triggering `EventLogModal.vue`.
     - Time (required): the modal always stores a concrete instant. Default is the current time when the day is today, otherwise a part-of-day preset (Mañana 08:00, Mediodía 13:00, Tarde 18:00, Noche 22:00); the user can fine-tune with a time input (15-min steps). See ADR-016.
     - Custom Tracking Metrics: Depending on the item's definition, the user selects intensity (1: Mild, 2: Moderate, 3: Severe), logs duration in minutes, types sanitized notes (max 300 chars), and saves.
     - Modification / Removal: Clicking an existing event dot opens the modal in edit mode with prefilled values. The modal displays an explicit secondary destructive action ("Eliminar registro").
  2. Deterministic Correlation Discovery & Pattern Thresholds:
     - Computation: The client runs `detectCorrelations()` (shared module, also usable by the server) matching every symptom against prior triggers/medications occurring within a dynamically configured window (`0 <= diffHours <= correlation_window_hours`, strictly configurable per calendar: 2, 6, 12, 24, 36, or 48h).
     - Items are compared by lineage (`root_id`), so edited versions of an item count as the same item.
     - Visualization & Thresholds: Pairings are evaluated by occurrence frequency in the active period:
       - 3 to 6 occurrences: Flagged as "Vigilar posible patrón".
       - 7 or more occurrences: Flagged as "Patrón detectado".
  3. Parametric Analytics & Summaries:
     - Trigger: User clicks "Ver resúmenes" to open a parametric dashboard.
     - Configuration: Allows custom date-range selection and cross-filtering by specific subsets of triggers and symptoms to isolate specific pattern thresholds dynamically. Ranges older than the loaded 3 months are fetched on demand.
  4. Guest Mode Governance & Zero-Data-Loss Migration:
     - Demo Workflow: opening the app without a session shows a usable calendar of the current month. Events are tracked locally under `@cuidat_guest_v1`. There are no anonymous users on the server.
     - Guest Limitations (freemium incentive): 1 calendar profile; only the current month (month navigation, Quick Jump Navigator and the density selector are locked); a catalog capped at 3 symptoms plus 3 triggers/medication (6 items, counting the preset items; archived items still count, deleted ones free their slot). Any attempt to navigate or to create a seventh item (or a fourth of the same group) shows the warning "Opción no disponible sin iniciar sesión." with a "Crear cuenta" action that opens `AuthModal.vue`. Data from earlier months stays stored locally and is migrated on registration. These are client-side soft limits. (Future-date blocking is not a guest limitation: it applies to every user, see 8.)
     - Registration & Migration: `POST /api/auth/register` accepts an optional `guestData` payload. With the switch on, the user and the imported data are created in ONE transaction; the server validates the import with the normal rules (1 profile, max 3 symptoms and 3 triggers/medication, no future events, sanitized strings) and remaps every id to a fresh UUID. There is no separate upgrade endpoint.
     - Explicit Consent Migration (GDPR Art. 9): Registration includes a reactive switch: "Conservar y migrar datos locales existentes a mi cuenta" (enabled by default). If unchecked, the account is provisioned clean and `guestData` is not sent; the local guest data is dropped.
  5. Day Summary Drill-Down (Consultation vs. Normal Mode):
     - Trigger: Activating the "day" button of a calendar cell (it covers the empty area of the cell, see ADR-015) opens `DaySummaryModal.vue`, rendering a chronological breakdown of that date's logged events.
     - Mode Constraint: In Normal Mode, each row allows editing/deleting. In Consultation Mode (the global read-only mode of use case 12), editing actions are suppressed. The modal has no mode switch of its own (Phase 4.5).
  6. Calendar Profile Lifecycle Management:
     - Creation: Users can create dedicated profiles with distinct names, a user-defined profile type, avatar emojis, color themes, and custom correlation windows. The type is free text (1-50 chars, sanitized): the UI suggests Mascota, Niño/a and Adulto plus the types the user already created, and typing a new one creates it. It can be edited later like any other profile field. If a registered user has no profile (registration without migrated data), the app shows a "Crea tu primer calendario" onboarding that asks only for name and type (avatar, color and correlation window take defaults and can be edited later); when a guest profile was imported, no onboarding appears. The deletion invariant below prevents going back to zero.
     - Modification: Existing profiles can be edited via `ProfileEditModal.vue` (name, type, avatar, color theme, correlation window). Calendars are listed, switched, edited and created from the calendar menu centered in the header (`ProfileMenu.vue`); guests only have one, so "Nuevo calendario" shows the locked warning.
     - Color Theme as Identity (Phase 4.5): `color_theme` is one of `PROFILE_COLOR_THEMES` (`slate`, `peach`, `sky`, `mint`; enforced by the domain, the Zod schemas and a `CHECK` constraint). It identifies the calendar at a glance: it tints the avatar and the button of `ProfileMenu.vue` and a 4px top band of `CalendarPanel.vue`. It carries no clinical meaning.
     - Deletion: Profiles can be deleted via `DELETE /api/profiles/:id`.
     - Non-Zero Profile Invariant: UI and backend enforce `canDeleteProfile = profiles.length > 1`; the last remaining profile cannot be deleted.
  7. User Profile Lifecycle, Session State & GDPR Data Rights:
     - GDPR Portability (Art. 20): Authenticated users can invoke "Descargar mis datos" to trigger an immediate client-side download of their dataset as a JSON file.
     - GDPR Right to be Forgotten (Art. 17): Permanent account erasure via `DELETE /api/auth/account`. Requires typing "ELIMINAR" in a confirmation modal. Executes an atomic cascade deletion.
  8. Future Data Prevention (Clinical Integrity, ALL users):
     - UI Block: Navigation to future months is blocked. Days after the current local day are visually disabled. Attempting to interact with them triggers a warning Toast explaining the restriction.
     - API Block: the server rejects any `logged_at` later than `now() + 5 minutes` (clock-skew tolerance) with a `ValidationError`. Comparing instants keeps the rule independent of the user's timezone. For today, the time input is clamped to the current time.
  9. Catalog Lifecycle: Edit, Archive, Delete & Historical Integrity:
     - Users can modify items (symptoms, triggers, medications). To keep history, summaries and pattern studies consistent, each action has a fixed effect:

       | Action | Effect |
       | :--- | :--- |
       | Edit `name` / `emoji` | In place, applied to every version of the lineage (`root_id`) and therefore retroactive. A notice explains it. |
       | Edit `track_intensity` / `track_duration` | New version: the current row becomes `superseded`; a new `active` row is created with the same `root_id` and `parent_id = old.id`. Existing logs stay attached to the old version, untouched (`DaySummaryModal.vue` renders each log with its own version's fields). |
       | Edit `category` | Not allowed (control locked). To change it, create a new item. |
       | Archive | `status = 'archived'`. Hidden from the dock (listed in "Archivados" with "Restaurar"), cannot receive new logs, definition is read-only. Existing logs remain visible in the calendar and are included in analytics (filterable). Individual logs can still be deleted. |
       | Restore | `archived` -> `active`. |
       | Delete permanently | Offered next to "Archivar" after a warning that shows how many logs will be erased and requires explicit acceptance. Deletes every version of the lineage and, by cascade, all their logs across the calendar. Irreversible. |

     - Analytics and correlations group by `root_id`.
     - Temporal Pagination: The client defaults to fetching only the last 3 months of `health_event_logs` to ensure optimal main thread performance in Vue.
  10. System Resilience & Error Handling:
      - Global Error Boundary: The Vue application implements a global error handler to intercept runtime exceptions (e.g., unexpected correlation engine failures or rendering issues) and display a graceful `FallbackError.vue` UI, ensuring the application never crashes to a blank screen.
  11. Offline-First Event Logging (ADR-007):
      - Event creation, edition and deletion keep working without connection for authenticated users and are synced later. Profile and catalog mutations require connectivity in v1.
      - The header shows the sync state: "Modo Local" (guest), "Sincronizado", "Pendiente (N)", "Sin conexión".
  12. Global Consultation Mode (Phase 4.5, ADR-021):
      - Trigger: a "Modo consulta" switch (`role="switch"`) on the right of the filter row ("Ver todo / Solo síntomas / Solo triggers"). Available to guests and registered users. It always starts off and is not persisted (`useViewMode.ts`); it is reset by `reloadWorkspace()`.
      - Read-only workspace: the dock (`SidebarDock`) is not rendered and the calendar takes its space (2 columns from `lg`). Placement (select-then-place and drag-and-drop) is disabled. `DaySummaryModal` is read-only. Clicking an event opens its details in `EventDetailModal.vue` (item, date and time, intensity, duration, notes) without editable fields, "Guardar" or "Eliminar registro". `ProfileMenu` hides "Editar calendario" and "Nuevo calendario" (switching calendars stays), the catalog manager is not reachable and `AccountMenu` hides "Eliminar cuenta". Month navigation, density, filters, "Ver resúmenes", calendar switching and sign-out remain available.
      - Pattern Days: patterns are computed once over the whole visible range, with the same query as the insights rail (symptoms of the visible months, `1M`, `2M` or `3M`; triggers from one window before the oldest one; the calendar's window), so the marked days and the rail always agree. A day is marked when it holds a trigger/medication listed in `triggerEventIds` of a reported pattern, so the possible cause stands out at a glance: "Patrón detectado" (`peach`) takes precedence over "Vigilar posible patrón" (`sun`). Only trigger/medication days are marked (not the symptom days), in local time, independently of the active filter. Occurrences add up across the stacked months: a pair may reach a threshold only with `2M`/`3M`, and a trigger whose symptom falls in the next visible month is marked.
      - Non-Color Cue (WCAG 1.4.1 / 1.4.11): the band and border alone reach only about 1.1:1 (`sun`) and 1.3:1 (`peach`) against `canvas`, so every marked day also shows an icon badge (`Eye` / `TriangleAlert`) and its day button's `aria-label` ends with "· Vigilar posible patrón" or "· Patrón detectado". A legend explains both marks.
      - Toggling announces "Modo consulta activado" / "Modo consulta desactivado" through `aria-live="polite"`.
  13. Saved Reports (Phase 4.6, registered users only): "Guardar informe" in "Ver resúmenes" stores an immutable report of the chosen period and selection (at most 5 per user); "Informes guardados" in the account menu shows them, downloads them as PDF or deletes them. Design in section 9.

- Dynamic Dock & Catalog Management:
  - Preset catalog (`PRESET_ITEMS`, `shared/src/presets.ts`): 6 sample items: symptoms Vómito, Heces blandas, Malestar / dolor; triggers Pescado and Lácteos; medication Medicación. The guest profile is seeded with them on first load so visitors can try the app (they fill the guest limits, so a custom item needs a deleted slot or an account). Registered profiles start with an empty dock and an empty state that offers "Añadir ítems de ejemplo" (`POST /api/profiles/:profileId/items/presets`, one transaction). Guests who register with migration keep the items they have. Presets are normal items: editable, archivable and deletable. Registered users have no limits.
  - Configuration: When creating items, users select a `category` (`symptom`, `trigger` or `medication`) and toggle `track_intensity` and `track_duration` booleans to define what data to collect for that specific item.
  - Lifecycle: governed by the table in use case 9.

---

## 2. Design System, UI Tokens & Interaction Patterns

### Design Tokens (Tailwind CSS 3 Extension, `tailwind.config.js`)
- Values live in `client/src/theme/palette.ts`, the single source for `tailwind.config.js` and for the PDF reports (which cannot use classes).
- slate (scale, DEFAULT = 600 = #496580): Primary brand token. Core typography, structural boundaries, and active borders.
  - 50 #F3F6F9, 100 #E5EBF1, 200 #CBD6E0, 300 #A8B9C8, 400 #7E97AC, 500 #5F7C94, 600/DEFAULT #496580, 700 #3B5167, 800 #2F4153, 900 #243242, 950 #172029.
- peach (#FFDBBB): Warning & Symptom accent. Applied to symptoms and to "Patrón detectado" (insights cards and consultation day marks).
- sun (#FFF3BA): Pattern watch accent. Used only for "Vigilar posible patrón" (insights cards and consultation day marks), never for item categories (Phase 4.5).
- sky (#BADDFF): Informational surface. Applied to medication.
- mint (#BAFFF5): Positive trigger & confirmation accent. Applied to triggers/foods.
- tint (#E6F4FE): Soft contextual backgrounds.
- canvas (#FDFDFD): Clean base canvas, calendar day cells and "white" surfaces (there is no `bg-white`).
- danger (DEFAULT #DC2626, dark #B91C1C): Destructive actions only.
- Contrast rule (WCAG AA, measured): `text-slate` (#496580) reaches >= 4.5:1 on canvas, tint, mint, peach, sun and slate-100, but only 4.3:1 on sky. Text placed on `peach`, `sun`, `sky` or `mint` badges therefore uses `text-slate-800` (>= 7:1; 9.4:1 on sun). As non-text marks on `canvas`, the soft tokens stay below 3:1 (WCAG 1.4.11), so they never convey information on their own: an icon and accessible text go with them.
- Typography: Nunito Sans (variable), self-hosted through `@fontsource-variable/nunito-sans` (no request to Google Fonts, GDPR). `font-sans` maps to `"Nunito Sans Variable"`.

### Quick Jump Navigator & View Density
- Quick Jump Navigator (`DateNavigatorPopover.vue`): The month label in the header acts as a popover trigger with a year stepper and 12-month grid. Guests: locked (shows the "Opción no disponible sin iniciar sesión." warning). Future months are never selectable.
- Multi-Month Density Selector: Segmented control (`1M | 2M | 3M`). Allows stacked consecutive months to visualize long-term trends without hiding any event rows. Guests: locked at `1M`. The active month is shown first and the previous ones below it (a future month never exists).

### Workspace Layout & Interaction (Tailwind default breakpoints)
- `lg` (>= 1024px): 3-column grid. Left Rail (232px) for Dock, Center Stage (1fr) for CalendarGrid, Right Rail (276px) for Insights and Pattern Thresholds. In Consultation Mode the Left Rail is removed: 2 columns (1fr, 276px).
- `< lg`: single-column stacked layout (Dock, Calendar, Insights; no Dock in Consultation Mode).
- Header (`AppHeader.vue`): from `md`, three zones (`grid-cols-[1fr_auto_1fr]`): logo left, calendar menu (`ProfileMenu.vue`) centered, sync badge and account right. Below `md`, two rows: logo with badge and account, then the calendar menu centered.
- Insights rail: "Vigilar posible patrón" cards on `sun`, "Patrón detectado" cards on `peach`, both with `text-slate-800`, an icon (`Eye` / `TriangleAlert`) and the occurrence count highlighted. The rail describes the visible months in either mode (patterns and log counts): its title reads "Resumen de octubre" with `1M` and "Resumen de agosto a octubre" with `3M`.
- Interaction does not depend on width but on input capability:
  - Select-then-place (tap/keyboard/mouse) is available everywhere: a dock item is a toggle button (`aria-pressed`); activating a valid day opens `EventLogModal.vue`.
  - HTML5 Drag-and-Drop is a pointer-only enhancement, enabled only when `matchMedia('(hover: hover) and (pointer: fine)')` matches (`useInteraction.ts`).

---

## 3. Technology Stack & Workspace Architecture
- Monorepo Structure: npm workspaces `shared`, `client`, `server` at the repository root; packages named `@cuidat/shared`, `@cuidat/client`, `@cuidat/server`.
- Client: Vue 3 (Composition API), Vite, Pinia, Tailwind CSS 3.4 (+ PostCSS, Autoprefixer), dayjs, `@lucide/vue` (successor of the deprecated `lucide-vue-next`), dompurify, native HTML5 Drag-and-Drop (no library), vite-plugin-pwa (build only, devDependency), localforage, `@fontsource-variable/nunito-sans`, `@sentry/vue`, `pdfmake` (saved reports, lazy-loaded) with `@fontsource/nunito-sans` (its static WOFF fonts). Type checking with `vue-tsc`. TypeScript is pinned to `~6.0` in every package: TypeScript 7 (native) is not yet supported by `typescript-eslint` nor `vue-tsc`.
- Server: Node.js, Express, TypeScript, Zod, pg, bcrypt, jsonwebtoken, helmet, cors, cookie-parser, dotenv, express-rate-limit, `@sentry/node`.
- Persistence: PostgreSQL on Neon only (no local PostgreSQL), with strict multi-tenant isolation via composite keys. Initially a single branch, `main`, hosts the existing database (hard-reset once, ADR-014). Before real users arrive, branches `dev` (development) and `test` (E2E/CI, resettable) are created from it.
- Quality: Vitest (+ coverage-v8), `@playwright/test`, ESLint (flat config), Husky + lint-staged + commitlint.
- CI/CD & Security: GitHub Actions, Snyk (dependency scanning).
- Observability: Sentry (Error tracking and performance monitoring).
- Containerization & Deployment: a single multi-stage Dockerfile builds `shared`, `client` and `server`; in production Express serves the built client (`client/dist`, SPA fallback) and the API from the same origin. `docker-compose.yml` runs that image against Neon locally (ADR-010, ADR-019). The CI builds and publishes the image; production runs on Render (free web service, ADR-019).

### 3.1 Clean Architecture Layout
Dependency rule: outer layers depend on inner layers, never the reverse. Business rules live in `shared` / `domain`, never in components or controllers.

| Package | Layer | Responsibility |
| :--- | :--- | :--- |
| `shared/src` | Domain kernel | Types, constants (`CORRELATION_WINDOWS`), Zod schemas, `correlation.ts`, `catalog.ts` (item edit rules), `time.ts`, `presets.ts`. No Vue/Express imports. |
| `server/src/domain` | Domain | Entities, `AppError` hierarchy, repository interfaces (ports). |
| `server/src/application` | Use cases | `RegisterUser` (with the guest import), `LogEvent`, `EditCatalogItem`, `DeleteAccount`... Depend on ports only. |
| `server/src/infrastructure` | Adapters | pg repositories, bcrypt/JWT adapters, migrations (`db/`), Sentry. |
| `server/src/interfaces/http` | Delivery | Routes, controllers, Zod validation, middleware (auth, rate limit, error mapper). Composition root in `server/src/main.ts`. |
| `client/src/application` | Use cases | Pinia stores, composables (`useCalendar`, `useInteraction`, `useMultiMonth`, `useViewMode`), sync use cases. Depend on repository ports. |
| `client/src/infrastructure` | Adapters | `LocalEventRepository` (guest, localStorage), `ApiEventRepository` (fetch), `SyncQueue` (localforage), API client, Sentry init. |
| `client/src/presentation` | UI | Components, views, layouts, toasts. |

The store picks the repository implementation by `authMode` (`guest` -> local, `authenticated` -> API + sync queue).

---

## 4. Environment Configuration (.env.example)

# Frontend (client/.env.example)
# Empty (default): requests go to /api on the same origin; in development the Vite proxy sends them
# to http://localhost:3000. Set it only to call an API on another origin.
VITE_API_URL=
VITE_SENTRY_DSN=

# Backend (server/.env.example)
PORT=3000
# Development: the Vite origin. Production: the public URL of the service (on Render it defaults to RENDER_EXTERNAL_URL).
CLIENT_ORIGIN=http://localhost:5173
# true in the container image: Express serves client/dist and falls back to index.html
SERVE_CLIENT=false
# Neon pooled connection (host contains "-pooler"): used by the API at runtime
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=verify-full
# Neon direct connection: used by db:migrate and db:reset
DATABASE_URL_DIRECT=postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=verify-full
JWT_SECRET=replace_with_at_least_32_random_characters
JWT_EXPIRES_IN=24h
AUTH_RATE_LIMIT_MAX=20
SENTRY_DSN=
# Only true for the one-time reset of main, or on dev/test branches. Back to false right after.
ALLOW_DB_RESET=false

---

## 5. Relational Database Schema (PostgreSQL DDL)

Single source: `docs/neon/001_init.sql` (copied to `server/src/db/migrations/001_init.sql`); keep both identical. It was validated against PostgreSQL 16 with `docs/neon/smoke_test.sql`. Identifiers of profiles, items and logs are generated client-side (`crypto.randomUUID()`) so offline writes are idempotent; the guest import remaps ids on the server. Invariants enforced by the schema: lowercase unique email; non-empty free-text `profile_type`, valid `category`, windows, intensity and duration; `color_theme` limited to the palette (`slate`, `peach`, `sky`, `mint`; added by `002_color_theme_check.sql`, the first migration after `001_init`); non-blank notes (max 300); composite foreign keys that prevent cross-calendar references (items, parent, root, logs); one live version per item lineage; lineage rule (original <=> no parent); cascade deletes (user -> profiles -> items/logs; root item -> all its versions and logs).

Rules that a CHECK cannot express are enforced by triggers in the same migration (the server validates them first, these are the last barrier):
- `check_log_metrics`: a log stores intensity only if its item version tracks intensity, and duration only if it tracks duration.
- `check_log_not_future`: `logged_at` may not be later than `now() + 5 minutes` on insert, or when `logged_at` changes (edits of old logs are not blocked).
- `check_item_update`: `id`, `calendar_id`, `root_id`, `parent_id`, `category`, `track_intensity`, `track_duration` and `created_at` are immutable. Changing the tracking shape means: mark the live version `superseded`, then insert the new version (in that order, because of the partial unique index). A `superseded` version is terminal.

Not enforced by the schema, on purpose: archived or superseded items refusing new logs. Online creation is refused by the API. A log that arrives from the sync queue is accepted whatever the status of its item, because the user recorded it while the item was valid (ADR-007).

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calendar_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL CHECK (length(btrim(name)) > 0),
    profile_type VARCHAR(50) NOT NULL CHECK (length(btrim(profile_type)) > 0), -- texto libre definido por el usuario
    avatar_icon VARCHAR(50) NOT NULL DEFAULT '👤',
    color_theme VARCHAR(50) NOT NULL DEFAULT 'slate', -- CHECK de la paleta en 002_color_theme_check.sql
    correlation_window_hours SMALLINT NOT NULL DEFAULT 48
        CHECK (correlation_window_hours IN (2, 6, 12, 24, 36, 48)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_user ON calendar_profiles(user_id);

CREATE TABLE health_item_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendar_profiles(id) ON DELETE CASCADE,
    root_id UUID NOT NULL,   -- id de la primera versión (= id en los originales)
    parent_id UUID,          -- versión anterior (NULL en los originales)
    name VARCHAR(100) NOT NULL CHECK (length(btrim(name)) > 0),
    emoji VARCHAR(10) NOT NULL CHECK (length(btrim(emoji)) > 0),
    category VARCHAR(50) NOT NULL CHECK (category IN ('symptom', 'trigger', 'medication')),
    track_intensity BOOLEAN NOT NULL DEFAULT TRUE,
    track_duration BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'superseded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_calendar UNIQUE (id, calendar_id),
    -- Original <=> sin padre. Una versión posterior siempre tiene padre.
    CONSTRAINT ck_item_lineage CHECK ((id = root_id) = (parent_id IS NULL)),
    -- Padre y raíz deben pertenecer al mismo calendario.
    CONSTRAINT fk_item_parent FOREIGN KEY (parent_id, calendar_id)
        REFERENCES health_item_definitions(id, calendar_id) ON DELETE CASCADE,
    -- Borrar la raíz elimina todo el linaje (y, en cascada, sus registros).
    CONSTRAINT fk_item_root FOREIGN KEY (root_id, calendar_id)
        REFERENCES health_item_definitions(id, calendar_id) ON DELETE CASCADE
);

CREATE INDEX idx_items_calendar_status ON health_item_definitions(calendar_id, status);
CREATE INDEX idx_items_root ON health_item_definitions(calendar_id, root_id);
CREATE INDEX idx_items_parent ON health_item_definitions(parent_id);
-- Como mucho una versión vigente (active o archived) por linaje.
CREATE UNIQUE INDEX uq_item_live_version ON health_item_definitions(root_id) WHERE status <> 'superseded';

CREATE TABLE health_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendar_profiles(id) ON DELETE CASCADE,
    item_definition_id UUID NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL,
    intensity SMALLINT CHECK (intensity BETWEEN 1 AND 3),
    duration_minutes INTEGER CHECK (duration_minutes BETWEEN 1 AND 1440),
    notes VARCHAR(300) CHECK (notes IS NULL OR length(btrim(notes)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- last-write-wins en la sincronización offline
    CONSTRAINT fk_logs_item_calendar FOREIGN KEY (item_definition_id, calendar_id)
        REFERENCES health_item_definitions(id, calendar_id) ON DELETE CASCADE
);

CREATE INDEX idx_logs_calendar_date ON health_event_logs(calendar_id, logged_at);
CREATE INDEX idx_logs_item ON health_event_logs(item_definition_id);

---

## 6. Deterministic Correlation Algorithm & Thresholds
File: shared/src/correlation.ts

export interface HealthEvent {
  id: string;
  itemDefinitionId: string;
  rootItemId: string; // lineage id (root_id)
  category: 'symptom' | 'trigger' | 'medication';
  loggedAt: string; // ISO 8601 UTC
  createdAt: string; // ISO 8601 UTC, tie-breaker
}

export interface PatternThreshold {
  triggerRootId: string;
  symptomRootId: string;
  occurrences: number; // always symptomEventIds.length
  category: 'Vigilar posible patrón' | 'Patrón detectado';
  symptomEventIds: string[]; // symptoms counted as occurrences, in the stable order of step 1
  triggerEventIds: string[]; // triggers/medication that preceded a counted symptom within the window, in the same order (Phase 4.5: consultation day marks, the possible cause)
}

// The algorithm must:
// 1. Sort events by (loggedAt, createdAt, id) so the result is stable.
// 2. Iterate over triggers/medications and symptoms (by category).
// 3. Validate deltaHours = symptom.loggedAt - trigger.loggedAt, with 0 <= deltaHours <= calendar.correlation_window_hours.
//    deltaHours === 0 (identical instants) is a match: the order is assumed trigger -> symptom.
// 4. Group valid matches by unique pair (triggerRootId - symptomRootId).
// 5. Count occurrences per pair: one occurrence per symptom event that has at least one matching trigger event of that trigger lineage in the window.
// 6. Categorize: 3 to 6 occurrences -> 'Vigilar posible patrón'. >= 7 occurrences -> 'Patrón detectado'. Fewer than 3 are not reported.

---

## 7. Multi-Tenancy, Security & Governance

- Timezone Governance: All timestamps are stored in UTC (ISO 8601 with `Z`). Local timezone conversion occurs strictly at the presentation layer via `dayjs`.
- Repository-Level Isolation: Tables without `user_id` are always reached through a join to `calendar_profiles`:
  SELECT l.* FROM health_event_logs l
  JOIN calendar_profiles p ON l.calendar_id = p.id
  WHERE p.user_id = $current_user_id AND l.calendar_id = $calendar_id;
- Input Sanitization: Free-text inputs (notes, item names) are sanitized in the client with `sanitizeText()` (DOMPurify, returning plain text) before length validation. The server trims, validates length with Zod and stores plain text. Text is always rendered through Vue interpolation; `v-html` is forbidden.
- Rate Limiting: whole router protected. `POST /api/auth/register` and `POST /api/auth/login`: `AUTH_RATE_LIMIT_MAX` requests (default 20) per IP every 15 minutes. Everything else, including `DELETE /api/auth/account`: 100 requests per minute per IP. Express runs with `trust proxy` configured so the limiter sees the real client IP behind Neon-hosted/containerized deployments.
- Session: the JWT travels in an `httpOnly` cookie `cuidat_session` (`Secure` in production, `SameSite=Lax`, lifetime `JWT_EXPIRES_IN`, 24 hours by default: a stolen token is useful for less time), never in `localStorage`. `POST /api/auth/logout` clears it, and `GET /api/auth/me` restores the session on load. CORS allows credentials only for `CLIENT_ORIGIN`, and the client sends `credentials: 'include'`. CSRF: state-changing requests must carry the header `X-CuidaT-Client: web` (forces a CORS preflight) and an `Origin` equal to `CLIENT_ORIGIN`. Client and API must share the same site (e.g. `app.example.com` and `api.example.com`, or one reverse proxy); `localhost` ports count as the same site in development.
- Observability Privacy: Sentry never receives health data (see ADR-012).
- GDPR Compliance: Client-side JSON export for Art. 20 (calendars, items, logs and saved reports). Atomic cascade deletion for Art. 17 (saved reports included).

---

## 8. Architectural Decision Records (ADRs)

- ADR-001: Deterministic Math Engine for Correlation
  - Decision: Pure deterministic algorithm with 100% unit test coverage based on dynamically configured time windows per profile, grouped by item lineage.
- ADR-002: Client-Side GDPR Portability & Atomic Right to Be Forgotten
  - Decision: Client-side JSON export for Art. 20; transactional cascading delete for Art. 17.
- ADR-003: Non-Zero Calendar Profile Invariant
  - Decision: Expose `canDeleteProfile = profiles.length > 1`; deletion is disabled in the UI and rejected by the API otherwise.
- ADR-004: Zero Hidden Clinical Data via Dynamic Cell Expansion
  - Decision: Day cells dynamically expand vertically (`min-h-[110px] h-full`). Conventional truncation ("+X más") is prohibited.
- ADR-005: Composite Keys for Multi-Tenant Integrity
  - Decision: Enforce `UNIQUE (id, calendar_id)` on items and a composite foreign key on logs to strictly prevent cross-calendar data corruption.
- ADR-006: Catalog Lifecycle: Versioning, Archive and Cascade Delete
  - Decision: Only edits that change the shape of the recorded data (`track_intensity`, `track_duration`) create a new version (`status = 'superseded'` for the old one, same `root_id`, `parent_id` link). Cosmetic edits (`name`, `emoji`) apply to the whole lineage; `category` is immutable. Removing an item is either Archive (reversible, history kept, definition locked) or Permanent Delete (warning + acceptance, cascades to logs). Analytics group by `root_id`.
- ADR-007: Offline-First Sync Without Background Sync API
  - Decision: The Background Sync API is Chromium-only, so it is at most a progressive enhancement. The core is an application-level mutation queue in IndexedDB (LocalForage, key `@cuidat_sync_queue_v1`) for event logs: entries `{ opId, type: 'upsert' | 'delete', entityId, payload, createdAt, attempts }`. Entities use client-generated UUIDs and the API is idempotent (`PUT /events/:id` upserts, `DELETE` ignores missing rows). The queue is coalesced (upsert+upsert merges, create+delete cancels) and flushed on app start, on the `online` event, on `visibilitychange` to visible, after each local mutation when online, and by an exponential-backoff timer (5 s up to 5 min) while the app is open. Conflicts resolve last-write-wins on `updated_at`. The client sends `updated_at` with each queued operation (the instant of the mutation); the server clamps it to `now() + 5 minutes` before comparing. Queued logs for archived or superseded items are accepted; only online creation is refused. 4xx responses move the entry to a dead-letter list and notify the user; network/5xx errors retry.
  - Rate limiting: see section 7.
- ADR-008: Mandatory E2E Coverage for GDPR Destructive Workflows
  - Decision: Critical privacy flows, specifically the Art. 17 right to be forgotten (account deletion), must be strictly covered by Playwright E2E tests to ensure destructive operations function flawlessly and client state is completely purged.
- ADR-009: Global Error Boundary
  - Decision: Implement Vue's `app.config.errorHandler` coupled with a fallback component to intercept uncaught exceptions, maintaining a robust and trustworthy user experience in a health-tracking context.
- ADR-010: Neon-Only Persistence, Containerized Backend
  - Decision: Neon is the only database, so there is no local PostgreSQL and no SSL mismatch (`sslmode=verify-full` everywhere: the server checks the certificate, not only the TLS channel). The existing database is the `main` branch and is hard-reset once; `dev` (development) and `test` (E2E/CI, resettable) branches are created from `main` afterwards. `main` is never reset again. `server/Dockerfile` (build context: repo root, because of `shared`) and `docker-compose.yml` containerize the Express backend, reading `server/.env`.
- ADR-019: Single-Origin Deployment
  - Decision: Production runs as one container where Express serves both the API (`/api`) and the built SPA. Same origin means the `SameSite=Lax` session cookie works in every browser, no CORS in production and one URL to share. GitHub Pages is not used for the client because it cannot run the API and a different site would turn the cookie into a third-party cookie (blocked by Safari and Firefox). GitHub hosts the code, the CI/CD and the container registry; any host that runs a Docker image can serve it. Chosen host: Render free web service (Docker runtime, `render.yaml` blueprint, EU region, `healthCheckPath: /api/health`, auto-deploy from `main`). The free instance spins down after about 15 minutes without traffic and takes roughly a minute to wake up, so the README warns about it and a scheduled GitHub Actions request to `/api/health` may keep it warm. The container runs `db:migrate` (idempotent) before starting the server, because the free plan has no pre-deploy command. `CLIENT_ORIGIN` falls back to Render's `RENDER_EXTERNAL_URL` when unset.
- ADR-011: Strict Quality Gates via Husky
  - Decision: `pre-commit` runs `lint-staged`, `npm run typecheck` and `npm run test:unit`; `commit-msg` runs commitlint (Conventional Commits). `typecheck` = `tsc` for shared/server and `vue-tsc` for the client, so `.vue` files are checked.
- ADR-012: Full-Stack Observability via Sentry
  - Decision: Integrate Sentry SDKs in both Vue (client) and Express (server) to trace unhandled exceptions, monitor release health, and demonstrate production-readiness. Health data is special-category data (GDPR Art. 9), so: EU data region DSN, `dataCollection` with every switch off (`userInfo`, `cookies`, `httpHeaders`, `httpBodies: []`, `urlQueryParams`, `stackFrameVariables`; Sentry 11 replaced `sendDefaultPii` with this object), `attachErrorHandler: false` (errors are reported from `app.config.errorHandler`), no Session Replay, `beforeSend`/`beforeBreadcrumb` scrubbers that drop request bodies, notes, item names, query strings, console breadcrumbs and UI breadcrumbs (their `aria-label` holds item names and dates), and keep only the payload of fetch breadcrumbs without query strings, and the only user identifier is the opaque user UUID (never email). Low `tracesSampleRate`.
- ADR-013: Clean Architecture Layout
  - Decision: Layers and dependency rule as defined in section 3.1.
- ADR-014: Database Lifecycle (Hard Reset Once, Migrate Afterwards)
  - Decision: The first creation of the schema on Neon is `docs/neon/reset.sql` + `001_init.sql` + `register_001.sql` + `smoke_test.sql` (or `npm run db:reset` once the server exists). `db:migrate` applies forward-only SQL files from `server/src/db/migrations/` and records them in `schema_migrations`; it is idempotent and never deletes data. `db:reset` is a separate, destructive command (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + extension + migrate) that refuses to run unless `ALLOW_DB_RESET=true` and `--yes` are present, and prints the target host first. The existing Neon database gets one hard reset to adopt the new schema; from then on only `db:migrate` is used.
- ADR-015: Accessible Interaction Model
  - Decision: Select-then-place is the universal path; Drag-and-Drop is a pointer-only enhancement. A calendar cell is a non-interactive container holding (a) a "day" `<button>` stretched over the whole cell (`after:absolute after:inset-0`), which opens `DaySummaryModal.vue`, and (b) event dots as sibling `<button>`s raised above it (`relative z-10`). No nested interactive elements, no `div @click`. Modals trap focus and restore it on close; toasts use `aria-live="polite"`.
- ADR-016: Event Time Model
  - Decision: Every log stores a concrete UTC instant chosen by the user (preset or time input). Order is `(logged_at, created_at, id)`. Approximation is expressed by the preset, not by a separate field.
- ADR-017: Cookie-Based Session
  - Decision: See section 7 (Session). Chosen over `localStorage` tokens because health data warrants that an XSS cannot exfiltrate the credential.
- ADR-018: Freemium Guest Model
  - Decision: Guests get a usable current-month calendar, 1 profile and a catalog of at most 3 symptoms + 3 triggers/medication (the 6 preset items fill it); month navigation and more items are gated behind registration with the message "Opción no disponible sin iniciar sesión." Limits are soft (client-side) and only an incentive; registered users have no such limits. Guest data is imported in the same transaction that creates the account.
- ADR-020: Accepted Residual Risk for Unencrypted Guest Data
  - Context: guest data is health data stored in `localStorage` (`@cuidat_guest_v1`) without encryption. A guest has no password, so any key kept on the device sits next to the data and offers no protection against code running in the same origin.
  - Decision: accept the risk for guest mode and do not add client-side encryption. The controls are: input sanitization and no `v-html`/`innerHTML` (OWASP A03), a Content Security Policy that allows only same-origin scripts (set by Helmet in Phase 3), no third-party scripts or resources, and a privacy notice that explains that guest data stays in the browser.
  - Registered users: their data is sent over TLS and stored on the server (Neon encrypts at rest). After a successful registration with migration, or an account deletion, the client removes `@cuidat_guest_v1` and `@cuidat_guest_v1.corrupto`.
  - Review: reopen this decision if guest mode is offered to users who cannot use the browser's own protections, or if CSP cannot be enforced.
- ADR-021: Consultation Mode Is a Presentation State
  - Context: during a medical visit the device may be handed to a clinician, so editing must be out of reach and patterns must stand out.
  - Decision: Consultation Mode is a client-side view state (`useViewMode.ts`), global to the workspace, off on every start and never persisted, so nobody finds the app locked without knowing why. It removes editing affordances from the UI; it is not an authorization control, and the API keeps applying the same rules to every request. Pattern day marks reuse `detectCorrelations()` (its `triggerEventIds`: the days of the possible cause), so the calendar, the insights rail and the saved reports share one engine.
- ADR-022: Server-Built Report Snapshots, Client-Rendered PDF
  - Decision: see section 9.1. Reports are immutable JSON snapshots computed by the server from validated parameters with the shared engine; the browser renders both the on-screen view and the PDF from the same snapshot. No PDF binaries are stored and no health data is sent to third-party rendering services.

---

## 9. Saved Reports (Phase 4.6, registered users only)

### 9.1 Design
- Content: an immutable snapshot of one calendar over a period, built from the selection made in "Ver resúmenes" (`ReportSnapshot`, Zod `reportSnapshotSchema`): `calendar` (name, type, avatar, color theme, correlation window), `period`, `items` (selected lineages, symptoms first, with name, emoji, category and archived flag frozen at generation), `patterns` (detected first, then by occurrences), `itemStats` (log count, intensity distribution and mean, total and mean duration; metrics an item version does not track are dropped), `days` (only days with logs: time, item, intensity, duration, notes and the consultation mark of the day) and `months` (for the mini calendars).
- Generation: `POST /api/reports` receives `{ calendarId, from, to, timeZone, symptomRootIds, triggerRootIds, title? }` (Zod `reportCreateSchema`: `from <= to`, at most `REPORT_MAX_MONTHS = 12`, IANA time zone validated with `Intl`, at least one lineage, trimmed title of up to 120 characters; the client also sanitizes it). The server rejects a period ending after today in that time zone (`REPORT_FUTURE_PERIOD`), loads the logs from one correlation window before the first local day to the end of the last one (`reportRange`) through the usual user-scoped repositories, and runs the pure `buildReportSnapshot()` from `shared/src/reports.ts` (100% unit coverage). Days are grouped by the user's local day (`shared/src/time.ts`, DST-safe). A lineage outside the calendar or of the wrong group answers 400 `INVALID_INPUT`. Snapshots carry `schemaVersion`; over `REPORT_SNAPSHOT_MAX_BYTES` (1 MB) the answer is 413 `REPORT_TOO_LARGE`. Default title: "Informe de {nombre}". The client never uploads a snapshot or a file.
- Storage (`003_health_reports.sql`):
  CREATE TABLE health_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      calendar_id UUID NOT NULL REFERENCES calendar_profiles(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL CHECK (length(btrim(title)) > 0),
      period_from DATE NOT NULL,
      period_to DATE NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT ck_report_period CHECK (period_to >= period_from)
  );
  CREATE INDEX idx_reports_calendar ON health_reports(calendar_id);
  Access always joins `calendar_profiles` on `user_id`; another user's report answers 404. DATE columns are read as text, never through the driver's local-time `Date`.
- Limit: `REPORTS_MAX_PER_USER = 5`, checked in the creation transaction after locking the user row (`SELECT ... FOR UPDATE`), so concurrent requests cannot exceed it. Over the limit: 409 `REPORT_LIMIT` ("Has alcanzado el máximo de 5 informes. Elimina uno para guardar otro.").
- API (session required): `GET /api/reports` (metadata only, newest first), `POST /api/reports` (201 with the metadata), `GET /api/reports/:id` (with the snapshot), `DELETE /api/reports/:id` (204).
- Client: `ReportRepository` port with `ApiReportRepository` (online only, answers validated with Zod; `null` for guests) and `useReportStore` (metadata only, `resetState()` on every workspace reload). `SaveReportForm.vue` ("Guardar como informe") sits in `CorrelationFilterModal.vue` with an optional title and "N de 5"; guests get the locked warning, and when offline or full the form says why the button is disabled. "Informes guardados" in `AccountMenu.vue` opens `ReportsModal.vue` ("Ver", "Descargar PDF" and "Eliminar" with confirmation). The form states what will be included ("Incluirá N síntomas y M triggers o medicaciones: lo que desmarques arriba no aparecerá en el informe"): only the checked lineages are in the report. `ReportViewModal.vue` (`ReportPatternList`, `ReportStatsList`, `ReportItemLegend`, `ReportMiniMonth`, `ReportDayList`) renders only from the snapshot, never from the stores. In Consultation Mode reports can be saved, viewed and downloaded, but not deleted. Wording shared by the view and the PDF lives in `client/src/application/reportFormat.ts`.
- PDF: `pdfmake` (MIT), loaded with a dynamic import on "Descargar PDF" and excluded from the PWA precache (`workbox.globIgnores`). Font: Nunito Sans (SIL OFL) from `@fontsource/nunito-sans` (WOFF, latin subset, weights 400 and 800), served from our own origin. The subset has no emoji nor arrows: a pattern reads "Pescado, seguido de Vómito", and each item's emoji is drawn by the browser on a canvas with the device's emoji font and embedded as a PNG (the item's initial when it cannot be drawn), so the mini calendars show one icon per log, with a legend of the items, as on screen. Characters outside the subset typed in notes print as blanks. A threshold without patterns keeps its color ("Ninguno en este periodo." on `sun` / `peach`). Colors come from `client/src/theme/palette.ts`, shared with `tailwind.config.js`. A month's title and grid form one unbreakable block. Download through a Blob URL revoked right away. Verified under the production Helmet CSP (`script-src 'self'`, no `'unsafe-eval'`): pdfmake only tries `new Function` inside a guarded fallback.
- GDPR: reports cascade with their calendar and with the account (Art. 17) and are part of "Descargar mis datos" (Art. 20, field `reports` with the snapshots). Report bodies never reach Sentry (ADR-012).
- Calendar deletion: the confirmation step of `ProfileDeleteSection.vue` counts the calendar's reports (from the `GET /api/reports` metadata; guests have none). Without reports: "¿Seguro que quieres eliminar «{nombre}»? También se borrarán sus ítems y todos sus registros. Esta acción no se puede deshacer." With reports: "¿Seguro que quieres eliminar «{nombre}»? También se borrarán sus ítems, todos sus registros y {el informe guardado | los N informes guardados} de este calendario. Si quieres {conservarlo, descárgalo | conservarlos, descárgalos} en PDF antes de continuar. Esta acción no se puede deshacer."

---

## 10. Planned After Deployment (Post-Phase)

Designs agreed for after Phase 5. They are not implemented yet; each one is delivered in its own branch and pull request (see the "Post-fase" section of the prompts guide).

### 10.1 Cumulative Highlighting Across Stacked Months (done)
- Implemented in both modes, not only Consultation Mode: patterns are computed over the whole visible range (start of the oldest month minus the window, to the end of the newest), and the insights rail describes that same range (its title states it). See use case 12 and the insights rail in section 2.

### 10.2 Password Recovery (blocked until a custom domain is available)
- Neon Auth (managed Better Auth) was evaluated and discarded: it replaces the existing auth stack, sends Neon-branded emails by default and needs a custom SMTP in production. CuidaT keeps its own auth and sends mail through Resend (free tier), which requires a verified custom domain.
- `004_password_reset.sql`: `password_reset_tokens (id, user_id ON DELETE CASCADE, token_hash, expires_at, used_at)` storing only the SHA-256 of a random token valid for 30 minutes, plus `users.password_changed_at`.
- `POST /api/auth/password/forgot` always answers 202 with the same message and comparable timing (no account enumeration), shares the auth rate limit and invalidates earlier tokens. `POST /api/auth/password/reset` checks the token (exists, not expired, not used), stores the new bcrypt hash, marks the token used and sets `password_changed_at` in one transaction; the session middleware rejects JWTs issued before `password_changed_at`, which ends existing sessions despite stateless tokens.
- Mail through an `EmailSender` port (`ResendEmailSender`, `ConsoleEmailSender` for development and tests that never logs tokens in production); env `RESEND_API_KEY`, `EMAIL_FROM`; no health data in emails. The link is `{CLIENT_ORIGIN}/restablecer#token=...`: in the fragment, the token never reaches server logs or the `Referer` header.
