# STYLE_GUIDE.md: AI Coding Standards & Quality Directives

This document establishes mandatory programming standards, component constraints, and architectural conventions for all AI agents generating or refactoring code in the CuidaT codebase. Architecture and product rules live in `TECH_SPEC.md`; this file covers how the code is written.

---

## 1. General TypeScript Standards

- Zero-any Policy: The `any` type is strictly prohibited. Use `unknown` alongside runtime type narrowing or Zod schema parsing.
- Explicit Return Types: Utility functions, service methods, and domain algorithms (especially in `shared/` and `server/src`) must explicitly state their return signature:
  - Correct: `export function calculateWindow(hours: number): TimeRange { ... }`
  - Incorrect: `export function calculateWindow(hours: number) { ... }`
- Type-Only Imports: Use explicit type imports to minimize runtime overhead and prevent circular bundling issues:
  - Correct: `import type { CalendarProfile, HealthEventLog, UserProfile } from '@cuidat/shared';`
- Layering: follow the Clean Architecture layout of `TECH_SPEC.md` section 3.1. Components and controllers never contain business rules; they call use cases / shared domain functions.

---

## 2. Vue 3 & Composition API Directives

### Single-File Component (SFC) Ordering
Every `.vue` component must strictly observe the following block sequence:
1. `<script setup lang="ts">`
2. `<template>`
3. `<style scoped>` (reserved for edge cases; utility classes via Tailwind take precedence).

### Reactivity Conventions
- Uniform `ref()` Usage: Use `ref()` across both primitives and complex objects to maintain consistent `.value` ergonomics. Restrict `reactive()` to justified large-scale state structures.
- Props & Emits Declarations: Enforce compile-time type declarations:
  ```typescript
  const props = defineProps<{
    profileId: string;
    isOpen: boolean;
    activeLogId?: string | null;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', payload: HealthEventLog): void;
    (e: 'delete', id: string): void;
  }>();
  ```
- Component File Budget: No `.vue` component may exceed 180 lines of code (blank lines and comments excluded). The limit applies to `.vue` files only, not to tests, stores, SQL migrations or configuration. Deconstruct complex interfaces into atomic child components (`CalendarGrid.vue`, `CalendarDayCell.vue`, `DateNavigatorPopover.vue`, `MonthlyInsightsSummary.vue`, `ParametricAnalyticsModal.vue`, `AppHeader.vue`, `DeleteAccountModal.vue`, `ProfileEditModal.vue`).

---

## 3. Pinia State Management

- Setup Stores Mandatory: Define Pinia stores using function syntax exclusively:
  ```typescript
  export const useEventStore = defineStore('events', () => {
    const logs = ref<HealthEventLog[]>([]);
    const activeFilter = ref<FilterType>('all');

    const filteredLogs = computed(() => {
      // Return filtered logs
    });

    function addLog(entry: HealthEventLog): void {
      logs.value.push(entry);
    }

    function resetState(): void {
      logs.value = [];
      activeFilter.value = 'all';
    }

    return { logs, activeFilter, filteredLogs, addLog, resetState };
  });
  ```
- Reactivity Preservation: Never destructure stores directly in setup scripts or templates. Always wrap extracted state with `storeToRefs()`:
  ```typescript
  const eventStore = useEventStore();
  const { logs, activeFilter } = storeToRefs(eventStore);
  ```
- Pure Store Teardown: Stores holding tenant-isolated or session data (`useEventStore`, `useProfileStore`, `useItemDefinitionStore`, `useAuthStore`, `useSyncStore`) must expose deterministic cleanup/reset methods invoked upon session logout or account erasure.
- Profile Invariant Enforcement: In `useProfileStore`, expose `canDeleteProfile` as a computed property (`profiles.value.length > 1`). The UI disables deletion when `!canDeleteProfile`, and the check is verified before initiating any delete routine.
- Repositories: stores talk to repository interfaces (`EventRepository`, ...), never to `localStorage` or `fetch` directly. The implementation (`Local...` / `Api...`) is chosen by `authMode`.

### Global Error Boundary & Fallback UI
- Global Exception Handling: It is mandatory to configure `app.config.errorHandler` in `main.ts` to catch rendering errors or correlation engine failures.
- Visual Fallback: Any caught critical error must unmount the affected component tree and render `FallbackError.vue` (a friendly empty-state component inviting the user to refresh the page), strictly preventing blank screens.

---

## 4. Naming Conventions

