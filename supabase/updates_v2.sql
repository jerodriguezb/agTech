-- ============================================================================
-- AGTECH - ACTUALIZACIÓN DE ESQUEMA V2
-- ============================================================================
-- Parametrización de Tipos de Actividad y Responsables (Personal)

-- 1. Crear Tabla: STAFF (Personal / Operarios)
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(farm_id, first_name, last_name)
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a dueños en staff" ON public.staff;
CREATE POLICY "Permitir select a dueños en staff" ON public.staff FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Permitir insert a dueños en staff" ON public.staff;
CREATE POLICY "Permitir insert a dueños en staff" ON public.staff FOR INSERT WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Permitir update a dueños en staff" ON public.staff;
CREATE POLICY "Permitir update a dueños en staff" ON public.staff FOR UPDATE USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Permitir delete a dueños en staff" ON public.staff;
CREATE POLICY "Permitir delete a dueños en staff" ON public.staff FOR DELETE USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 2. Crear Tabla: FARM_ACTIVITY_TYPES (Tipos de Actividad Personalizados)
CREATE TABLE IF NOT EXISTS public.farm_activity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#10B981', -- Emerald-500 por defecto
    icon TEXT DEFAULT 'Activity',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(farm_id, name)
);
ALTER TABLE public.farm_activity_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select a dueños en activity_types" ON public.farm_activity_types;
CREATE POLICY "Permitir select a dueños en activity_types" ON public.farm_activity_types FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Permitir insert a dueños en activity_types" ON public.farm_activity_types;
CREATE POLICY "Permitir insert a dueños en activity_types" ON public.farm_activity_types FOR INSERT WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Permitir update a dueños en activity_types" ON public.farm_activity_types;
CREATE POLICY "Permitir update a dueños en activity_types" ON public.farm_activity_types FOR UPDATE USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Permitir delete a dueños en activity_types" ON public.farm_activity_types;
CREATE POLICY "Permitir delete a dueños en activity_types" ON public.farm_activity_types FOR DELETE USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

-- 3. Modificar Tabla: ACTIVITIES
-- Eliminar la restricción del tipo de actividad rígido
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;

-- Agregar las nuevas columnas para enlazar a las nuevas tablas (se permite NULL para datos heredados inicialmente)
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS activity_type_id UUID REFERENCES public.farm_activity_types(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- 4. Sembrar (Seed) datos por defecto para establecimientos existentes
DO $$
DECLARE
    v_farm RECORD;
    v_type_siembra UUID;
    v_type_cosecha UUID;
    v_type_pulv UUID;
    v_type_fert UUID;
    v_type_riego UUID;
    v_type_lluvia UUID;
    v_staff_id UUID;
    v_responsible_name TEXT;
    v_act RECORD;
BEGIN
    FOR v_farm IN SELECT id FROM public.farms LOOP
        -- Insertar tipos por defecto si no existen
        INSERT INTO public.farm_activity_types (farm_id, name, color, icon) VALUES 
            (v_farm.id, 'Siembra', '#10B981', 'Sprout'),
            (v_farm.id, 'Cosecha', '#F59E0B', 'Tractor'),
            (v_farm.id, 'Pulverización', '#6366F1', 'Droplets'),
            (v_farm.id, 'Fertilización', '#8B5CF6', 'Beaker'),
            (v_farm.id, 'Riego', '#3B82F6', 'Waves'),
            (v_farm.id, 'Lluvia', '#0EA5E9', 'CloudRain')
        ON CONFLICT (farm_id, name) DO NOTHING;

        -- Actualizar actividades existentes para enlazar los tipos (aproximación basada en texto)
        UPDATE public.activities a
        SET activity_type_id = t.id
        FROM public.farm_activity_types t
        WHERE a.farm_id = v_farm.id 
          AND t.farm_id = v_farm.id 
          AND (a.type = t.name OR (a.type = 'Pulverizacion' AND t.name = 'Pulverización') OR (a.type = 'Fertilizacion' AND t.name = 'Fertilización'))
          AND a.activity_type_id IS NULL;

        -- Migrar responsables a tabla Staff (crear 1 operario por nombre único encontrado)
        FOR v_responsible_name IN SELECT DISTINCT responsible FROM public.activities WHERE farm_id = v_farm.id AND responsible IS NOT NULL AND responsible != '' LOOP
            INSERT INTO public.staff (farm_id, first_name, last_name, role)
            VALUES (v_farm.id, v_responsible_name, '', 'Operario')
            ON CONFLICT (farm_id, first_name, last_name) DO NOTHING
            RETURNING id INTO v_staff_id;

            IF v_staff_id IS NULL THEN
                SELECT id INTO v_staff_id FROM public.staff WHERE farm_id = v_farm.id AND first_name = v_responsible_name AND last_name = '';
            END IF;

            UPDATE public.activities SET staff_id = v_staff_id WHERE farm_id = v_farm.id AND responsible = v_responsible_name AND staff_id IS NULL;
        END LOOP;
    END LOOP;
END $$;

-- 5. Actualizar la View v_activities (Opcional pero recomendado si existiera) para incluir los nombres
-- Crearemos una vista rápida para facilitar la lectura
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
    a.created_at
FROM public.activities a
LEFT JOIN public.farm_activity_types t ON a.activity_type_id = t.id
LEFT JOIN public.staff s ON a.staff_id = s.id;
