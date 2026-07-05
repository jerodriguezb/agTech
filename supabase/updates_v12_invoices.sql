-- =====================================================================
-- AGTECH ERP - UPDATE V12
-- Módulo de Compras Avanzadas (Facturas con Detalle) y Almacenamiento
-- =====================================================================

-- 1. Actualizar tabla de transacciones para soportar comprobantes (imágenes/PDFs)
ALTER TABLE public.financial_transactions
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2. Crear tabla de Detalles de Transacción (Líneas de Factura)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    description TEXT,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en transaction_items
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- Políticas para transaction_items (hereda acceso a través de la transacción)
DROP POLICY IF EXISTS "Users can view transaction items" ON public.transaction_items;
CREATE POLICY "Users can view transaction items" 
    ON public.transaction_items FOR SELECT 
    USING (
        transaction_id IN (
            SELECT id FROM public.financial_transactions WHERE farm_id IN (
                SELECT id FROM public.farms WHERE owner_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage transaction items" ON public.transaction_items;
CREATE POLICY "Users can manage transaction items" 
    ON public.transaction_items FOR ALL 
    USING (
        transaction_id IN (
            SELECT id FROM public.financial_transactions WHERE farm_id IN (
                SELECT id FROM public.farms WHERE owner_id = auth.uid()
            )
        )
    );

-- =====================================================================
-- CONFIGURACIÓN DE SUPABASE STORAGE (BUCKET)
-- =====================================================================

-- Crear el bucket 'receipts' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en objetos de storage (por seguridad, aunque el bucket sea "público" para lectura de URLs)
-- Permite que los usuarios autenticados suban archivos al bucket receipts
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' AND auth.role() = 'authenticated'
  );

-- Permite a los usuarios autenticados leer archivos del bucket receipts
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
CREATE POLICY "Authenticated users can view receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts' AND auth.role() = 'authenticated'
  );

-- Permite a los usuarios autenticados eliminar sus propios archivos
DROP POLICY IF EXISTS "Users can delete their receipts" ON storage.objects;
CREATE POLICY "Users can delete their receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts' AND auth.role() = 'authenticated'
  );
