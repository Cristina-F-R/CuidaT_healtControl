-- =====================================================================
-- CuidaT · Neon · PASO 3
-- Registra 001_init como aplicada para que `npm run db:migrate` no la
-- vuelva a ejecutar. Solo hace falta si creaste las tablas a mano desde el
-- SQL Editor (si usas `npm run db:reset`, la migración ya lo hace).
-- =====================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;
