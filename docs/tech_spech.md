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
     - Mode Constraint: In Normal Mode, each row allows editing/deleting. In Consultation Mode (read-only mode for medical visits), editing actions are suppressed.
  6. Calendar Profile Lifecycle Management:
     - Creation: Users can create dedicated profiles with distinct names, a user-defined profile type, avatar emojis, color themes, and custom correlation windows. The type is free text (1-50 chars, sanitized): the UI suggests Mascota, Niño/a and Adulto plus the types the user already created, and typing a new one creates it. It can be edited later like any other profile field. If a registered user has no profile (registration without migrated data), the app shows a "Crea tu primer calendario" onboarding that asks only for name and type (avatar, color and correlation window take defaults and can be edited later); when a guest profile was imported, no onboarding appears. The deletion invariant below prevents going back to zero.
     - Modification: Existing profiles can be edited via `ProfileEditModal.vue`.
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

- Dynamic Dock & Catalog Management:
  - Preset catalog (`PRESET_ITEMS`, `shared/src/presets.ts`): 6 sample items: symptoms Vómito, Heces blandas, Malestar / dolor; triggers Pescado and Lácteos; medication Medicación. The guest profile is seeded with them on first load so visitors can try the app (they fill the guest limits, so a custom item needs a deleted slot or an account). Registered profiles start with an empty dock and an empty state that offers "Añadir ítems de ejemplo" (`POST /api/profiles/:profileId/items/presets`, one transaction). Guests who register with migration keep the items they have. Presets are normal items: editable, archivable and deletable. Registered users have no limits.
  - Configuration: When creating items, users select a `category` (`symptom`, `trigger` or `medication`) and toggle `track_intensity` and `track_duration` booleans to define what data to collect for that specific item.
  - Lifecycle: governed by the table in use case 9.

---

## 2. Design System, UI Tokens & Interaction Patterns

### Design Tokens (Tailwind CSS 3 Extension, `tailwind.config.js`)
- slate (scale, DEFAULT = 600 = #496580): Primary brand token. Core typography, structural boundaries, and active borders.
  - 50 #F3F6F9, 100 #E5EBF1, 200 #CBD6E0, 300 #A8B9C8, 400 #7E97AC, 500 #5F7C94, 600/DEFAULT #496580, 700 #3B5167, 800 #2F4153, 900 #243242, 950 #172029.
- peach (#FFDBBB): Warning & Symptom accent. Applied to symptoms.
- sky (#BADDFF): Informational surface. Applied to medication.
- mint (#BAFFF5): Positive trigger & confirmation accent. Applied to triggers/foods.
- tint (#E6F4FE): Soft contextual backgrounds.
- canvas (#FDFDFD): Clean base canvas, calendar day cells and "white" surfaces (there is no `bg-white`).
- danger (DEFAULT #DC2626, dark #B91C1C): Destructive actions only.
- Contrast rule (WCAG AA, measured): `text-slate` (#496580) reaches >= 4.5:1 on canvas, tint, mint, peach and slate-100, but only 4.3:1 on sky. Text placed on `peach`, `sky` or `mint` badges therefore uses `text-slate-800` (>= 7:1).
- Typography: Nunito Sans (variable), self-hosted through `@fontsource-variable/nunito-sans` (no request to Google Fonts, GDPR). `font-sans` maps to `"Nunito Sans Variable"`.

### Quick Jump Navigator & View Density
- Quick Jump Navigator (`DateNavigatorPopover.vue`): The month label in the header acts as a popover trigger with a year stepper and 12-month grid. Guests: locked (shows the "Opción no disponible sin iniciar sesión." warning). Future months are never selectable.
- Multi-Month Density Selector: Segmented control (`1M | 2M | 3M`). Allows stacked consecutive months to visualize long-term trends without hiding any event rows. Guests: locked at `1M`.

### Workspace Layout & Interaction (Tailwind default breakpoints)
- `lg` (>= 1024px): 3-column grid. Left Rail (232px) for Dock, Center Stage (1fr) for CalendarGrid, Right Rail (276px) for Insights and Pattern Thresholds.
- `< lg`: single-column stacked layout (Dock, Calendar, Insights).
- Interaction does not depend on width but on input capability:
  - Select-then-place (tap/keyboard/mouse) is available everywhere: a dock item is a toggle button (`aria-pressed`); activating a valid day opens `EventLogModal.vue`.
  - HTML5 Drag-and-Drop is a pointer-only enhancement, enabled only when `matchMedia('(hover: hover) and (pointer: fine)')` matches (`useInteraction.ts`).

---

## 3. Technology Stack & Workspace Architecture
- Monorepo Structure: npm workspaces `shared`, `client`, `server` at the repository root; packages named `@cuidat/shared`, `@cuidat/client`, `@cuidat/server`.
- Client: Vue 3 (Composition API), Vite, Pinia, Tailwind CSS 3.4 (+ PostCSS, Autoprefixer), dayjs, `@lucide/vue` (successor of the deprecated `lucide-vue-next`), dompurify, native HTML5 Drag-and-Drop (no library), vite-plugin-pwa, localforage, `@fontsource-variable/nunito-sans`, `@sentry/vue`. Type checking with `vue-tsc`. TypeScript is pinned to `~6.0` in every package: TypeScript 7 (native) is not yet supported by `typescript-eslint` nor `vue-tsc`.
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
| `client/src/application` | Use cases | Pinia stores, composables (`useCalendar`, `useInteraction`, `useMultiMonth`), sync use cases. Depend on repository ports. |
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
  occurrences: number;
  category: 'Vigilar posible patrón' | 'Patrón detectado';
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
- GDPR Compliance: Client-side JSON export for Art. 20. Atomic cascade deletion for Art. 17.

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

