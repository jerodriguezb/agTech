-- =====================================================================
-- AGTECH ERP - UPDATE V13
-- Módulo de Ventas e Ingresos (Sales & Income)
-- =====================================================================

-- 1. Agregar referencia al cultivo en los items de transacción
-- Esto permite vincular una venta directamente a las toneladas de un cultivo específico.
ALTER TABLE public.transaction_items
ADD COLUMN IF NOT EXISTS crop_id UUID REFERENCES public.crops(id) ON DELETE SET NULL;
