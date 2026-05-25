-- Create item_transfer_logs table
CREATE TABLE public.item_transfer_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    old_vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    new_vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    old_unique_code TEXT,
    new_unique_code TEXT,
    action TEXT NOT NULL DEFAULT 'Transferred',
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.item_transfer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read item_transfer_logs" ON public.item_transfer_logs
    FOR SELECT
    USING (true);

-- No insert/update from client, edge function uses service role
