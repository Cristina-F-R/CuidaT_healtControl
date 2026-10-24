# CuidaT style rules (compact; source: docs/style_guide.md + docs/tech_spech.md)

## TS
- No `any` (use `unknown` + narrowing/Zod). Explicit return types in shared/ and server/src. `import type` for types.
- Clean Architecture: shared (types, Zod, correlation, catalog, time) > domain > application > infrastructure/presentation. No business rules in components/controllers.

## Vue
- SFC order: `<script setup lang="ts">`, `<template>`, `<style scoped>` (rare).
- `ref()` everywhere; `reactive()` only if justified. Type-only `defineProps<{}>()`/`defineEmits<{}>()`.
- Max 180 code lines per `.vue` only (not tests/stores/SQL/config).
- Native `<button>`/`<a>` for actions; never `div @click`; never nest interactive elements; `aria-label` on icon-only controls.
- Modals: focus trap, Esc closes, focus returns. Toasts: `aria-live="polite"`.

## Pinia
- Setup stores only; never destructure store (use `storeToRefs`). Stores use repository interfaces (`Local...`/`Api...` by `authMode`), never localStorage/fetch directly.
- Event/Profile/ItemDefinition/Auth/Sync stores expose `resetState()` (logout, erasure).
- `canDeleteProfile = computed(() => profiles.value.length > 1)`; UI disabled when `!canDeleteProfile`; check before delete.
- `app.config.errorHandler` in main.ts -> `FallbackError.vue`.

## Naming
Components PascalCase.vue | composables `useX.ts` | stores `useXStore.ts` | repositories `XRepository`/`LocalXRepository`/`ApiXRepository` | types PascalCase no `I` | fn/var camelCase | constants SCREAMING_SNAKE | layer folders lowercase.

