-- Add INSERT, UPDATE, DELETE policies for items table
-- Allow admin and encoder roles to manage items

CREATE POLICY "Admin and encoder can insert items"
    ON public.items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'encoder')
        )
    );

CREATE POLICY "Admin and encoder can update items"
    ON public.items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'encoder')
        )
    );

CREATE POLICY "Admin and encoder can delete items"
    ON public.items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'encoder')
        )
    );
