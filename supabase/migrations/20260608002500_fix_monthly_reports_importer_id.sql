-- Fix monthly_reports.imported_by data
-- Some records might have been stored using auth_user_id instead of profiles.id
-- This migration updates those records to use the correct profiles.id reference

UPDATE public.monthly_reports mr
SET imported_by = p.id
FROM public.profiles p
WHERE mr.imported_by = p.auth_user_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = mr.imported_by);