## Tailwind 3.4 (tokens in tailwind.config.js)
- No hex, no default palette colors (`white`, `red-*`). Tokens: `slate` full scale 50-950 (DEFAULT 600 #496580), peach (symptoms/warnings/"Patrón detectado"), sun #FFF3BA ("Vigilar posible patrón" only), sky (medication/info), mint (triggers/confirm), tint (soft bg), canvas (cells and any "white"), `danger`/`danger-dark` (destructive only).
- Text on peach/sun/sky/mint badges: `text-slate-800`. `text-slate` only on canvas/tint/mint/peach/sun/slate-50/100. Soft-token borders/bands on canvas are < 3:1: always add icon + accessible text.
- Font: Nunito Sans Variable self-hosted (`@fontsource-variable/nunito-sans`); no Google Fonts.
- Class order: layout > spacing/size > typography > surface > interactive.
- Breakpoints: Tailwind defaults; `lg:` (1024) = 3 columns, below = single column.

## Calendar UI
- Cell container: `relative min-h-[110px] h-full flex flex-col p-1.5 bg-canvas border border-slate-100 transition-colors`; no clipping/"+X más".
- Cell = non-interactive container + stretched day `<button>` (`after:absolute after:inset-0`, `aria-label="Ver resumen del {fecha}"`) + event dots as sibling `<button class="relative z-10">`.
- Placement: select-then-place for everyone (dock items `<button aria-pressed>`); native HTML5 drag&drop (no library) only if `matchMedia('(hover: hover) and (pointer: fine)')` (`useInteraction.ts`). Valid drop days `bg-tint/30 border-dashed border-mint`; future days stay `bg-slate-50 opacity-50`, no hover.
- Future dates (ALL users): `const isFuture = dayjs(cellDate).isAfter(dayjs(), 'day')`; `bg-slate-50 opacity-50 cursor-not-allowed`, day button `aria-disabled="true"` (not `disabled`) -> Toast "No se pueden registrar métricas en fechas futuras."; no modal/drop; forward-month button disabled at current month.
- `DateNavigatorPopover`: from month label; `w-64 p-3 bg-canvas border border-slate-200 rounded-2xl shadow-xl z-50`; year stepper + `grid grid-cols-3 gap-1.5` pills (`hover:bg-tint text-xs font-bold py-1.5 rounded-lg`); no future months.
- Consultation Mode (`useViewMode.ts`, off on every load, not persisted, guests too): `role="switch"` "Modo consulta" right of the filter pills; no dock (`lg:grid-cols-[minmax(0,1fr)_276px]`); no editing affordances anywhere; day marks = keep `bg-canvas` + `border-2` + 6px top band (`sun` watch / `peach` detected, detected wins, trigger/medication days only: the possible cause) + icon badge (`Eye`/`TriangleAlert`, in flow next to the day number, never over it) + aria-label suffix; legend; `aria-live` announcement.
- Density (1M|2M|3M): `inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs font-bold text-slate-600`; active `bg-canvas text-slate-800 shadow-sm rounded-lg px-2.5 py-1 transition-all`; guests: selector, month arrows and Quick Jump locked.

## Saved reports (registered only, TECH_SPEC section 9)
- `SaveReportForm` in "Ver resúmenes" (`bg-tint` block, optional title, "N de 5", disabled + reason when offline/full/empty; guests: locked Toast). `ReportsModal` from the account menu: Ver / Descargar PDF / Eliminar (two-step; hidden in Consultation Mode). `ReportViewModal` (`AppModal wide`) renders only the snapshot: patterns (sun/peach), stats, mini months (consultation marks), day list.
- Form says what it will include (only checked items). Empty pattern boxes on sun/peach. Emoji legend next to mini months.
- PDF: pdfmake lazy-loaded (not precached), Nunito Sans WOFF (no arrows: "X, seguido de Y"; emojis drawn to PNG on a canvas, initial as fallback, with legend), colors from `client/src/theme/palette.ts` (also feeds tailwind.config.js). Max 5 per user, 12 months, 1 MB; server builds the snapshot.

## Session/identity UI
- Guest (client-side soft limits): 1 profile, current month only, max 3 symptoms + 3 triggers/medication (`GUEST_MAX_SYMPTOMS`/`GUEST_MAX_TRIGGERS`, rules in `shared/src/guestLimits.ts`, exposed by `useGuestLimits.ts`; archived count, deleted free a slot). Preset catalog `PRESET_ITEMS` (Vómito, Heces blandas, Malestar / dolor, Pescado, Lácteos, Medicación) seeds the GUEST profile on first load and fills the guest limit; registered profiles start empty with an "Añadir ítems de ejemplo" action (`POST .../items/presets`). Registered user with no imported profile: onboarding asks only name + type. Navigating or exceeding a limit -> Toast "Opción no disponible sin iniciar sesión." + "Crear cuenta" (opens `AuthModal`). No anonymous server users.
- Header badge: "Modo Local" `bg-slate-100 text-slate-600 border border-slate-200`; "Sincronizado" `bg-mint/40 text-slate-800 border border-mint`; "Pendiente (N)" `bg-peach/40 text-slate-800 border border-peach`; "Sin conexión" like Modo Local.
- Header: from `md` `grid-cols-[1fr_auto_1fr]` (logo | centered `ProfileMenu` | badge + account); below `md` two rows, `ProfileMenu` centered on the second.
- Insights cards: watch `bg-sun` + `Eye`, detected `bg-peach` + `TriangleAlert`, `text-slate-800`, count `font-extrabold`; empty state on the same surface.
- `ProfileEditModal`: name, profile type (free text combobox, user can create new types), emoji, color pills (calendar identity: tints `ProfileMenu` and a 4px band of `CalendarPanel`; no clinical meaning), correlation window; delete disabled + tooltip when `!canDeleteProfile`.
- Catalog: `category` locked on edit; notice that name/emoji edits are retroactive; flags edit = new version; "Archivar" primary, "Eliminar definitivamente" secondary (shows log count + acceptance checkbox before enabling `danger`).
- `AuthModal` switch "Conservar y migrar datos locales existentes a mi cuenta" (`peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-slate-700`).
- `DeleteAccountModal`: confirm disabled (`opacity-50 cursor-not-allowed bg-slate-300`) until sanitized input === "ELIMINAR"; active `bg-danger hover:bg-danger-dark text-canvas font-bold transition-colors`.

## Security / GDPR
- `sanitizeText(raw)` (DOMPurify -> plain text; never store raw `DOMPurify.sanitize()` output, it is HTML) on all user strings before state/storage and before length checks. Server only trims + Zod length, stores plain text. `v-html` forbidden.
- Queries scoped by user: `users`/`calendar_profiles` by `user_id`; items/logs via `JOIN calendar_profiles p ON x.calendar_id = p.id WHERE p.user_id = $1`.
- `DELETE /api/auth/account`: one PG transaction, cascade; server clears the session cookie; client wipes sync queue, `resetState()`, guest key.
- Registration: `POST /api/auth/register` with optional `guestData` (one transaction; server validates and remaps all ids). Switch off: do not send it, drop local data. No `upgrade` endpoint.
- Session: JWT only in `httpOnly` cookie `cuidat_session` (never localStorage); client uses `credentials:'include'` + header `X-CuidaT-Client: web`; server checks Origin; `trust proxy` set.
- Sentry: EU DSN, `dataCollection` all off (Sentry 11; no `sendDefaultPii`), `attachErrorHandler:false`, no Replay, scrub bodies/notes/item names/query strings, only user UUID.
- Client-id upserts must never overwrite another calendar's row (`ON CONFLICT (id) DO UPDATE ... WHERE calendar_id = EXCLUDED.calendar_id`).
- Export client-side via Blob URL, `revokeObjectURL` right after.
- No `throw new Error` in services/controllers; `AppError` subclasses with status + code.
- Rate limit: register/login `AUTH_RATE_LIMIT_MAX` (default 20)/15min/IP; everything else (incl. DELETE account) 100/min/IP.
- Server rejects `logged_at > now() + 5 min`; archived items accept no new logs.

## Domain reminders
- Item edit: name/emoji = whole lineage (`root_id`); track flags = new version (old `superseded`, same `root_id`, `parent_id`); category immutable; archive = reversible; delete = lineage + logs cascade.
- Events store a concrete UTC instant; order `(logged_at, created_at, id)`; default time = now (today) or presets 08:00/13:00/18:00/22:00.
- Correlations group by `root_id`; match `0 <= delta <= window`.

## Git / QA
- Conventional Commits (commitlint). Husky pre-commit: lint-staged + `npm run typecheck` + `npm run test:unit`.
- CI: typecheck (`tsc` shared/server, `vue-tsc -b` client), lint 0 warnings, Vitest (100% on correlation.ts/catalog.ts), Playwright, Snyk.
- E2E required for account deletion: exact "ELIMINAR", API call, session cleanup + redirect to Guest Mode.

## Deployment
- Host: Render free web service (EU, `render.yaml`, `/api/health`, migrate on container start, `CLIENT_ORIGIN` <- `RENDER_EXTERNAL_URL`); DB on Neon.
- Single origin: one Docker image, Express serves `/api` + built SPA (`SERVE_CLIENT=true`); no GitHub Pages for the client (cookie would become third-party).
