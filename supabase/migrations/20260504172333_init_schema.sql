-- Migration generated from db_structure.md

-- Enum alternatives using CHECK constraints (per memory rules preferring Explicit Strings)
-- We will just use text fields with CHECK constraints because they are easier to manage than native ENUMs and align well.

-- ==========================================
-- 1. Users & Auth
-- ==========================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'encoder', 'viewer')),
    is_active TEXT NOT NULL DEFAULT 'inactive' CHECK (is_active IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile.
-- Admin could read other profiles, but complex visibility rules can be managed in Edge functions if needed,
-- or we can provide a basic policy for authenticated users if they need to see members.
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT TO authenticated 
    USING (auth.uid() = id);

-- ==========================================
-- 2. Core Master Data
-- ==========================================
CREATE TABLE public.vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vessels" 
    ON public.vessels FOR SELECT TO authenticated 
    USING (true);

CREATE TABLE public.equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view equipments" 
    ON public.equipments FOR SELECT TO authenticated 
    USING (true);

CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_spare TEXT NOT NULL DEFAULT 'standard' CHECK (is_spare IN ('standard', 'spare')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view items" 
    ON public.items FOR SELECT TO authenticated 
    USING (true);

-- ==========================================
-- 3. Monthly Report Data
-- ==========================================
CREATE TABLE public.monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    report_month DATE NOT NULL,
    imported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view monthly_reports" 
    ON public.monthly_reports FOR SELECT TO authenticated 
    USING (true);

CREATE TABLE public.monthly_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view monthly_report_items" 
    ON public.monthly_report_items FOR SELECT TO authenticated 
    USING (true);

-- Create, Update, Delete queries should be executed via Edge Functions (which bypass RLS via service_role),
-- therefore we intentionally omit INSERT, UPDATE, and DELETE policies here, strictly enforcing "Deny by Default" for mutations.
