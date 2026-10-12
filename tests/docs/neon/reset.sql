-- =====================================================================
-- CuidaT · Neon · PASO 1 (DESTRUCTIVO, solo la primera vez)
-- Elimina TODO el contenido del esquema "public" de la base de datos a la
-- que estés conectado: tablas, datos, relaciones, índices y funciones.
-- Comprueba en el SQL Editor de Neon que estás en la rama y base correctas
-- (rama principal, base "neondb") ANTES de pulsar Run.
-- Después de este paso NO se vuelve a ejecutar: el resto del tiempo se usa
-- `npm run db:migrate`, que nunca borra datos.
-- =====================================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
