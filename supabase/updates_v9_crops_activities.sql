-- =====================================================================
-- Actualizaciones SQL V9: Mejoras del Módulo de Cultivos y Labores
-- =====================================================================

-- 1. Agregar crop_id a activities para imputación directa de costos
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL;

-- 2. Función para registrar o actualizar el cultivo de un lote en una campaña
CREATE OR REPLACE FUNCTION public.set_paddock_campaign_crop(
    p_paddock_id UUID,
    p_campaign_id UUID,
    p_crop_id UUID
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.paddock_campaign_crops (paddock_id, campaign_id, crop_id)
    VALUES (p_paddock_id, p_campaign_id, p_crop_id)
    ON CONFLICT (paddock_id, campaign_id) 
    DO UPDATE SET crop_id = EXCLUDED.crop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para registrar el rendimiento de cosecha
CREATE OR REPLACE FUNCTION public.set_paddock_campaign_yield(
    p_paddock_id UUID,
    p_campaign_id UUID,
    p_yield_kg_ha NUMERIC
)
RETURNS void AS $$
BEGIN
    -- Solo actualiza si ya existe la relación lote-campaña
    UPDATE public.paddock_campaign_crops
    SET yield_kg_ha = p_yield_kg_ha
    WHERE paddock_id = p_paddock_id AND campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar la vista de Lotes para incluir yield_kg_ha
DROP VIEW IF EXISTS public.v_paddocks;

CREATE OR REPLACE VIEW public.v_paddocks AS
SELECT 
    p.id,
    p.farm_id,
    p.name,
    COALESCE(pcc.crop_id, p.crop_id) AS crop_id,
    p.area,
    p.ndvi,
    pcc.yield_kg_ha AS yield_kg_ha,
    st_asgeojson(p.boundary)::jsonb AS boundary,
    p.last_updated,
    p.created_at
FROM public.paddocks p
LEFT JOIN public.campaigns c ON c.farm_id = p.farm_id AND c.is_active = true
LEFT JOIN public.paddock_campaign_crops pcc ON pcc.paddock_id = p.id AND pcc.campaign_id = c.id;
