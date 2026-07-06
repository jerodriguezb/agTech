-- =====================================================================
-- AGTECH ERP - UPDATE V14
-- Módulo de Comercialización, Acopio y Pagos
-- =====================================================================

-- 1. Almacenes (Storage Locations)
CREATE TABLE IF NOT EXISTS public.storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'SILO', 'BAG', 'EXTERNAL'
    capacity_tons NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en storage_locations
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their farm storage locations" ON public.storage_locations;
CREATE POLICY "Users can view their farm storage locations" ON public.storage_locations FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their farm storage locations" ON public.storage_locations;
CREATE POLICY "Users can manage their farm storage locations" ON public.storage_locations FOR ALL USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 2. Existencias de Granos (Grain Stocks)
CREATE TABLE IF NOT EXISTS public.grain_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    storage_location_id UUID NOT NULL REFERENCES public.storage_locations(id) ON DELETE CASCADE,
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    current_tons NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(storage_location_id, crop_id)
);

-- Habilitar RLS en grain_stocks
ALTER TABLE public.grain_stocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their farm grain stocks" ON public.grain_stocks;
CREATE POLICY "Users can view their farm grain stocks" ON public.grain_stocks FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their farm grain stocks" ON public.grain_stocks;
CREATE POLICY "Users can manage their farm grain stocks" ON public.grain_stocks FOR ALL USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 3. Órdenes de Venta (Sales Orders)
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    storage_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
    tons_sold NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    tax_percentage NUMERIC DEFAULT 0,
    freight_deduction NUMERIC DEFAULT 0,
    net_total NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en sales_orders
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their farm sales orders" ON public.sales_orders;
CREATE POLICY "Users can view their farm sales orders" ON public.sales_orders FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their farm sales orders" ON public.sales_orders;
CREATE POLICY "Users can manage their farm sales orders" ON public.sales_orders FOR ALL USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 4. Pagos / Cheques (Sales Payments)
CREATE TABLE IF NOT EXISTS public.sales_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL, -- 'ECHEQ', 'PHYSICAL_CHEQUE', 'TRANSFER'
    amount NUMERIC NOT NULL,
    reference_number TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    perceptions_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en sales_payments
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their sales payments" ON public.sales_payments;
CREATE POLICY "Users can view their sales payments" ON public.sales_payments FOR SELECT USING (
    sales_order_id IN (SELECT id FROM public.sales_orders WHERE farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Users can manage their sales payments" ON public.sales_payments;
CREATE POLICY "Users can manage their sales payments" ON public.sales_payments FOR ALL USING (
    sales_order_id IN (SELECT id FROM public.sales_orders WHERE farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
);
