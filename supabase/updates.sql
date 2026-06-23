-- =====================================================================
-- Actualizaciones SQL para Supabase (agroCopilot.ag)
-- Vistas GIS, RPC de Creación y Sembrado Inicial
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. VISTA: v_paddocks (Conversión automática de Geometry a GeoJSON JSONB)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_paddocks AS
SELECT 
    id,
    farm_id,
    name,
    crop_id,
    area,
    ndvi,
    st_asgeojson(boundary)::jsonb AS boundary, -- Conversión nativa PostGIS a JSONB
    last_updated,
    created_at
FROM public.paddocks;


-- ─────────────────────────────────────────────────────────────────────
-- 2. FUNCIÓN RPC: fn_create_paddock (Inserción de Lote con GeoJSON)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_create_paddock(
    p_farm_id UUID,
    p_name TEXT,
    p_crop_id UUID,
    p_boundary_geojson JSONB
)
RETURNS UUID AS $$
DECLARE
    v_paddock_id UUID;
BEGIN
    INSERT INTO public.paddocks (farm_id, name, crop_id, boundary)
    VALUES (
        p_farm_id,
        p_name,
        p_crop_id,
        ST_SetSRID(ST_GeomFromGeoJSON(p_boundary_geojson::text), 4326)
    )
    RETURNING id INTO v_paddock_id;
    
    RETURN v_paddock_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────
-- 3. FUNCIÓN RPC: fn_seed_database_if_empty (Sembrado Inicial)
-- Permite al frontend verificar si la cuenta no tiene datos e inicializarla.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_seed_database_if_empty(
    p_user_id UUID,
    p_farm_name TEXT,
    p_farm_area NUMERIC,
    p_crops JSONB,      -- Array de cultivos
    p_paddocks JSONB,   -- Array de lotes con su respectivo boundary GeoJSON
    p_inventory JSONB   -- Array de insumos iniciales
)
RETURNS BOOLEAN AS $$
DECLARE
    v_farm_id UUID;
    v_crop_id UUID;
    v_crop_item JSONB;
    v_pad_item JSONB;
    v_inv_item JSONB;
    v_crop_map JSONB := '{}'::jsonb;
BEGIN
    -- 1. Verificar si el usuario ya tiene un establecimiento
    SELECT id INTO v_farm_id FROM public.farms WHERE owner_id = p_user_id LIMIT 1;
    
    IF v_farm_id IS NOT NULL THEN
        RETURN FALSE; -- Ya existen datos, no se requiere seed
    END IF;

    -- 2. Crear establecimiento base
    INSERT INTO public.farms (name, owner_id, total_area)
    VALUES (p_farm_name, p_user_id, p_farm_area)
    RETURNING id INTO v_farm_id;

    -- 3. Sembrar cultivos y guardar mapeo de IDs temporales a reales
    FOR v_crop_item IN SELECT * FROM jsonb_array_elements(p_crops) LOOP
        -- Asegurar que el cultivo no exista
        SELECT id INTO v_crop_id FROM public.crops WHERE name = (v_crop_item->>'name') LIMIT 1;
        
        IF v_crop_id IS NULL THEN
            INSERT INTO public.crops (name, type, color, target_ndvi)
            VALUES (
                v_crop_item->>'name',
                COALESCE(v_crop_item->>'type', v_crop_item->>'variety', 'Genérico'),
                v_crop_item->>'color',
                COALESCE((v_crop_item->>'target_ndvi')::numeric, 0.5)
            )
            RETURNING id INTO v_crop_id;
        END IF;
        
        v_crop_map := jsonb_set(v_crop_map, ARRAY[v_crop_item->>'id'], to_jsonb(v_crop_id));
    END LOOP;

    -- 4. Sembrar inventario
    FOR v_inv_item IN SELECT * FROM jsonb_array_elements(p_inventory) LOOP
        INSERT INTO public.inventory_items (farm_id, name, category, current_stock, minimum_stock, unit, unit_cost)
        VALUES (
            v_farm_id,
            v_inv_item->>'name',
            v_inv_item->>'category',
            (v_inv_item->>'currentStock')::numeric,
            (v_inv_item->>'minimumStock')::numeric,
            v_inv_item->>'unit',
            (v_inv_item->>'unitCost')::numeric
        );
    END LOOP;

    -- 5. Sembrar lotes (Paddocks)
    FOR v_pad_item IN SELECT * FROM jsonb_array_elements(p_paddocks) LOOP
        -- Obtener ID real del cultivo mapeado
        v_crop_id := (v_crop_map->>(v_pad_item->>'cropId'))::uuid;
        
        -- Inserción usando la conversión nativa de GeoJSON
        INSERT INTO public.paddocks (farm_id, name, crop_id, ndvi, boundary)
        VALUES (
            v_farm_id,
            v_pad_item->>'name',
            v_crop_id,
            (v_pad_item->>'ndvi')::numeric,
            ST_SetSRID(ST_GeomFromGeoJSON((v_pad_item->'coordinates')::text), 4326)
        );
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
