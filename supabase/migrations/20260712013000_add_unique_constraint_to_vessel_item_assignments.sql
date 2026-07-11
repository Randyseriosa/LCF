-- Clean up duplicate active vessel assignments, keeping the latest one
WITH RankedAssignments AS (
    SELECT 
        id,
        item_id,
        ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY assigned_at DESC, created_at DESC, id DESC) as rn
    FROM 
        public.vessel_item_assignments
    WHERE 
        is_current = true
)
UPDATE public.vessel_item_assignments
SET is_current = false
WHERE is_current = true
  AND id IN (
      SELECT id 
      FROM RankedAssignments 
      WHERE rn > 1
  );

-- Add a unique index to prevent an item from having multiple current assignments
CREATE UNIQUE INDEX idx_vessel_item_assignments_unique_current 
ON public.vessel_item_assignments (item_id) 
WHERE (is_current = true);
