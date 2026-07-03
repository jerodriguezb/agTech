-- =====================================================================
-- Actualizaciones SQL V7: Tablas de Configuración (IA y Usuarios)
-- =====================================================================

-- 1. Tabla de Usuarios del Campo (Permisos y Roles)
CREATE TABLE IF NOT EXISTS public.farm_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'accountant', 'agronomist', 'operator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_email_per_farm UNIQUE (farm_id, email)
);

ALTER TABLE public.farm_users ENABLE ROW LEVEL SECURITY;

-- 2. Tabla de Configuraciones de IA (Prompt y Alias personalizados por campo)
CREATE TABLE IF NOT EXISTS public.farm_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE UNIQUE,
    custom_system_prompt TEXT,
    custom_aliases JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.farm_ai_settings ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS de Seguridad Básica (Dueño del campo accede a todo)
CREATE POLICY "Acceso a farm_users para el dueño" ON public.farm_users
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );

CREATE POLICY "Acceso a farm_ai_settings para el dueño" ON public.farm_ai_settings
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
    );
