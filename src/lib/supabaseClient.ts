import { createClient } from '@supabase/supabase-js';

let rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
let rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Eliminar comillas dobles o simples que puedan venir del archivo .env
rawUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
rawKey = rawKey.replace(/^["']|["']$/g, '').trim();

// Limpiar sufijos /rest/v1 o barras finales del URL del proyecto
if (rawUrl.endsWith('/rest/v1')) {
  rawUrl = rawUrl.slice(0, -8);
} else if (rawUrl.endsWith('/rest/v1/')) {
  rawUrl = rawUrl.slice(0, -9);
} else if (rawUrl.endsWith('/')) {
  rawUrl = rawUrl.slice(0, -1);
}

export const supabaseUrl = rawUrl;
export const supabaseAnonKey = rawKey;

/**
 * Valida si el cliente de Supabase tiene credenciales reales configuradas.
 */
export const isSupabaseConfigured =
  supabaseUrl !== '' &&
  supabaseAnonKey !== '' &&
  !supabaseUrl.includes('tu-proyecto') &&
  !supabaseAnonKey.includes('tu-anon-key');

/**
 * Instancia del cliente de Supabase.
 * Será `null` si la aplicación está corriendo en modo simulación/mock.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

