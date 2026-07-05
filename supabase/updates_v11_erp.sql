-- =====================================================================
-- Actualizaciones SQL V11: Módulo Económico y Financiero (ERP) - Fase 1
-- =====================================================================

-- 1. Tabla: Catálogo de Cuentas (Chart of Accounts)
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('OPEX_DIRECT', 'OPEX_INDIRECT', 'CAPEX', 'REVENUE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(farm_id, code)
);

-- Habilitar RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their farm accounts" ON public.chart_of_accounts;
CREATE POLICY "Users can view their farm accounts" 
    ON public.chart_of_accounts FOR SELECT 
    USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their farm accounts" ON public.chart_of_accounts;
CREATE POLICY "Users can manage their farm accounts" 
    ON public.chart_of_accounts FOR ALL 
    USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 2. Tabla: Centros de Costo (Cost Centers)
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('DIRECT', 'INDIRECT')),
    paddock_id UUID REFERENCES public.paddocks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their farm cost centers" ON public.cost_centers;
CREATE POLICY "Users can view their farm cost centers" 
    ON public.cost_centers FOR SELECT 
    USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their farm cost centers" ON public.cost_centers;
CREATE POLICY "Users can manage their farm cost centers" 
    ON public.cost_centers FOR ALL 
    USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 3. Tabla: Transacciones Financieras
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT NOT NULL,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their farm transactions" ON public.financial_transactions;
CREATE POLICY "Users can view their farm transactions" 
    ON public.financial_transactions FOR SELECT 
    USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their farm transactions" ON public.financial_transactions;
CREATE POLICY "Users can manage their farm transactions" 
    ON public.financial_transactions FOR ALL 
    USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- =====================================================================
-- TRIGGERS Y FUNCIONES AUTOMÁTICAS
-- =====================================================================

-- 4. Crear Centro de Costo Directo al crear un Lote
CREATE OR REPLACE FUNCTION public.fn_auto_create_paddock_cost_center()
RETURNS TRIGGER AS $fn_trigger$
BEGIN
    INSERT INTO public.cost_centers (farm_id, name, type, paddock_id)
    VALUES (NEW.farm_id, 'Lote: ' || NEW.name, 'DIRECT', NEW.id);
    RETURN NEW;
END;
$fn_trigger$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_create_cost_center ON public.paddocks;
CREATE TRIGGER trg_auto_create_cost_center
    AFTER INSERT ON public.paddocks
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_create_paddock_cost_center();

-- 5. Sincronizar Centros de Costo Directos Históricos (Migración de Lotes ya existentes)
INSERT INTO public.cost_centers (farm_id, name, type, paddock_id)
SELECT p.farm_id, 'Lote: ' || p.name, 'DIRECT', p.id
FROM public.paddocks p
WHERE p.id NOT IN (SELECT paddock_id FROM public.cost_centers WHERE paddock_id IS NOT NULL);

-- =====================================================================
-- DATOS POR DEFECTO: Catálogo y Centros de Costo Indirectos Base
-- =====================================================================

-- Función para inicializar datos contables de un establecimiento
CREATE OR REPLACE FUNCTION public.init_farm_financial_data(p_farm_id UUID)
RETURNS void AS $fn_init$
BEGIN
    -- Crear Centros de Costo Indirectos base si no existen
    INSERT INTO public.cost_centers (farm_id, name, type)
    SELECT p_farm_id, 'Maquinaria y Taller', 'INDIRECT'
    WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE farm_id = p_farm_id AND name = 'Maquinaria y Taller');
    
    INSERT INTO public.cost_centers (farm_id, name, type)
    SELECT p_farm_id, 'Administración General', 'INDIRECT'
    WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE farm_id = p_farm_id AND name = 'Administración General');

    -- Crear Plan de Cuentas Básico
    -- OPEX_DIRECT (Costos directos que van a lote)
    INSERT INTO public.chart_of_accounts (farm_id, code, name, type) VALUES
    (p_farm_id, '1.1', 'Agroquímicos y Fertilizantes', 'OPEX_DIRECT'),
    (p_farm_id, '1.2', 'Semillas', 'OPEX_DIRECT'),
    (p_farm_id, '1.3', 'Labores de Contratistas', 'OPEX_DIRECT')
    ON CONFLICT (farm_id, code) DO NOTHING;

    -- OPEX_INDIRECT (Costos indirectos que van a taller/administración)
    INSERT INTO public.chart_of_accounts (farm_id, code, name, type) VALUES
    (p_farm_id, '2.1', 'Repuestos y Mantenimiento Maquinaria', 'OPEX_INDIRECT'),
    (p_farm_id, '2.2', 'Combustibles y Lubricantes', 'OPEX_INDIRECT'),
    (p_farm_id, '2.3', 'Honorarios y Asesoramiento', 'OPEX_INDIRECT'),
    (p_farm_id, '2.4', 'Gastos Bancarios e Impuestos', 'OPEX_INDIRECT')
    ON CONFLICT (farm_id, code) DO NOTHING;

    -- CAPEX (Bienes de Capital)
    INSERT INTO public.chart_of_accounts (farm_id, code, name, type) VALUES
    (p_farm_id, '3.1', 'Maquinaria Agrícola', 'CAPEX'),
    (p_farm_id, '3.2', 'Mejoras y Galpones', 'CAPEX'),
    (p_farm_id, '3.3', 'Rodados y Camionetas', 'CAPEX')
    ON CONFLICT (farm_id, code) DO NOTHING;

    -- REVENUE (Ingresos)
    INSERT INTO public.chart_of_accounts (farm_id, code, name, type) VALUES
    (p_farm_id, '4.1', 'Venta de Cosecha', 'REVENUE')
    ON CONFLICT (farm_id, code) DO NOTHING;
END;
$fn_init$ LANGUAGE plpgsql SECURITY DEFINER;

-- Autoejecutar para el farm activo si solo hay uno (o migrar para todos)
DO $do_block$
DECLARE
    f RECORD;
BEGIN
    FOR f IN SELECT id FROM public.farms LOOP
        PERFORM public.init_farm_financial_data(f.id);
    END LOOP;
END;
$do_block$;
