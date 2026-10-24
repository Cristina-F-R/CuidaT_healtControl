-- El tema de color del calendario solo admite la paleta de TECH_SPEC.md (sección 2), como la ventana de
-- correlación. Hasta ahora la API aceptaba texto libre: cualquier otro valor vuelve al tema por defecto.
UPDATE calendar_profiles
    SET color_theme = 'slate'
    WHERE color_theme NOT IN ('slate', 'peach', 'sky', 'mint');

ALTER TABLE calendar_profiles
    ADD CONSTRAINT ck_profile_color_theme CHECK (color_theme IN ('slate', 'peach', 'sky', 'mint'));
