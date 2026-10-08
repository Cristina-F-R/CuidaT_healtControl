# STYLE_GUIDE.md: AI Coding Standards & Quality Directives

This document establishes mandatory programming standards, component constraints, and architectural conventions for all AI agents generating or refactoring code in the CuidaT codebase.

---

## 1. General TypeScript Standards

- Zero-any Policy: The `any` type is strictly prohibited. Use `unknown` alongside runtime type narrowing or Zod schema parsing.
- Explicit Return Types: Utility functions, service methods, and domain algorithms (especially in `shared/`) must explicitly state their return signature:
  - Correct: `export function calculateWindow(hours: number): TimeRange { ... }`
  - Incorrect: `export function calculateWindow(hours: number) { ... }`
- Type-Only Imports: Use explicit type imports to minimize runtime overhead and prevent circular bundling issues:
  - Correct: `import type { CalendarProfile, HealthEventLog, UserProfile } from '@cuidat/shared';`

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
- Component File Budget: No `.vue` component may exceed 180 lines of code. Deconstruct complex interfaces into atomic child components (`CalendarGrid.vue`, `CalendarDayCell.vue`, `DateNavigatorPopover.vue`, `MonthlyInsightsSummary.vue`, `ParametricAnalyticsModal.vue`, `AppHeader.vue`, `DeleteAccountModal.vue`, `ProfileEditModal.vue`).

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

    function addLog(entry: HealthEventLog) {
      logs.value.push(entry);
    }

    function resetState() {
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
- Pure Store Teardown: Stores holding tenant-isolated clinical data (`useEventStore`, `useProfileStore`, `useItemDefinitionStore`) must expose deterministic cleanup/reset methods invoked upon session logout or account erasure.
- Profile Invariant Enforcement: In `useProfileStore`, ensure `canDeleteProfile` is exposed as a computed property (`profiles.value.length > 1`) and verified before initiating any delete routine.

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
| Types & Interfaces | PascalCase (no I prefix) | `CalendarProfile`, `HealthEventLog`, `AuthResponse` |
| Functions & Variables | camelCase | `detectCorrelations()`, `activeDate`, `handleLogout()` |
| Global Constants | SCREAMING_SNAKE_CASE | `MAX_WINDOW_HOURS`, `GUEST_STORAGE_KEY`, `DELETION_CONFIRM_KEYWORD` |

---

## 5. Tailwind CSS & UI Assembly Rules

- Color Token Integrity: Arbitrary hex values are banned in component templates. Use only tokens extended in `tailwind.config.js`:
  - `text-slate`, `bg-slate`, `border-slate` (structural text, icons, buttons)
  - `bg-peach`, `text-slate` (symptoms, warnings, severity indicators)
  - `bg-sky` (informational cards and secondary panels)
  - `bg-mint`, `text-slate` (triggers, confirmations, correlation badges)
  - `bg-tint` (soft background surfaces, pill containers)
  - `bg-canvas` (clean canvas and cell backgrounds)
- Class Ordering Protocol:
  1. Box Model & Positioning (`grid`, `flex`, `relative`, `w-full`)
  2. Spacing & Sizing (`p-4`, `gap-3`, `min-h-[110px]`)
  3. Typography (`font-sans`, `text-sm`, `font-extrabold`, `text-slate`)
  4. Visual Surfaces (`bg-canvas`, `rounded-2xl`, `border`)
  5. Interactive Modifiers (`hover:`, `focus:`, `transition-all`)

### Calendar Layout & Navigation Patterns
- Zero Hidden Clinical Data (Cell Sizing):
  - Day cells in `CalendarDayCell.vue` must expand organically to display all events without artificial clipping (`+X más`).
  - Required container class: `min-h-[110px] h-full flex flex-col p-1.5 bg-canvas border border-slate-100 transition-colors`.
- Quick Jump Navigator (`DateNavigatorPopover.vue`):
  - Triggered by clicking the current month label in the calendar header.
  - Layout: `w-64 p-3 bg-canvas border border-slate-200 rounded-2xl shadow-xl z-50`.
  - Controls: Year navigation row with chevron steppers, followed by a 3x4 grid (`grid grid-cols-3 gap-1.5`) of month pill buttons (`hover:bg-tint text-xs font-bold py-1.5 rounded-lg`).
- Multi-Month Density Selector:
  - Segmented control layout: `inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs font-bold text-slate-600`.
  - Active segment: `bg-white text-slate-800 shadow-sm rounded-lg px-2.5 py-1 transition-all`.
- Drag & Drop Visual Feedback:
  - Active Dropzone: When a user starts dragging an item from the dock, the calendar cells corresponding to valid days (present and past) must visually highlight (e.g., `bg-tint/30 border-dashed border-mint`).
  - Blocked Dropzone: Future days must maintain their inactive state (`bg-slate-50 opacity-50`) and must not react to hover events during the drag, reinforcing the date restriction.

### Session, Onboarding & Identity Component Specifications
- Header Connectivity & Session Badges (`AppHeader.vue`):
  - Guest Mode: Neutral badge using `bg-slate-100 text-slate-600 border border-slate-200` with text "Modo Local".
  - Authenticated Mode: Active status badge using `bg-mint/40 text-slate-800 border border-mint` with text "Sincronizado".
- Profile Lifecycle Modals (`ProfileEditModal.vue`):
  - Provide inline editing for profile name, avatar emoji selector, and color theme pills.
  - Delete action button must be disabled with tooltip when `profiles.length <= 1`.
- Consent-Driven Onboarding Switch (`AuthModal.vue`):
  - Include an explicit switch element in the registration form: "Conservar y migrar datos locales existentes a mi cuenta".
  - Toggle style: Standard accessible toggle switch (`peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-slate-700`).
- Double-Verification Destructive Modals (`DeleteAccountModal.vue`):
  - The confirmation button MUST remain in a strictly disabled visual and functional state (`opacity-50 cursor-not-allowed bg-slate-300`) until the user types the exact case-sensitive string "ELIMINAR" in a sanitized input field.
  - Active destructive CTA: `bg-red-600 hover:bg-red-700 text-white font-bold transition-colors`.
- Future Dates Restriction (`CalendarDayCell.vue` and `DateNavigatorPopover.vue`):
  - Mandatory Computed Property: Every cell must calculate `const isFuture = dayjs(cellDate).isAfter(dayjs(), 'day')`.
  - Visual Blocked State: If `isFuture` is true, apply `bg-slate-50 opacity-50 cursor-not-allowed` and an optional diagonal pattern.
  - Event Prevention: Disable `@click` and Drag & Drop zones on future days. Display a warning Toast: "Metrics cannot be logged on future dates."
  - Navigation: Month forward buttons must acquire a `disabled` state (`opacity-50 cursor-not-allowed`) upon reaching the current month.

### Accessibility (A11y) Standards
- Semantic HTML Strictness: Never use `div` or `span` elements with `@click` listeners for interactive actions. Always use semantic `<button>` or `<a>` tags to ensure proper keyboard navigation and screen reader support.
- Aria Attributes: Any interactive element that lacks visible descriptive text (e.g., an icon-only close button or a Drag & Drop handle) MUST include a descriptive `aria-label` attribute (e.g., `<button aria-label="Cerrar modal">`).
- Color Contrast: UI token applications must respect WCAG AA contrast ratios, particularly for symptom/trigger badges containing text.

---

## 6. Defensive Security & GDPR Governance

- Sanitization Protocol (Cross-Site Scripting - OWASP A03): Every string accepted from user-editable inputs must pass through `DOMPurify.sanitize()` prior to reactivity assignment or storage:
  ```typescript
  import DOMPurify from 'dompurify';
  const cleanNotes = DOMPurify.sanitize(rawNotes.trim());
  ```
- Broken Access Control Mitigation (OWASP A01): Every database query MUST scope tenancy via `WHERE user_id = current_user_id` inside repository abstractions. Direct Insecure Object Reference (IDOR) vulnerabilities will fail automated security review.
- Atomic Account Erasure (GDPR Art. 17 - Right to be Forgotten):
  - Invocations to `DELETE /api/auth/account` must execute within a strict PostgreSQL transaction deleting the user row and propagating cascading removals (`ON DELETE CASCADE`) to all child health tables.
  - Client state must immediately wipe authentication cookies/tokens and invoke store cleanup routines (`resetState()`) to eliminate in-memory residual health data.
- Explicit Consent Onboarding (GDPR Art. 9):
  - Registration routines must verify the user's migration preference. When disabled, the local guest payload is dropped locally and a fresh profile context is initialized without dispatching `POST /api/auth/upgrade`.
- Client-Side Data Portability (GDPR Art. 20):
  - JSON serialization for data export must occur strictly client-side using `URL.createObjectURL(new Blob([...], { type: 'application/json' }))`.
  - The object URL must be revoked (`URL.revokeObjectURL(url)`) immediately after initiating the download to prevent client memory leaks.
- Domain Error Hierarchy: Standard `throw new Error(...)` is prohibited in application services and controllers. Enforce custom domain classes derived from `AppError` (`ValidationError`, `NotFoundError`, `UnauthorizedError`) with explicit HTTP status mapping and machine-readable error codes.
- Rate Limiting and Endpoint Protection (OWASP A07):
  - The entire Express router must be protected by `express-rate-limit`.
  - Critical routes (`/api/auth/register`, `/api/auth/login`): Strict limit of 5 requests per IP every 15 minutes.
  - Standard API routes (`/api/*`): Global limit of 100 requests per minute per IP.

---

## 7. Version Control, Quality Gates & Git Guidelines

- Strict Conventional Commits standard required:
  - Features: `feat(profile): implement profile edit modal and deletion guard`, `feat(calendar): add multi-month view and quick jump navigator`.
  - Fixes: `fix(auth): handle optional migration payload on registration`.
  - Architecture/Docs: `docs(specs): sync tech_spec and style_guide for phase 4.1`.
- Automated Quality Gate: The CI pipeline (GitHub Actions) serves as an automated quality gate enforcing zero typecheck errors (`tsc -b`), clean linting, and 100% passing Vitest and Playwright test suites before merging.
- Critical E2E Testing (Playwright): Destructive and privacy-related flows require mandatory automated coverage. The account deletion process (GDPR Art. 17) must include a Playwright E2E test verifying:
  1. The validation of the exact case-sensitive input "ELIMINAR".
  2. The execution of the API mutation.
  3. The immediate session cleanup on the client and the redirection to the "Guest Mode" state.