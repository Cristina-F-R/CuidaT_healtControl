-- Informes guardados (TECH_SPEC.md, sección 9.1; ADR-022). Cada informe es una instantánea inmutable de un
-- calendario en un periodo, generada por el servidor. Sin user_id: se accede siempre con JOIN a
-- calendar_profiles, y se borra en cascada con su calendario y, a través de él, con la cuenta.
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
