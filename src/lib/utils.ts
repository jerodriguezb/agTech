import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Combina clases CSS con resolución de conflictos Tailwind.
 * Usa clsx para condiciones y twMerge para deduplicación.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número con separador de miles y decimales opcionales.
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formatea hectáreas con sufijo "ha".
 */
export function formatHectares(value: number): string {
  return `${formatNumber(value, 1)} ha`;
}

/**
 * Formatea una cadena ISO a fecha legible en español.
 */
export function formatDate(isoString: string, pattern: string = 'dd MMM yyyy'): string {
  return format(parseISO(isoString), pattern, { locale: es });
}

/**
 * Formatea fecha y hora legible.
 */
export function formatDateTime(isoString: string): string {
  return format(parseISO(isoString), "dd MMM yyyy 'a las' HH:mm", { locale: es });
}

/**
 * Genera un ID único simplificado.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Interpola un valor NDVI a un color HEX para la rampa fisiológica.
 * < 0.2 → rojo opaco | < 0.6 → amarillo/verdoso | >= 0.6 → verde bosque
 */
export function ndviToColor(ndvi: number): string {
  if (ndvi < 0.2) return '#DC2626'; // Rojo — estrés severo
  if (ndvi < 0.4) return '#F97316'; // Naranja — estrés moderado
  if (ndvi < 0.6) return '#EAB308'; // Amarillo — vigor medio
  if (ndvi < 0.8) return '#65A30D'; // Verde lima — buen vigor
  return '#15803D'; // Verde bosque — vigor óptimo
}

/**
 * Devuelve la etiqueta textual del estado NDVI.
 */
export function ndviLabel(ndvi: number): string {
  if (ndvi < 0.2) return 'Crítico';
  if (ndvi < 0.4) return 'Bajo';
  if (ndvi < 0.6) return 'Moderado';
  if (ndvi < 0.8) return 'Bueno';
  return 'Óptimo';
}

/**
 * Formatea moneda USD.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
