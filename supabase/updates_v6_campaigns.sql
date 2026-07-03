-- =====================================================================
-- Actualizaciones SQL V6: Soporte Integral para Campañas (Seasons)
-- =====================================================================

-- 1. Crear tabla de Campañas
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_campaign_name_per_farm UNIQUE (farm_id, name)
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- 2. Asegurar que solo haya una campaña activa a la vez por granja
CREATE UNIQUE INDEX idx_one_active_campaign_per_farm 
ON public.campaigns(farm_id) 
WHERE is_active = true;

-- 3. Crear tabla intermedia Lote-Campaña-Cultivo
CREATE TABLE public.paddock_campaign_crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paddock_id UUID NOT NULL REFERENCES public.paddocks(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL,
    yield_kg_ha NUMERIC, -- Para registrar rendimiento a fin de campaña
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_paddock_per_campaign UNIQUE (paddock_id, campaign_id)
);

ALTER TABLE public.paddock_campaign_crops ENABLE ROW LEVEL SECURITY;

-- 4. Modificar tabla Activities para asociarlas a una campaña (Opcional, para barbechos / tareas directas)
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- 5. Actualizar la vista de Lotes para mantener compatibilidad con el front actual
-- (Devuelve el crop_id de la campaña activa, si no tiene, cae al viejo crop_id de la tabla base)
CREATE OR REPLACE VIEW public.v_paddocks AS
SELECT 
    p.id,
    p.farm_id,
    p.name,
    COALESCE(pcc.crop_id, p.crop_id) AS crop_id,
    p.area,
    p.ndvi,
    st_asgeojson(p.boundary)::jsonb AS boundary,
    p.last_updated,
    p.created_at
FROM public.paddocks p
LEFT JOIN public.campaigns c ON c.farm_id = p.farm_id AND c.is_active = true
LEFT JOIN public.paddock_campaign_crops pcc ON pcc.paddock_id = p.id AND pcc.campaign_id = c.id;

-- 6. Políticas RLS básicas
CREATE POLICY "Acceso total a campañas si eres dueño del Campo" ON public.campaigns
    FOR ALL USING (
        farm_id IN (
            SELECT id FROM public.farms WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Acceso total a paddock_campaigns si eres dueño del Campo" ON public.paddock_campaign_crops
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM public.campaigns WHERE farm_id IN (
                SELECT id FROM public.farms WHERE owner_id = auth.uid()
            )
        )
    );
