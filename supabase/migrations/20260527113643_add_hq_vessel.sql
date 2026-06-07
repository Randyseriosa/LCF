-- Add HQ Inventory as a vessel to support monthly reporting
DO $$
DECLARE
    v_class_id UUID;
BEGIN
    -- Create class for Headquarters if it doesn't exist
    INSERT INTO public.class_of_vessel (name, sort_order)
    VALUES ('Headquarters', 0)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_class_id;

    -- Insert HQ Inventory as a "vessel"
    INSERT INTO public.vessels (class_of_vessel, bow_number, slug)
    VALUES (v_class_id, 'HQ-OLCF6', 'hq-inventory')
    ON CONFLICT (slug) DO NOTHING;
END $$;
