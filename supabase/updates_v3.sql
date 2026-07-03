-- ============================================================================
-- AGTECH - ACTUALIZACIÓN DE ESQUEMA V3
-- ============================================================================
-- 1. Soporte para labores parciales
-- Agregar la columna 'applied_area' a la tabla activities para permitir registrar
-- una superficie trabajada menor a la superficie total del lote (total_area).

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS applied_area NUMERIC;

-- ============================================================================
-- 2. Modificación de la Vista de Actividades para incluir el nuevo campo
-- ============================================================================
DROP VIEW IF EXISTS public.v_activities CASCADE;

CREATE OR REPLACE VIEW public.v_activities AS
SELECT 
    a.id,
    a.farm_id,
    a.paddock_id,
    a.activity_type_id,
    COALESCE(t.name, a.type) as type_name,
    t.color as type_color,
    t.icon as type_icon,
    a.date,
    a.staff_id,
    COALESCE(s.first_name || ' ' || s.last_name, a.responsible) as responsible_name,
    a.notes,
    a.rainfall_mm,
    a.applied_area,
    a.created_at
FROM public.activities a
LEFT JOIN public.farm_activity_types t ON a.activity_type_id = t.id
LEFT JOIN public.staff s ON a.staff_id = s.id;
