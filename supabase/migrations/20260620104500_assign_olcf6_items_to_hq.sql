-- Assign items with 'OLCF6' in their unique code to the HQ-OLCF6 vessel
DO $$
DECLARE
    v_vessel_id UUID;
BEGIN
    -- 1. Find the HQ-OLCF6 vessel ID
    SELECT id INTO v_vessel_id FROM public.vessels WHERE slug = 'hq-inventory' OR bow_number = 'HQ-OLCF6' LIMIT 1;

    IF v_vessel_id IS NOT NULL THEN
        -- 2. Update items that match the criteria but haven't been assigned yet
        --    or are assigned to the wrong vessel.
        UPDATE public.items
        SET vessel_id = v_vessel_id
        WHERE (unique_code ILIKE '%OLCF6%' OR unique_code ILIKE '%HQ%')
        AND (vessel_id IS NULL OR vessel_id != v_vessel_id);

        -- 3. Create assignments for these items
        INSERT INTO public.vessel_item_assignments (item_id, vessel_id, is_current)
        SELECT i.id, v_vessel_id, true
        FROM public.items i
        WHERE i.vessel_id = v_vessel_id
        AND NOT EXISTS (
            SELECT 1 FROM public.vessel_item_assignments via 
            WHERE via.item_id = i.id AND via.vessel_id = v_vessel_id AND via.is_current = true
        )
        ON CONFLICT DO NOTHING;

        -- 4. Update items.current_assignment_id
        UPDATE public.items i
        SET current_assignment_id = via.id
        FROM public.vessel_item_assignments via
        WHERE i.id = via.item_id
        AND via.vessel_id = v_vessel_id
        AND via.is_current = true
        AND (i.current_assignment_id IS NULL OR i.current_assignment_id != via.id);
    END IF;
END $$;