| Construct | Convention | Canonical Example |
| :--- | :--- | :--- |
| Component Files | PascalCase.vue | `CalendarDayCell.vue`, `DateNavigatorPopover.vue`, `ProfileEditModal.vue` |
| Composables | camelCase.ts (use prefix) | `useCalendar.ts`, `useInteraction.ts`, `useMultiMonth.ts` |
| Pinia Stores | camelCase.ts (use...Store pattern) | `useProfileStore.ts`, `useEventStore.ts`, `useAuthStore.ts` |
| Repositories | PascalCase class/interface with `Repository` suffix | `EventRepository`, `LocalEventRepository`, `ApiEventRepository` |
| Types & Interfaces | PascalCase (no I prefix) | `CalendarProfile`, `HealthEventLog`, `AuthResponse` |
| Functions & Variables | camelCase | `detectCorrelations()`, `activeDate`, `handleLogout()` |
| Global Constants | SCREAMING_SNAKE_CASE | `MAX_WINDOW_HOURS`, `GUEST_STORAGE_KEY`, `DELETION_CONFIRM_KEYWORD` |
| Layer folders | lowercase | `domain/`, `application/`, `infrastructure/`, `presentation/` |

---

## 5. Tailwind CSS & UI Assembly Rules

- Tailwind CSS 3.4 with tokens extended in `tailwind.config.js`. Arbitrary hex values are banned in component templates; default palette colors (`white`, `red-*`, ...) are not used either. Allowed tokens:
  - `slate` full scale (`slate-50` ... `slate-950`, DEFAULT = 600): structural text, icons, borders, buttons.
  - `peach` (symptoms, warnings, severity indicators), `sky` (medication, informational cards and secondary panels), `mint` (triggers, confirmations, correlation badges).
  - `tint` (soft background surfaces, pill containers), `canvas` (clean canvas, cell backgrounds and any "white" surface).
  - `danger` / `danger-dark` (destructive actions only).
- Contrast: text on `peach`, `sky` or `mint` badges uses `text-slate-800`; `text-slate` is only for `canvas`, `tint`, `mint`, `peach` and `slate-50/100` backgrounds (WCAG AA, see `TECH_SPEC.md`).
- Font: `font-sans` = Nunito Sans Variable, self-hosted via `@fontsource-variable/nunito-sans` imported in `main.ts`. No Google Fonts links.
- Class Ordering Protocol:
  1. Box Model & Positioning (`grid`, `flex`, `relative`, `w-full`)
  2. Spacing & Sizing (`p-4`, `gap-3`, `min-h-[110px]`)
  3. Typography (`font-sans`, `text-sm`, `font-extrabold`, `text-slate`)
  4. Visual Surfaces (`bg-canvas`, `rounded-2xl`, `border`)
  5. Interactive Modifiers (`hover:`, `focus:`, `transition-all`)
- Breakpoints: Tailwind defaults only. `lg:` (1024px) switches the single column to the 3-column workspace. Never hard-code pixel media queries.

### Calendar Layout & Navigation Patterns
- Zero Hidden Clinical Data (Cell Sizing):
  - Day cells in `CalendarDayCell.vue` must expand organically to display all events without artificial clipping (`+X más`).
  - Required container class: `relative min-h-[110px] h-full flex flex-col p-1.5 bg-canvas border border-slate-100 transition-colors`.
- Cell Semantics (ADR-015): the cell container is not interactive. It holds a "day" `<button>` stretched over the cell (`after:absolute after:inset-0`, `aria-label="Ver resumen del {fecha}"`) and event dots as sibling `<button>`s with `relative z-10`. Never nest buttons and never use `div @click`.
- Quick Jump Navigator (`DateNavigatorPopover.vue`):
  - Triggered by clicking the current month label in the calendar header.
  - Layout: `w-64 p-3 bg-canvas border border-slate-200 rounded-2xl shadow-xl z-50`.
  - Controls: Year navigation row with chevron steppers, followed by a 3x4 grid (`grid grid-cols-3 gap-1.5`) of month pill buttons (`hover:bg-tint text-xs font-bold py-1.5 rounded-lg`).
- Multi-Month Density Selector:
  - Segmented control layout: `inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs font-bold text-slate-600`.
  - Active segment: `bg-canvas text-slate-800 shadow-sm rounded-lg px-2.5 py-1 transition-all`.
  - Guests: the selector, month arrows and Quick Jump are locked; any attempt shows the Toast "Opción no disponible sin iniciar sesión." with a "Crear cuenta" action that opens `AuthModal.vue`.
- Placement Interaction (`useInteraction.ts`):
  - Select-then-place works for everyone: dock items are toggle `<button aria-pressed>`; activating a valid day opens `EventLogModal.vue`.
  - Drag & Drop uses the native HTML5 API (`draggable`, `dragstart`, `dragover`, `drop`), no library, and is enabled only when `matchMedia('(hover: hover) and (pointer: fine)')` matches.
  - Active Dropzone: When a user starts dragging an item from the dock, the calendar cells corresponding to valid days (present and past) must visually highlight (e.g., `bg-tint/30 border-dashed border-mint`).
  - Blocked Dropzone: Future days must maintain their inactive state (`bg-slate-50 opacity-50`) and must not react to hover events during the drag, reinforcing the date restriction.

