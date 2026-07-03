-- =====================================================================
-- Actualizaciones SQL V5: Modificación para Hectáreas Manuales / Declaradas
-- =====================================================================

-- 1. Modificar la función de autocalcular área para respetar el valor manual si se provee
CREATE OR REPLACE FUNCTION public.fn_calculate_paddock_area_hectares()
RETURNS TRIGGER AS $$
BEGIN
    -- Si NEW.area es NULL o es 0, calculamos el área geográficamente con PostGIS
    IF NEW.area IS NULL OR NEW.area = 0 THEN
        NEW.area := ROUND((ST_Area(NEW.boundary::geography) / 10000.0)::numeric, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Eliminar la función RPC anterior para evitar sobrecargas de Postgres
DROP FUNCTION IF EXISTS public.fn_create_paddock(UUID, TEXT, UUID, JSONB);

-- 3. Crear la nueva función RPC fn_create_paddock que acepta p_area
CREATE OR REPLACE FUNCTION public.fn_create_paddock(
    p_farm_id UUID,
    p_name TEXT,
    p_crop_id UUID,
    p_boundary_geojson JSONB,
    p_area NUMERIC DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_paddock_id UUID;
BEGIN
    INSERT INTO public.paddocks (farm_id, name, crop_id, boundary, area)
    VALUES (
        p_farm_id,
        p_name,
        p_crop_id,
        ST_SetSRID(ST_GeomFromGeoJSON(p_boundary_geojson::text), 4326),
        p_area
    )
    RETURNING id INTO v_paddock_id;
    
    RETURN v_paddock_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
