-- =====================================================================
-- CuidaT · Migración 001_init (esquema inicial)
-- Copia idéntica en server/src/db/migrations/001_init.sql
-- No contiene DROP: es seguro de aplicar sobre un esquema vacío.
-- Los UUID los genera el cliente (crypto.randomUUID()); gen_random_uuid()
-- es solo el valor por defecto de reserva (integrado en PostgreSQL 13+).
-- =====================================================================

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
    color_theme VARCHAR(50) NOT NULL DEFAULT 'slate',
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
    notes VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- last-write-wins en la sincronización offline
    CONSTRAINT fk_logs_item_calendar FOREIGN KEY (item_definition_id, calendar_id)
        REFERENCES health_item_definitions(id, calendar_id) ON DELETE CASCADE
);

CREATE INDEX idx_logs_calendar_date ON health_event_logs(calendar_id, logged_at);
CREATE INDEX idx_logs_item ON health_event_logs(item_definition_id);
