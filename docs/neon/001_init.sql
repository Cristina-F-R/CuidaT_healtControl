-- =====================================================================
-- CuidaT · Migración 001_init (esquema inicial)
-- Copia idéntica en server/src/db/migrations/001_init.sql
-- No contiene DROP: es seguro de aplicar sobre un esquema vacío.
-- Todavía no está aplicada en ningún entorno (ADR-014), por eso sus reglas
-- de integridad se incluyen aquí y no en una migración 002.
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
    notes VARCHAR(300) CHECK (notes IS NULL OR length(btrim(notes)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- last-write-wins en la sincronización offline
    CONSTRAINT fk_logs_item_calendar FOREIGN KEY (item_definition_id, calendar_id)
        REFERENCES health_item_definitions(id, calendar_id) ON DELETE CASCADE
);

CREATE INDEX idx_logs_calendar_date ON health_event_logs(calendar_id, logged_at);
CREATE INDEX idx_logs_item ON health_event_logs(item_definition_id);

-- =====================================================================
-- Reglas que un CHECK no puede expresar (TECH_SPEC.md section 5).
-- El servidor las valida antes (Zod y reglas de dominio); estos triggers
-- son la última barrera si una ruta de código falla.
-- =====================================================================

-- 1. Un registro solo guarda las métricas que su versión del ítem registra.
CREATE FUNCTION check_log_metrics() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    tracks_intensity BOOLEAN;
    tracks_duration BOOLEAN;
BEGIN
    SELECT track_intensity, track_duration INTO tracks_intensity, tracks_duration
    FROM health_item_definitions
    WHERE id = NEW.item_definition_id AND calendar_id = NEW.calendar_id;

    IF NEW.intensity IS NOT NULL AND NOT tracks_intensity THEN
        RAISE EXCEPTION 'el ítem no registra intensidad' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.duration_minutes IS NOT NULL AND NOT tracks_duration THEN
        RAISE EXCEPTION 'el ítem no registra duración' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_logs_metrics
    BEFORE INSERT OR UPDATE ON health_event_logs
    FOR EACH ROW EXECUTE FUNCTION check_log_metrics();

-- 2. Ninguna fecha de registro más de 5 minutos en el futuro (tolerancia de reloj, TECH_SPEC use case 8).
--    Solo se revisa al crear o al cambiar logged_at, para no bloquear ediciones de registros antiguos.
CREATE FUNCTION check_log_not_future() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR NEW.logged_at IS DISTINCT FROM OLD.logged_at)
       AND NEW.logged_at > now() + INTERVAL '5 minutes' THEN
        RAISE EXCEPTION 'logged_at no puede estar en el futuro' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_logs_not_future
    BEFORE INSERT OR UPDATE ON health_event_logs
    FOR EACH ROW EXECUTE FUNCTION check_log_not_future();

-- 3. Un ítem es inmutable en su identidad, su categoría y sus métricas: un cambio de
--    intensidad o duración crea una versión nueva (ADR-006). Una versión sustituida es terminal.
CREATE FUNCTION check_item_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.calendar_id IS DISTINCT FROM OLD.calendar_id
       OR NEW.root_id IS DISTINCT FROM OLD.root_id
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.track_intensity IS DISTINCT FROM OLD.track_intensity
       OR NEW.track_duration IS DISTINCT FROM OLD.track_duration
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'la categoría y las métricas de un ítem no cambian: crea una versión nueva'
            USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status = 'superseded' AND NEW.status <> 'superseded' THEN
        RAISE EXCEPTION 'una versión sustituida no vuelve a estar vigente' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_items_immutable
    BEFORE UPDATE ON health_item_definitions
    FOR EACH ROW EXECUTE FUNCTION check_item_update();
