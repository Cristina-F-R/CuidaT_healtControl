# TECH_SPEC.md: CuidaT Core System Specification

This document serves as the single source of truth for the development of CuidaT. Any AI coding agent must consult and adhere strictly to this specification before introducing structural, architectural, or logic changes.

---

## 1. Product Vision & Operational Constraints

CuidaT is a reactive web application designed for visual tracking, deterministic correlation, and management of symptoms, potential triggers, and medication schedules across pets, children, and adults.

- Core Use Cases & Behavioral Contracts:
  1. Quick Event Logging, Editing & Deletion:
     - Creation: User drags a badge onto a calendar day or taps it on mobile, triggering `EventLogModal.vue`.
     - Custom Tracking Metrics: Depending on the item's definition, the user sets approximate time, selects intensity (1: Mild, 2: Moderate, 3: Severe), logs duration in minutes, types sanitized notes (max 300 chars), and saves.
     - Modification / Removal: Clicking an existing event dot opens the modal in edit mode with prefilled values. The modal displays an explicit secondary destructive action ("Eliminar registro").
  2. Deterministic Correlation Discovery & Pattern Thresholds:
     - Computation: The client or server runs `detectCorrelations()` matching every symptom against prior triggers/medications occurring within a dynamically configured window (`0 <= diffHours <= correlation_window_hours`, strictly configurable per calendar: 2, 6, 12, 24, 36, or 48h). 
     - Visualization & Thresholds: Pairings are evaluated by occurrence frequency in the active period:
       - 3 to 6 occurrences: Flagged as "Vigilar posible patrón".
       - 7 or more occurrences: Flagged as "Patrón detectado".
  3. Parametric Analytics & Summaries:
     - Trigger: User clicks "Ver resúmenes" to open a parametric dashboard.
     - Configuration: Allows custom date-range selection and cross-filtering by specific subsets of triggers and symptoms to isolate specific pattern thresholds dynamically.
  4. Guest Mode Governance & Zero-Data-Loss Migration:
     - Demo Workflow: Unregistered users track events locally under `@cuidat_guest_v1`.
     - Guest Limitations: Strictly restricted to 1 calendar profile. Calendar grid navigation is restricted to present and past months. Multi-month view is capped at a maximum of 2 simultaneous months.
     - Explicit Consent Migration (GDPR Art. 9): Registration includes a reactive switch: "Conservar y migrar datos locales existentes a mi cuenta" (enabled by default). If unchecked, the account is provisioned clean without transferring local data into PostgreSQL.
  5. Day Summary Drill-Down (Consultation vs. Normal Mode):
     - Trigger: Clicking on an empty area of a calendar day cell opens `DaySummaryModal.vue`, rendering a chronological breakdown of that date's logged events.
     - Mode Constraint: In Normal Mode, each row allows editing/deleting. In Consultation Mode (read-only mode for medical visits), editing actions are suppressed.
  6. Calendar Profile Lifecycle Management:
     - Creation: Users can create dedicated profiles with distinct names, avatar emojis, color themes, and custom correlation windows.
     - Modification: Existing profiles can be edited via `ProfileEditModal.vue`.
     - Deletion: Profiles can be deleted via `DELETE /api/profiles/:id`.
     - Non-Zero Profile Invariant: The UI and backend strictly enforce that a user's final remaining profile cannot be deleted (`profiles.length > 1` required for deletion).
  7. User Profile Lifecycle, Session State & GDPR Data Rights:
     - GDPR Portability (Art. 20): Authenticated users can invoke "Descargar mis datos" to trigger an immediate client-side download of their dataset as a JSON file.
     - GDPR Right to be Forgotten (Art. 17): Permanent account erasure via `DELETE /api/auth/account`. Requires typing "ELIMINAR" in a confirmation modal. Executes an atomic cascade deletion.
  8. Future Data Prevention (Clinical Integrity):
     - UI/API Block: The system strictly prevents logging symptoms, triggers, or medications on future dates.
     - Interface: Navigation to future months is blocked. Days after the current date within the current month are visually disabled. Attempting to interact with them triggers a warning Toast explaining the restriction.
  9. Historical Immutability (Soft Delete) & Scalability:
     - Catalog: Editing an item's configuration (e.g., switching from intensity tracking to duration tracking) does not alter the original record. A soft delete is applied, and a new record is created and linked via `parent_id`, ensuring the historical `DaySummaryModal.vue` does not break.
     - Temporal Pagination: The client defaults to fetching only the last 3 months of `health_event_logs` to ensure optimal main thread performance in Vue.
  10. System Resilience & Error Handling:
      - Global Error Boundary: The Vue application implements a global error handler to intercept runtime exceptions (e.g., unexpected correlation engine failures or rendering issues) and display a graceful `FallbackError.vue` UI, ensuring the application never crashes to a blank screen.