### Session, Onboarding & Identity Component Specifications
- Header Connectivity & Session Badges (`AppHeader.vue`):
  - Guest Mode: Neutral badge using `bg-slate-100 text-slate-600 border border-slate-200` with text "Modo Local".
  - Authenticated, in sync: `bg-mint/40 text-slate-800 border border-mint` with text "Sincronizado".
  - Authenticated, queue not empty: `bg-peach/40 text-slate-800 border border-peach` with text "Pendiente (N)".
  - Authenticated, offline: `bg-slate-100 text-slate-600 border border-slate-200` with text "Sin conexión".
- Profile Lifecycle Modals (`ProfileEditModal.vue`):
  - Provide inline editing for profile name, profile type (combobox: suggestions Mascota / Niño/a / Adulto plus the user's own types, free typing creates a new one, sanitized, 1-50 chars), avatar emoji selector, color theme pills and correlation window.
  - Empty registered profile: dock empty state with the "Añadir ítems de ejemplo" action.
  - Delete action button must be disabled with tooltip when `!canDeleteProfile`.
- Guest Gating: guests may hold at most 3 symptoms and 3 triggers/medication (`GUEST_MAX_SYMPTOMS`, `GUEST_MAX_TRIGGERS`; the 6 preset items fill them; archived items still count). Creating one more shows the same Toast/`AuthModal` action as locked navigation. Limits are defined in `shared/src/guestLimits.ts` and exposed to the UI by `useGuestLimits.ts`.
- Catalog Manager (item create/edit/archive/delete):
  - Follows the lifecycle table of `TECH_SPEC.md` use case 9: `category` locked on edit; notice when `name`/`emoji` edits are retroactive; flags edit creates a new version.
  - "Archivar" is the primary option; "Eliminar definitivamente" is secondary, shows the number of logs to be erased and requires an explicit acceptance checkbox before enabling the `danger` button.
- Consent-Driven Onboarding Switch (`AuthModal.vue`):
  - Include an explicit switch element in the registration form: "Conservar y migrar datos locales existentes a mi cuenta".
  - Toggle style: Standard accessible toggle switch (`peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-slate-700`).
- Double-Verification Destructive Modals (`DeleteAccountModal.vue`):
  - The confirmation button MUST remain in a strictly disabled visual and functional state (`opacity-50 cursor-not-allowed bg-slate-300`) until the user types the exact case-sensitive string "ELIMINAR" in a sanitized input field.
  - Active destructive CTA: `bg-danger hover:bg-danger-dark text-canvas font-bold transition-colors`.
- Future Dates Restriction (`CalendarDayCell.vue` and `DateNavigatorPopover.vue`, ALL users):
  - Mandatory Computed Property: Every cell must calculate `const isFuture = dayjs(cellDate).isAfter(dayjs(), 'day')`.
  - Visual Blocked State: If `isFuture` is true, apply `bg-slate-50 opacity-50 cursor-not-allowed` and an optional diagonal pattern.
  - Event Prevention: Future cells keep a focusable "day" button with `aria-disabled="true"` (not the `disabled` attribute) so that activation can show the warning Toast "No se pueden registrar métricas en fechas futuras." while never opening a modal or accepting drops.
  - Navigation: Month forward buttons must acquire a `disabled` state (`opacity-50 cursor-not-allowed`) upon reaching the current month.

### Accessibility (A11y) Standards
- Semantic HTML Strictness: Never use `div` or `span` elements with `@click` listeners for interactive actions. Always use semantic `<button>` or `<a>` tags to ensure proper keyboard navigation and screen reader support. Never nest interactive elements.
- Aria Attributes: Any interactive element that lacks visible descriptive text (e.g., an icon-only close button or a Drag & Drop handle) MUST include a descriptive `aria-label` attribute (e.g., `<button aria-label="Cerrar modal">`).
- Keyboard & Focus: every action reachable by drag is also reachable by select-then-place. Modals trap focus, close on `Esc` and return focus to the trigger. Toasts use `aria-live="polite"`.
- Color Contrast: UI token applications must respect WCAG AA contrast ratios, particularly for symptom/trigger badges containing text.

---

## 6. Defensive Security & GDPR Governance

- Sanitization Protocol (Cross-Site Scripting - OWASP A03): Every string accepted from user-editable inputs must pass through `sanitizeText()` (`client/src/application/sanitizeText.ts`) prior to reactivity assignment or storage, and before length validation. It runs DOMPurify and returns plain text; `DOMPurify.sanitize()` on its own returns HTML, so it must not be stored directly:
  ```typescript
  import { sanitizeText } from '../../application/sanitizeText';
  const cleanNotes = sanitizeText(rawNotes);
  ```
  The server only trims and validates length (Zod) and stores plain text. `v-html` is forbidden (ESLint `vue/no-v-html` as error); text is always rendered with interpolation.
- Broken Access Control Mitigation (OWASP A01): Every database query MUST be scoped to the authenticated user inside repository abstractions. `users` and `calendar_profiles` filter directly by `user_id`; tables without `user_id` (`health_item_definitions`, `health_event_logs`) are always reached through a join:
  ```sql
  SELECT l.* FROM health_event_logs l
  JOIN calendar_profiles p ON l.calendar_id = p.id
  WHERE p.user_id = $1 AND l.calendar_id = $2;
  ```
  Upserts keyed by a client-supplied id (`PUT .../events/:id`) must verify that the calendar belongs to the user and never overwrite a row of another calendar (`ON CONFLICT (id) DO UPDATE ... WHERE calendar_id = EXCLUDED.calendar_id`). Direct Insecure Object Reference (IDOR) vulnerabilities will fail automated security review.
- Session & CSRF: the JWT lives only in the `httpOnly` cookie `cuidat_session` (never `localStorage`). The API client always sends `credentials: 'include'` and the header `X-CuidaT-Client: web`; the server checks `Origin` and that header on state-changing requests.
- Privacy of Observability: Sentry (client and server) is configured with `dataCollection` fully disabled (Sentry 11 replacement of `sendDefaultPii`), no Session Replay, and `beforeSend`/`beforeBreadcrumb` scrubbers that remove request bodies, notes, item names and query strings; the only user identifier is the user UUID. See ADR-012.
- Atomic Account Erasure (GDPR Art. 17 - Right to be Forgotten):
  - Invocations to `DELETE /api/auth/account` must execute within a strict PostgreSQL transaction deleting the user row and propagating cascading removals (`ON DELETE CASCADE`) to all child health tables.
  - The session cookie is `httpOnly`, so the server clears it (`DELETE /api/auth/account`, `POST /api/auth/logout`). The client must immediately wipe the sync queue and the guest key, and invoke store cleanup routines (`resetState()`) to eliminate in-memory residual health data.
- Explicit Consent Onboarding (GDPR Art. 9):
  - Registration routines must verify the user's migration preference. When enabled, the guest payload travels as `guestData` inside `POST /api/auth/register` (one transaction, no separate upgrade call). When disabled, `guestData` is not sent, the local guest payload is dropped and a fresh profile context is initialized.
- Client-Side Data Portability (GDPR Art. 20):
  - JSON serialization for data export must occur strictly client-side using `URL.createObjectURL(new Blob([...], { type: 'application/json' }))`.
  - The object URL must be revoked (`URL.revokeObjectURL(url)`) immediately after initiating the download to prevent client memory leaks.
- Domain Error Hierarchy: Standard `throw new Error(...)` is prohibited in application services and controllers. Enforce custom domain classes derived from `AppError` (`ValidationError`, `NotFoundError`, `UnauthorizedError`) with explicit HTTP status mapping and machine-readable error codes.
- Rate Limiting and Endpoint Protection (OWASP A07):
  - The entire Express router must be protected by `express-rate-limit`.
  - `POST /api/auth/register` and `POST /api/auth/login`: `AUTH_RATE_LIMIT_MAX` requests per IP every 15 minutes (default 20, configurable by environment).
  - All other routes, including `DELETE /api/auth/account`: 100 requests per minute per IP. Express sets `trust proxy` so the real client IP is used.

---

## 7. Version Control, Quality Gates & Git Guidelines

- Strict Conventional Commits standard required (enforced by commitlint in the `commit-msg` hook):
  - Features: `feat(profile): implement profile edit modal and deletion guard`, `feat(calendar): add multi-month view and quick jump navigator`.
  - Fixes: `fix(auth): handle optional migration payload on registration`.
  - Architecture/Docs: `docs(specs): sync tech_spec and style_guide for phase 4.1`.
- Local Gate (Husky `pre-commit`): `lint-staged`, `npm run typecheck`, `npm run test:unit`.
- Automated Quality Gate: The CI pipeline (GitHub Actions) enforces `npm run typecheck` (`tsc` for shared/server, `vue-tsc -b` for the client), `npm run lint` with zero warnings, 100% passing Vitest (100% coverage on `shared/src/correlation.ts`) and Playwright suites, and a Snyk scan before merging.
- Critical E2E Testing (Playwright): Destructive and privacy-related flows require mandatory automated coverage. The account deletion process (GDPR Art. 17) must include a Playwright E2E test verifying:
  1. The validation of the exact case-sensitive input "ELIMINAR".
  2. The execution of the API mutation.
  3. The immediate session cleanup on the client and the redirection to the "Guest Mode" state.
