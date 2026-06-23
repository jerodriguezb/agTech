-- =====================================================================
-- Schema Inicial de Base de Datos para agroCopilot.ag (Supabase / PostGIS)
-- Arquitectura Multitenant con Seguridad RLS y Gestión Espacial Avanzada
-- =====================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- Soporte para datos geográficos/espaciales

-- ─────────────────────────────────────────────────────────────────────
-- 1. TABLA: FARMS (Campos / Establecimientos)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_area NUMERIC NOT NULL CHECK (total_area > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 2. TABLA: CROPS (Cultivos)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- e.g., 'Grano', 'Forraje', 'Hortícola'
    color TEXT NOT NULL, -- Código color CSS/Hex para representación en GIS
    target_ndvi NUMERIC NOT NULL CHECK (target_ndvi >= -1.0 AND target_ndvi <= 1.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 3. TABLA: PADDOCKS (Lotes)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.paddocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL,
    area NUMERIC NOT NULL CHECK (area > 0), -- Área calculada en hectáreas
    ndvi NUMERIC CHECK (ndvi >= -1.0 AND ndvi <= 1.0), -- Índice NDVI actual
    boundary GEOMETRY(Polygon, 4326) NOT NULL, -- Polígono espacial con coordenadas WGS84
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_paddock_name_per_farm UNIQUE (farm_id, name)
);

-- Habilitar RLS e índice espacial GIST para consultas rápidas geográficas
ALTER TABLE public.paddocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX paddocks_boundary_gist_idx ON public.paddocks USING GIST (boundary);

-- ─────────────────────────────────────────────────────────────────────
-- 4. TABLA: INVENTORY_ITEMS (Inventario de Insumos)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Agricola', 'Ganadero', 'Estructura', 'Semilla', 'Fertilizante', 'Agroquimico', 'Combustible', 'Otro')),
    current_stock NUMERIC NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    minimum_stock NUMERIC NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
    unit TEXT NOT NULL, -- e.g., 'kg', 'L', 'bags'
    unit_cost NUMERIC NOT NULL CHECK (unit_cost >= 0),
    last_restocked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_inventory_item_name_per_farm UNIQUE (farm_id, name)
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 5. TABLA: ACTIVITIES (Tareas de Campo)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    paddock_id UUID REFERENCES public.paddocks(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('Siembra', 'Cosecha', 'Pulverizacion', 'Fertilizacion', 'Riego', 'Lluvia')),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    responsible TEXT NOT NULL,
    notes TEXT,
    rainfall_mm NUMERIC CHECK (rainfall_mm >= 0), -- Atributo exclusivo para eventos climáticos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 6. TABLA: ACTIVITY_INPUTS (Insumos Consumidos - Relación N a N)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.activity_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.activity_inputs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 7. TABLA: CHAT_MESSAGES (Historial del Copiloto por Establecimiento)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    is_processing BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- TRIGGER Y LÓGICA AUTOMÁTICA DE DOBLE ENTRADA (STOCK DE INVENTARIO)
-- =====================================================================

-- Función para actualizar automáticamente el stock tras registrar consumos
CREATE OR REPLACE FUNCTION public.fn_adjust_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Descontar el stock consumido
        UPDATE public.inventory_items
        SET current_stock = GREATEST(0, current_stock - NEW.quantity),
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.inventory_item_id;
        
    ELSIF (TG_OP = 'DELETE') THEN
        -- Revertir el descuento si se elimina el registro de consumo
        UPDATE public.inventory_items
        SET current_stock = current_stock + OLD.quantity,
            updated_at = timezone('utc'::text, now())
        WHERE id = OLD.inventory_item_id;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Ajustar el stock según la diferencia de cantidad consumida
        UPDATE public.inventory_items
        SET current_stock = GREATEST(0, current_stock + (OLD.quantity - NEW.quantity)),
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.inventory_item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- triggers para auditar consumos de insumos
CREATE TRIGGER tr_adjust_inventory_stock_insert
AFTER INSERT ON public.activity_inputs
FOR EACH ROW EXECUTE FUNCTION public.fn_adjust_inventory_stock();

CREATE TRIGGER tr_adjust_inventory_stock_delete
AFTER DELETE ON public.activity_inputs
FOR EACH ROW EXECUTE FUNCTION public.fn_adjust_inventory_stock();

CREATE TRIGGER tr_adjust_inventory_stock_update
AFTER UPDATE OF quantity, inventory_item_id ON public.activity_inputs
FOR EACH ROW EXECUTE FUNCTION public.fn_adjust_inventory_stock();


-- =====================================================================
-- POLÍTICAS DE SEGURIDAD RLS (ROW LEVEL SECURITY)
-- =====================================================================

-- Políticas para FARMS
CREATE POLICY "Permitir select a dueños de establecimientos" ON public.farms
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Permitir insert a usuarios autenticados" ON public.farms
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Permitir update a dueños de establecimientos" ON public.farms
    FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Permitir delete a dueños de establecimientos" ON public.farms
    FOR DELETE USING (owner_id = auth.uid());

-- Políticas para CROPS (Lectura pública / Escritura restringida)
CREATE POLICY "Permitir lectura global de cultivos" ON public.crops
    FOR SELECT TO authenticated USING (true);

-- Políticas para PADDOCKS (Dependientes del dueño del Farm)
CREATE POLICY "Acceso total a Lotes si eres dueño del Campo" ON public.paddocks
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );

