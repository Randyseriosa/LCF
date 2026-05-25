-- Create vessel_item_assignments table to track item-to-vessel assignments
-- This supports current assignment tracking and future transfer functionality

CREATE TABLE public.vessel_item_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    is_current BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vessel_item_assignments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view vessel_item_assignments
CREATE POLICY "Authenticated users can view vessel_item_assignments"
    ON public.vessel_item_assignments FOR SELECT TO authenticated
    USING (true);

-- Insert/Update/Delete will be handled via Edge Functions (service_role key)
-- No INSERT, UPDATE, DELETE policies - following "Deny by Default" rule

-- Add index for performance on item_id and vessel_id
CREATE INDEX idx_vessel_item_assignments_item_id ON public.vessel_item_assignments(item_id);
CREATE INDEX idx_vessel_item_assignments_vessel_id ON public.vessel_item_assignments(vessel_id);
CREATE INDEX idx_vessel_item_assignments_is_current ON public.vessel_item_assignments(is_current);

-- Add current_assignment_id column to items table
ALTER TABLE public.items ADD COLUMN current_assignment_id UUID REFERENCES public.vessel_item_assignments(id) ON DELETE SET NULL;

-- Update items RLS to allow Admin and Encoder to update current_assignment_id
-- This will be handled via Edge Functions, but we need a policy for the service_role bypass
-- No additional policies needed as mutations go through Edge Functions
