-- Create the class_of_vessel table
CREATE TABLE public.class_of_vessel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.class_of_vessel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view class_of_vessel" 
    ON public.class_of_vessel FOR SELECT TO authenticated 
    USING (true);

-- Migrate existing text data from vessels.class_of_vessel into the new table
INSERT INTO public.class_of_vessel (name)
SELECT DISTINCT class_of_vessel FROM public.vessels WHERE class_of_vessel IS NOT NULL;

-- Add a temporary column to hold the UUID reference
ALTER TABLE public.vessels ADD COLUMN class_of_vessel_uuid UUID REFERENCES public.class_of_vessel(id) ON DELETE RESTRICT;

-- Map the UUIDs back to the vessels
UPDATE public.vessels v
SET class_of_vessel_uuid = c.id
FROM public.class_of_vessel c
WHERE v.class_of_vessel = c.name;

-- Drop the old text column and rename the new UUID column
ALTER TABLE public.vessels DROP COLUMN class_of_vessel;
ALTER TABLE public.vessels RENAME COLUMN class_of_vessel_uuid TO class_of_vessel;

-- Finally, add the bow_number column to vessels
ALTER TABLE public.vessels ADD COLUMN bow_number TEXT;
