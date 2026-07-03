-- =====================================================================
-- Actualizaciones SQL V10: Agronomía Avanzada y Finanzas
-- =====================================================================

-- 1. Eliminar la restricción de 1 cultivo por lote/campaña (Permite Doble Cultivo)
ALTER TABLE public.paddock_campaign_crops 
DROP CONSTRAINT IF EXISTS unique_paddock_per_campaign;

-- 2. Agregar precio de venta a los cultivos (Ingresos)
ALTER TABLE public.crops 
ADD COLUMN IF NOT EXISTS market_price_usd_ton NUMERIC;

-- 3. Agregar costo de labor/maquinaria a las actividades (Egresos operativos)
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS service_cost_per_ha NUMERIC;

-- 4. Reemplazar la función de siembra para permitir múltiples cultivos en el tiempo
CREATE OR REPLACE FUNCTION public.set_paddock_campaign_crop(
    p_paddock_id UUID,
    p_campaign_id UUID,
    p_crop_id UUID
)
RETURNS void AS $$
BEGIN
    -- Ahora simplemente inserta, dejando un historial cronológico
    INSERT INTO public.paddock_campaign_crops (paddock_id, campaign_id, crop_id)
    VALUES (p_paddock_id, p_campaign_id, p_crop_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Actualizar la vista de Lotes para reflejar el cultivo activo (último)
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
LEFT JOIN LATERAL (
    SELECT crop_id, yield_kg_ha 
    FROM public.paddock_campaign_crops 
    WHERE paddock_id = p.id AND campaign_id = c.id 
    ORDER BY created_at DESC 
    LIMIT 1
) pcc ON true;