- Dynamic Dock & Catalog Management:
  - Configuration: When creating items, users can toggle `track_intensity` and `track_duration` booleans to define what data to collect for that specific item.
  - Deletion Guard: Deleting an item definition referenced by existing logs prompts a cascading deletion warning.

---

## 2. Design System, UI Tokens & Interaction Patterns

### Design Tokens (Tailwind CSS Extension)
- slate (#496580): Primary brand token. Core typography, structural boundaries, and active borders.
- peach (#FFDBBB): Warning & Symptom accent. Applied to symptoms.
- sky (#BADDFF): Informational surface. Applied to medication.
- mint (#BAFFF5): Positive trigger & confirmation accent. Applied to triggers/foods.
- tint (#E6F4FE): Soft contextual backgrounds.
- canvas (#FDFDFD): Clean base canvas and calendar day cells.

### Quick Jump Navigator & View Density
- Quick Jump Navigator (`DateNavigatorPopover.vue`): The month label in the header acts as a popover trigger with a year stepper and 12-month grid.
- Multi-Month Density Selector: Segmented control (`1M | 2M | 3M`). Allows stacked consecutive months to visualize long-term trends without hiding any event rows.

### Workspace Layout (Desktop vs. Mobile)
- 3-Column Grid Desktop Layout: Left Rail (232px) for Dock, Center Stage (1fr flex) for CalendarGrid, Right Rail (276px) for Insights and Pattern Thresholds.
- Responsive Collapse (< 900px): Single-column stacked layout.
- Interaction Contract: Desktop (>= 768px) supports HTML5 Drag-and-Drop. Mobile (< 768px) relies strictly on Tap-to-select.

---

## 3. Technology Stack & Workspace Architecture
- Monorepo Structure: Managed via npm workspaces (shared, client, server).
- Client: Vue 3 (Composition API), Vite, Pinia, Tailwind CSS, dayjs, lucide-vue-next, dompurify.
- Server: Node.js, Express, TypeScript, Zod, bcrypt, jsonwebtoken.
- Persistence: PostgreSQL (Neon) with strict multi-tenant isolation via composite keys.
- CI/CD & Security: GitHub Actions, Husky (Pre-commit hooks), Snyk (Dependency scanning).
- Observability: Sentry (Error tracking and performance monitoring).
- Containerization: Docker & Docker Compose (Local database and backend containerization).

---

## 4. Environment Configuration (.env.example)

# Frontend (.env)
VITE_API_URL=http://localhost:3000

# Backend (.env)
PORT=3000
DATABASE_URL=postgresql://cuidat_user:secure_password@localhost:5432/cuidat_db?sslmode=require
JWT_SECRET=super_secret_session_key_min_32_chars

---

## 5. Relational Database Schema (PostgreSQL DDL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE calendar_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    profile_type VARCHAR(50) NOT NULL,
    avatar_icon VARCHAR(50) DEFAULT '👤',
    color_theme VARCHAR(50) DEFAULT 'slate',
    correlation_window_hours SMALLINT DEFAULT 48 CHECK (correlation_window_hours IN (2, 6, 12, 24, 36, 48)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_user ON calendar_profiles(user_id);

CREATE TABLE health_item_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendar_profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES health_item_definitions(id) ON DELETE SET NULL, -- Para agrupar históricos editados
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    category VARCHAR(50) NOT NULL,
    track_intensity BOOLEAN DEFAULT TRUE,
    track_duration BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE, -- Soporte para Soft Delete
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_item_calendar UNIQUE (id, calendar_id)
);

CREATE INDEX idx_items_calendar_active ON health_item_definitions(calendar_id, is_active);

CREATE TABLE health_event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendar_profiles(id) ON DELETE CASCADE,
    item_definition_id UUID NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL,
    intensity SMALLINT CHECK (intensity BETWEEN 1 AND 3), 
    duration_minutes INTEGER,
    notes VARCHAR(300),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_logs_item_calendar FOREIGN KEY (item_definition_id, calendar_id) 
        REFERENCES health_item_definitions(id, calendar_id) ON DELETE CASCADE
);

CREATE INDEX idx_logs_calendar_date ON health_event_logs(calendar_id, logged_at);

---

## 6. Deterministic Correlation Algorithm & Thresholds
File: shared/src/correlation.ts

export interface HealthEvent {
  id: string;
  itemDefinitionId: string;
  loggedAt: string; // ISO 8601 UTC
}

export interface PatternThreshold {
  triggerId: string;
  symptomId: string;
  occurrences: number;
  category: 'Vigilar posible patrón' | 'Patrón detectado';
}

// The algorithm must:
// 1. Iterate over triggers/medications and symptoms.
// 2. Validate deltaHours (0 <= deltaHours <= calendar.correlation_window_hours).
// 3. Group valid matches by unique pair (triggerId - symptomId).
// 4. Count occurrences per pair.
// 5. Categorize: 3 to 6 occurrences -> 'Vigilar posible patrón'. >= 7 occurrences -> 'Patrón detectado'.

---

## 7. Multi-Tenancy, Security & Governance

- Timezone Governance: All timestamps are stored in UTC (ISO 8601 with `Z`). Local timezone conversion occurs strictly at the presentation layer via `dayjs`.
- Repository-Level Isolation: All operations verify user identity through relational joins:
  SELECT l.* FROM health_event_logs l
  JOIN calendar_profiles p ON l.calendar_id = p.id
  WHERE p.user_id = $current_user_id AND l.calendar_id = $calendar_id;
- Input Sanitization: Free-text inputs (notes) are sanitized using `DOMPurify.sanitize()`.
- GDPR Compliance: Client-side JSON export for Art. 20. Atomic cascade deletion for Art. 17.

---

## 8. Architectural Decision Records (ADRs)

- ADR-001: Deterministic Math Engine for Correlation
  - Decision: Pure deterministic algorithm with 100% unit test coverage based on dynamically configured time windows per profile.
- ADR-002: Client-Side GDPR Portability & Atomic Right to Be Forgotten
  - Decision: Client-side JSON export for Art. 20; transactional cascading delete for Art. 17.
- ADR-003: Non-Zero Calendar Profile Invariant
  - Decision: Enforce that profile deletion is disabled if `profiles.length <= 1`.
- ADR-004: Zero Hidden Clinical Data via Dynamic Cell Expansion
  - Decision: Day cells dynamically expand vertically (`min-h-[110px] h-full`). Conventional truncation ("+X más") is prohibited.
- ADR-005: Composite Keys for Multi-Tenant Integrity
  - Decision: Enforce `UNIQUE (id, calendar_id)` on items and a composite foreign key on logs to strictly prevent cross-calendar data corruption.
- ADR-006: Historical Immutability via Soft Delete and Parent Grouping
  - Decision: Edits to items that alter their data collection (intensity/duration) will mark the original as inactive and create a new one with a `parent_id`. This ensures the visual integrity of historical records and allows analytics to group the item's entire trajectory.
- ADR-007: PWA Offline-First Strategy and Rate Limiting
  - Decision: Implementation of a mutation queue in IndexedDB for offline operability (Background Sync API). At the infrastructure level, deployment of `express-rate-limit` with strict rules on `/api/auth/*` to prevent brute-force attacks.
- ADR-008: Mandatory E2E Coverage for GDPR Destructive Workflows
  - Decision: Critical privacy flows, specifically the Art. 17 right to be forgotten (account deletion), must be strictly covered by Playwright E2E tests to ensure destructive operations function flawlessly and client state is completely purged.
- ADR-009: Global Error Boundary
  - Decision: Implement Vue's `app.config.errorHandler` coupled with a fallback component to intercept uncaught exceptions, maintaining a robust and trustworthy user experience in a health-tracking context.
  - ADR-010: Local Infrastructure via Docker
  - Decision: Utilize `docker-compose.yml` to provision the local PostgreSQL database and containerize the Express backend (`Dockerfile`) to demonstrate infrastructure-as-code and container orchestration competencies.
- ADR-011: Strict Quality Gates via Husky
  - Decision: Implement Husky pre-commit hooks to strictly enforce `tsc -b` (type checking) and Vitest before allowing code commits, preventing broken code from reaching the repository.
- ADR-012: Full-Stack Observability via Sentry
  - Decision: Integrate Sentry SDKs in both Vue (client) and Express (server) to trace unhandled exceptions, monitor release health, and demonstrate production-readiness.