-- Add slug column to vessels table for URL-friendly identifiers
ALTER TABLE public.vessels ADD COLUMN slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX vessels_slug_key ON public.vessels(slug);

-- Generate slugs from bow_number for existing records
-- Convert to lowercase, replace spaces with hyphens, remove special characters
UPDATE public.vessels 
SET slug = lower(regexp_replace(bow_number, '[^a-zA-Z0-9\s-]', '', 'g'))
WHERE slug IS NULL AND bow_number IS NOT NULL;

-- Replace spaces with hyphens in the generated slugs
UPDATE public.vessels 
SET slug = regexp_replace(slug, '\s+', '-', 'g')
WHERE slug IS NOT NULL;

-- Set NOT NULL constraint after data migration
ALTER TABLE public.vessels ALTER COLUMN slug SET NOT NULL;
