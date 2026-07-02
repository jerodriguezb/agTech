-- ============================================================================
-- AGTECH - ACTUALIZACIÓN DE ESQUEMA V4: CONFIGURACIÓN DE IA Y PERFILES
-- ============================================================================

-- 1. Crear Tabla: FARM_AI_SETTINGS (Ajustes de IA por Establecimiento)
CREATE TABLE IF NOT EXISTS public.farm_ai_settings (
    farm_id UUID PRIMARY KEY REFERENCES public.farms(id) ON DELETE CASCADE,
    custom_system_prompt TEXT,
    custom_aliases JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.farm_ai_settings ENABLE ROW LEVEL SECURITY;

-- 2. Crear Tabla: FARM_USERS (Mapeo de Usuarios a Establecimientos con Roles)
CREATE TABLE IF NOT EXISTS public.farm_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'manager', 'accountant', 'agronomist', 'operator')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (farm_id, email)
);

-- Habilitar RLS
ALTER TABLE public.farm_users ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS) para farm_ai_settings
DROP POLICY IF EXISTS "Lectura de ajustes de IA por miembros" ON public.farm_ai_settings;
CREATE POLICY "Lectura de ajustes de IA por miembros" ON public.farm_ai_settings
    FOR SELECT USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR
        farm_id IN (SELECT farm_id FROM public.farm_users WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Edición de ajustes de IA por dueños o administradores" ON public.farm_ai_settings;
CREATE POLICY "Edición de ajustes de IA por dueños o administradores" ON public.farm_ai_settings
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR
        farm_id IN (SELECT farm_id FROM public.farm_users WHERE user_id = auth.uid() AND role = 'owner')
    );

-- 4. Políticas de Seguridad (RLS) para farm_users
DROP POLICY IF EXISTS "Lectura de miembros de campo" ON public.farm_users;
CREATE POLICY "Lectura de miembros de campo" ON public.farm_users
    FOR SELECT USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR
        farm_id IN (SELECT farm_id FROM public.farm_users WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Edición de miembros exclusiva del dueño" ON public.farm_users;
CREATE POLICY "Edición de miembros exclusiva del dueño" ON public.farm_users
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );

-- 5. Trigger para crear fila de ajustes de IA automáticamente al crear un Farm
CREATE OR REPLACE FUNCTION public.fn_create_farm_ai_settings_on_farm_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.farm_ai_settings (farm_id)
    VALUES (NEW.id)
    ON CONFLICT (farm_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_create_farm_ai_settings ON public.farms;
CREATE TRIGGER tr_create_farm_ai_settings
AFTER INSERT ON public.farms
FOR EACH ROW EXECUTE FUNCTION public.fn_create_farm_ai_settings_on_farm_insert();

-- 6. Sembrar (Seed) ajustes de IA para establecimientos existentes
DO $$
DECLARE
    v_farm RECORD;
BEGIN
    FOR v_farm IN SELECT id FROM public.farms LOOP
        INSERT INTO public.farm_ai_settings (farm_id)
        VALUES (v_farm.id)
        ON CONFLICT (farm_id) DO NOTHING;
    END LOOP;
END $$;

-- 7. Trigger para enlazar automáticamente user_id en farm_users al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.fn_link_farm_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.farm_users
    SET user_id = NEW.id
    WHERE LOWER(email) = LOWER(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sobre auth.users (ejecutar en Supabase para habilitar enlace automático en login)
-- DROP TRIGGER IF EXISTS tr_link_farm_user ON auth.users;
-- CREATE TRIGGER tr_link_farm_user
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION public.fn_link_farm_user_on_signup();

