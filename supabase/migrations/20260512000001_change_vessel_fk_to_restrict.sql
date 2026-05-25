-- Change vessel foreign key constraint from CASCADE to RESTRICT
-- This prevents deleting a vessel if it has assigned items

-- First, drop the existing foreign key constraint
ALTER TABLE public.vessel_item_assignments DROP CONSTRAINT vessel_item_assignments_vessel_id_fkey;

-- Re-add the constraint with ON DELETE RESTRICT
ALTER TABLE public.vessel_item_assignments 
ADD CONSTRAINT vessel_item_assignments_vessel_id_fkey 
FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE RESTRICT;
