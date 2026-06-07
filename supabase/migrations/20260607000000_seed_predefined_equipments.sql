-- Seed pre-defined equipment entries
-- These are system-level equipments that should always exist.
-- We use INSERT ... ON CONFLICT DO NOTHING to avoid duplicates on re-runs.

-- Add is_predefined flag to distinguish system equipments from user-created ones
ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS is_predefined BOOLEAN NOT NULL DEFAULT FALSE;

-- Insert the 5 pre-defined equipments
INSERT INTO public.equipments (name, unique_code, equipment_type, is_predefined)
VALUES
  ('Weapon Equipment',        'WE', 'weapon',        TRUE),
  ('Communication Equipment', 'CE', 'communication', TRUE),
  ('Navigational Equipment',  'NE', 'navigational',  TRUE),
  ('IT Equipment',            'IE', 'ict',            TRUE),
  ('Ammunition',              'AM', 'ammunitions',    TRUE)
ON CONFLICT (unique_code) DO UPDATE
  SET is_predefined = TRUE;

-- Add a check constraint to prevent deletion of predefined equipments via DB
-- (Edge function will enforce this on the app layer as well)
COMMENT ON COLUMN public.equipments.is_predefined IS 'TRUE for system-seeded equipments that cannot be deleted by users.';
