-- =====================================================================
-- CuidaT · Neon · PASO 4 · Prueba de humo del esquema
-- Comprueba que las restricciones "atan" los datos como dice TECH_SPEC.md.
-- Todo ocurre dentro de un único bloque DO: crea usuarios de prueba, ejercita
-- cada regla y, si todo va bien, los borra con la cascada de la cuenta
-- (que además prueba el derecho al olvido). Si algo falla, se revierte
-- por completo y el mensaje empieza por "FAIL". Éxito: NOTICE "SMOKE TEST OK".
-- =====================================================================
DO $$
DECLARE
    u1 UUID := gen_random_uuid();  u2 UUID := gen_random_uuid();
    p1 UUID := gen_random_uuid();  p2 UUID := gen_random_uuid();
    sym UUID := gen_random_uuid(); sym_v2 UUID := gen_random_uuid();
    trg UUID := gen_random_uuid(); other UUID := gen_random_uuid();
    n INT;
BEGIN
    INSERT INTO users (id, email, password_hash) VALUES
        (u1, 'smoke-a@example.test', 'x'), (u2, 'smoke-b@example.test', 'x');
    INSERT INTO calendar_profiles (id, user_id, name, profile_type) VALUES
        (p1, u1, 'Moby', 'pet'), (p2, u2, 'Otra', 'adult');
    INSERT INTO health_item_definitions (id, calendar_id, root_id, name, emoji, category, track_intensity) VALUES
        (sym, p1, sym, 'Vómito', 'V', 'symptom', TRUE),
        (trg, p1, trg, 'Pescado', 'P', 'trigger', FALSE),  -- como en PRESET_ITEMS: sin intensidad
        (other, p2, other, 'Otro', 'O', 'trigger', TRUE);

    -- Usuarios: email en minúsculas y único
    BEGIN INSERT INTO users (email, password_hash) VALUES ('Smoke@Example.test', 'x');
        RAISE EXCEPTION 'FAIL: email con mayúsculas aceptado';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN INSERT INTO users (email, password_hash) VALUES ('smoke-a@example.test', 'x');
        RAISE EXCEPTION 'FAIL: email duplicado aceptado';
    EXCEPTION WHEN unique_violation THEN NULL; END;

    -- Perfiles: tipo libre pero no vacío, y ventana de correlación válida
    BEGIN INSERT INTO calendar_profiles (user_id, name, profile_type) VALUES (u1, 'X', '   ');
        RAISE EXCEPTION 'FAIL: profile_type vacío aceptado';
    EXCEPTION WHEN check_violation THEN NULL; END;
    INSERT INTO calendar_profiles (user_id, name, profile_type) VALUES (u1, 'Ficus', 'Planta'); -- tipo definido por el usuario
    BEGIN INSERT INTO calendar_profiles (user_id, name, profile_type, correlation_window_hours) VALUES (u1, 'X', 'pet', 5);
        RAISE EXCEPTION 'FAIL: ventana de 5 h aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;

    -- Ítems: categoría válida, linaje coherente, una sola versión vigente
    BEGIN INSERT INTO health_item_definitions (calendar_id, root_id, name, emoji, category)
        VALUES (p1, gen_random_uuid(), 'X', 'X', 'food');
        RAISE EXCEPTION 'FAIL: categoría inválida aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN INSERT INTO health_item_definitions (calendar_id, root_id, parent_id, name, emoji, category)
        VALUES (p1, sym, sym, 'Vómito', 'V', 'symptom');
        RAISE EXCEPTION 'FAIL: segunda versión vigente aceptada';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN INSERT INTO health_item_definitions (id, calendar_id, root_id, name, emoji, category)
        VALUES (gen_random_uuid(), p1, sym, 'X', 'X', 'symptom');
        RAISE EXCEPTION 'FAIL: versión sin padre aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;

    -- Versionado correcto: la vigente pasa a superseded y entra la nueva
    UPDATE health_item_definitions SET status = 'superseded' WHERE id = sym;
    INSERT INTO health_item_definitions (id, calendar_id, root_id, parent_id, name, emoji, category, track_duration)
        VALUES (sym_v2, p1, sym, sym, 'Vómito', 'V', 'symptom', TRUE);

    -- Ítems: la categoría, las métricas y el linaje no cambian en sitio; una versión sustituida es terminal
    BEGIN UPDATE health_item_definitions SET category = 'medication' WHERE id = trg;
        RAISE EXCEPTION 'FAIL: cambio de categoría aceptado';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN UPDATE health_item_definitions SET track_intensity = NOT track_intensity WHERE id = trg;
        RAISE EXCEPTION 'FAIL: cambio de métricas en sitio aceptado';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN UPDATE health_item_definitions SET status = 'active' WHERE id = sym;
        RAISE EXCEPTION 'FAIL: versión sustituida reactivada';
    EXCEPTION WHEN check_violation THEN NULL; END;
    UPDATE health_item_definitions SET name = 'Vómito agudo' WHERE root_id = sym;  -- renombrar aplica a todo el linaje

    -- Padre o raíz de otro calendario: rechazado
    BEGIN INSERT INTO health_item_definitions (calendar_id, root_id, parent_id, name, emoji, category, status)
        VALUES (p1, sym, other, 'X', 'X', 'symptom', 'superseded');
        RAISE EXCEPTION 'FAIL: padre de otro calendario aceptado';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN INSERT INTO health_item_definitions (calendar_id, root_id, parent_id, name, emoji, category, status)
        VALUES (p1, other, sym, 'X', 'X', 'symptom', 'superseded');
        RAISE EXCEPTION 'FAIL: raíz de otro calendario aceptada';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;

    -- Registros: válidos en su calendario, nunca contra ítems de otro
    INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, intensity) VALUES
        (p1, sym, NOW() - INTERVAL '3 hours', 2),       -- versión antigua
        (p1, sym_v2, NOW() - INTERVAL '2 hours', NULL), -- versión nueva
        (p1, trg, NOW() - INTERVAL '5 hours', NULL);
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at) VALUES (p1, other, NOW());
        RAISE EXCEPTION 'FAIL: registro contra ítem de otro calendario aceptado';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, intensity) VALUES (p1, trg, NOW(), 4);
        RAISE EXCEPTION 'FAIL: intensidad 4 aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, duration_minutes) VALUES (p1, trg, NOW(), 0);
        RAISE EXCEPTION 'FAIL: duración 0 aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, notes) VALUES (p1, trg, NOW(), repeat('a', 301));
        RAISE EXCEPTION 'FAIL: nota de 301 caracteres aceptada';
    EXCEPTION WHEN string_data_right_truncation THEN NULL; END;

    -- Métricas: solo las que la versión del ítem registra
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, intensity) VALUES (p1, trg, NOW(), 2);
        RAISE EXCEPTION 'FAIL: intensidad en un ítem que no la registra aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;
    INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, duration_minutes)
        VALUES (p1, sym_v2, NOW() - INTERVAL '1 hour', 30);  -- sym_v2 sí registra duración

    -- Fecha futura y notas en blanco: rechazadas
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at) VALUES (p1, trg, NOW() + INTERVAL '1 day');
        RAISE EXCEPTION 'FAIL: registro en el futuro aceptado';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN INSERT INTO health_event_logs (calendar_id, item_definition_id, logged_at, notes) VALUES (p1, trg, NOW(), '   ');
        RAISE EXCEPTION 'FAIL: nota formada solo por espacios aceptada';
    EXCEPTION WHEN check_violation THEN NULL; END;

    -- Eliminación definitiva del linaje: borrar la raíz elimina versiones y registros
    DELETE FROM health_item_definitions WHERE id = sym AND calendar_id = p1;
    SELECT count(*) INTO n FROM health_item_definitions WHERE root_id = sym;
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL: el linaje no se eliminó entero (% filas)', n; END IF;
    SELECT count(*) INTO n FROM health_event_logs WHERE item_definition_id IN (sym, sym_v2);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL: quedaron % registros del linaje', n; END IF;
    SELECT count(*) INTO n FROM health_event_logs WHERE item_definition_id = trg;
    IF n <> 1 THEN RAISE EXCEPTION 'FAIL: se borraron registros de otro ítem (quedan %)', n; END IF;

    -- Derecho al olvido: borrar el usuario elimina perfiles, ítems y registros
    DELETE FROM users WHERE id IN (u1, u2);
    SELECT count(*) INTO n FROM calendar_profiles WHERE id IN (p1, p2);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL: quedaron perfiles tras borrar la cuenta'; END IF;
    SELECT count(*) INTO n FROM health_item_definitions WHERE calendar_id IN (p1, p2);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL: quedaron ítems tras borrar la cuenta'; END IF;
    SELECT count(*) INTO n FROM health_event_logs WHERE calendar_id IN (p1, p2);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL: quedaron registros tras borrar la cuenta'; END IF;

    RAISE NOTICE 'SMOKE TEST OK: todas las restricciones se comportan como se espera';
END $$;