-- Políticas para INVENTORY_ITEMS (Dependientes del dueño del Farm)
CREATE POLICY "Acceso total a Inventario si eres dueño del Campo" ON public.inventory_items
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );

-- Políticas para ACTIVITIES (Dependientes del dueño del Farm)
CREATE POLICY "Acceso total a Actividades si eres dueño del Campo" ON public.activities
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );

-- Políticas para ACTIVITY_INPUTS (Dependientes de la actividad asociada al Farm del dueño)
CREATE POLICY "Acceso total a Insumos Consumidos si eres dueño del Campo" ON public.activity_inputs
    FOR ALL USING (
        activity_id IN (
            SELECT a.id FROM public.activities a
            JOIN public.farms f ON a.farm_id = f.id
            WHERE f.owner_id = auth.uid()
        )
    );

-- Políticas para CHAT_MESSAGES
CREATE POLICY "Acceso a historial de chat propio" ON public.chat_messages
    FOR ALL USING (
        user_id = auth.uid() AND
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );


-- =====================================================================
-- VISTAS Y FUNCIONES AUXILIARES GEOESPACIALES (GIS)
-- =====================================================================

-- 1. Función para buscar el lote que contiene un punto geográfico (latitud/longitud)
-- Útil para geolocalizar al operario o validar ubicaciones en el Copiloto
CREATE OR REPLACE FUNCTION public.fn_get_paddock_at_coords(lat NUMERIC, lng NUMERIC)
RETURNS TABLE (paddock_id UUID, paddock_name TEXT, farm_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, f.name
    FROM public.paddocks p
    JOIN public.farms f ON p.farm_id = f.id
    WHERE ST_Contains(p.boundary, ST_SetSRID(ST_Point(lng, lat), 4326))
      AND f.owner_id = auth.uid()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para calcular automáticamente hectáreas del polígono en formato métrico
CREATE OR REPLACE FUNCTION public.fn_calculate_paddock_area_hectares()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcula el área usando proyección geográfica (ST_Area) y convierte a hectáreas (1 ha = 10,000 m²)
    NEW.area := ROUND((ST_Area(NEW.boundary::geography) / 10000.0)::numeric, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_auto_calculate_paddock_area
BEFORE INSERT OR UPDATE OF boundary ON public.paddocks
FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_paddock_area_hectares();
