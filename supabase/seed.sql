-- Seed data for Class of Vessel and Bow numbers
DO $$
DECLARE
    v_class_id UUID;
    v_sort_order INTEGER;
BEGIN
    SELECT COALESCE(MAX(sort_order), 0) INTO v_sort_order FROM public.class_of_vessel;
    
    -- Navarette-class Patrol Craft
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('Navarette-class Patrol Craft', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;
    
    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'PC394', 'pc394'),
    (v_class_id, 'PC396', 'pc396')
    ON CONFLICT (slug) DO NOTHING;

    -- Acero-class Patrol Gunboat
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('Acero-class Patrol Gunboat', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'PG200', 'pg200'),
    (v_class_id, 'PG203', 'pg203'),
    (v_class_id, 'PG204', 'pg204'),
    (v_class_id, 'PG205', 'pg205'),
    (v_class_id, 'PG206', 'pg206'),
    (v_class_id, 'PG207', 'pg207'),
    (v_class_id, 'PG208', 'pg208')
    ON CONFLICT (slug) DO NOTHING;

    -- 1st Boat Attack Division
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('1st Boat Attack Division', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'BA482', 'ba482'),
    (v_class_id, 'BA483', 'ba483'),
    (v_class_id, 'BA484', 'ba484')
    ON CONFLICT (slug) DO NOTHING;

    -- 2nd Boat Attack Division
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('2nd Boat Attack Division', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'BA485', 'ba485'),
    (v_class_id, 'BA486', 'ba486'),
    (v_class_id, 'BA487', 'ba487')
    ON CONFLICT (slug) DO NOTHING;

    -- 3rd Boat Attack Division
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('3rd Boat Attack Division', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'BA488', 'ba488'),
    (v_class_id, 'BA489', 'ba489'),
    (v_class_id, 'BA491', 'ba491')
    ON CONFLICT (slug) DO NOTHING;

    -- 4th Boat Attack Division
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('4th Boat Attack Division', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'BA492', 'ba492'),
    (v_class_id, 'BA493', 'ba493'),
    (v_class_id, 'BA494', 'ba494')
    ON CONFLICT (slug) DO NOTHING;

    -- Cyclone-class Patrol Ship
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('Cyclone-class Patrol Ship', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'PS176', 'ps176'),
    (v_class_id, 'PS177', 'ps177'),
    (v_class_id, 'PS178', 'ps178')
    ON CONFLICT (slug) DO NOTHING;

    -- 5TH Patrol Boat Division
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('5TH Patrol Boat Division', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'PB356', 'pb356'),
    (v_class_id, 'PB357', 'pb357'),
    (v_class_id, 'PB358', 'pb358'),
    (v_class_id, 'PB359', 'pb359')
    ON CONFLICT (slug) DO NOTHING;

    -- Small Boats
    v_sort_order := v_sort_order + 1;
    INSERT INTO public.class_of_vessel (name, sort_order) 
    VALUES ('Small Boats', v_sort_order)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    INSERT INTO public.vessels (class_of_vessel, bow_number, slug) VALUES 
    (v_class_id, 'DB412', 'db412')
    ON CONFLICT (slug) DO NOTHING;

END
$$;
