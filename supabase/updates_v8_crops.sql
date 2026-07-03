-- =====================================================================
-- Actualizaciones SQL V8: Políticas RLS para la tabla Crops (Cultivos)
-- =====================================================================

-- 1. Políticas RLS para permitir CRUD a usuarios autenticados
CREATE POLICY "Permitir inserción de cultivos a usuarios autenticados" ON public.crops
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualización de cultivos a usuarios autenticados" ON public.crops
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir eliminación de cultivos a usuarios autenticados" ON public.crops
    FOR DELETE TO authenticated USING (true);
