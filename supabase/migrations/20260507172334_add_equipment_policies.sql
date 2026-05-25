-- Add INSERT, UPDATE, DELETE policies for equipments table
-- Allow admin and encoder roles to manage equipment

CREATE POLICY "Admin and encoder can insert equipment"
    ON public.equipments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'encoder')
        )
    );

CREATE POLICY "Admin and encoder can update equipment"
    ON public.equipments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'encoder')
        )
    );

CREATE POLICY "Admin and encoder can delete equipment"
    ON public.equipments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'encoder')
        )
    );
