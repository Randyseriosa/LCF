-- Add sort_order column to class_of_vessel for drag-and-drop ordering
ALTER TABLE public.class_of_vessel ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Seed existing rows with incremental sort_order based on creation time
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.class_of_vessel
)
UPDATE public.class_of_vessel
SET sort_order = ranked.rn
FROM ranked
WHERE public.class_of_vessel.id = ranked.id;
