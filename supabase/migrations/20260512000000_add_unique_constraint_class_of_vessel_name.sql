-- Add unique constraint on class_of_vessel.name to prevent duplicates
ALTER TABLE public.class_of_vessel ADD CONSTRAINT class_of_vessel_name_unique UNIQUE (name);
