-- Rename HQ-OLCF6 to OLCF6 and update assignments to match OLCF6 only
DO $$
DECLARE
    v_vessel_id UUID;
BEGIN
    -- 1. Update the bow_number of hq-inventory vessel to 'OLCF6'
    UPDATE public.vessels
    SET bow_number = 'OLCF6'
    WHERE slug = 'hq-inventory';

    -- 2. Find the vessel ID
    SELECT id INTO v_vessel_id FROM public.vessels WHERE slug = 'hq-inventory' LIMIT 1;

    IF v_vessel_id IS NOT NULL THEN
        -- 3. Unassign items that do NOT match 'OLCF6' in their unique code but are currently assigned to this vessel
        --    (e.g., items that were assigned because they matched '%HQ%' only)
        
        -- Clean up current_assignment_id in items
        UPDATE public.items
        SET vessel_id = NULL,
            current_assignment_id = NULL
        WHERE vessel_id = v_vessel_id
        AND unique_code NOT ILIKE '%OLCF6%';

        -- Deactivate or delete assignments in vessel_item_assignments for these unassigned items
        DELETE FROM public.vessel_item_assignments
        WHERE vessel_id = v_vessel_id
        AND item_id IN (
            SELECT id FROM public.items WHERE unique_code NOT ILIKE '%OLCF6%'
        );

        -- 4. Ensure all items with 'OLCF6' in their unique code are assigned to it
        UPDATE public.items
        SET vessel_id = v_vessel_id
        WHERE unique_code ILIKE '%OLCF6%'
        AND (vessel_id IS NULL OR vessel_id != v_vessel_id);

        -- 5. Create assignments for these OLCF6 items
        INSERT INTO public.vessel_item_assignments (item_id, vessel_id, is_current)
        SELECT i.id, v_vessel_id, true
        FROM public.items i
        WHERE i.vessel_id = v_vessel_id
        AND NOT EXISTS (
            SELECT 1 FROM public.vessel_item_assignments via 
            WHERE via.item_id = i.id AND via.vessel_id = v_vessel_id AND via.is_current = true
        )
        ON CONFLICT DO NOTHING;

        -- 6. Update items.current_assignment_id for these items
        UPDATE public.items i
        SET current_assignment_id = via.id
        FROM public.vessel_item_assignments via
        WHERE i.id = via.item_id
        AND via.vessel_id = v_vessel_id
        AND via.is_current = true
        AND (i.current_assignment_id IS NULL OR i.current_assignment_id != via.id);
    END IF;
END $$;
