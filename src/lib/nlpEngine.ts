import { Paddock, InventoryItem, PendingActivity } from '../types';
import { subDays } from 'date-fns';
import { useAgriStore } from '../store/useAgriStore';

/**
 * Diccionario de alias local (Jerga)
 */
const paddockAliases: Record<string, string> = {
  'el bajo': 'Lote Sur',
  'el fondo': 'Lote Norte',
  'la loma': 'Lote Este',
  'el alto': 'Lote Oeste',
};

const inputAliases: Record<string, string> = {
  'glifo': 'Glifosato',
  'urea': 'Urea',
  '24d': '2,4-D',
};

/**
 * Normalizar texto y reemplazar jerga
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase().trim();
  
  // Reemplazar jerga de lotes
  Object.keys(paddockAliases).forEach(alias => {
    if (normalized.includes(alias)) {
      const resolvedPaddock = paddockAliases[alias];
      if (resolvedPaddock) {
        normalized = normalized.replace(alias, resolvedPaddock.toLowerCase());
      }
    }
  });

  // Reemplazar jerga de insumos
  Object.keys(inputAliases).forEach(alias => {
    if (normalized.includes(alias)) {
      const resolvedInput = inputAliases[alias];
      if (resolvedInput) {
        normalized = normalized.replace(alias, resolvedInput.toLowerCase());
      }
    }
  });

  return normalized;
}

/**
 * Extraer fecha del texto ("ayer", "hace 2 dias")
 */
function extractDate(text: string): string {
  const now = new Date();
  if (text.includes('ayer')) {
    return subDays(now, 1).toISOString();
  }
  
  const daysMatch = text.match(/hace (\d+)\s*dias?/i);
  if (daysMatch && daysMatch[1]) {
    const days = parseInt(daysMatch[1], 10);
    return subDays(now, days).toISOString();
  }

  return now.toISOString(); // Por defecto ahora
}

/**
 * Busca un lote en el listado de lotes tolerando errores ortográficos simples (Levenshtein)
 * y permitiendo coincidencias por substrings.
 */
function findPaddock(text: string, paddocks: Paddock[]): Paddock | Paddock[] | null {
  const normalizedInput = text.toLowerCase().trim();
  if (!normalizedInput) return null;

  // 1. Coincidencia exacta por nombre completo
  const exactMatch = paddocks.find(p => normalizedInput.includes(p.name.toLowerCase()));
  if (exactMatch) return exactMatch;

  // Helper para remover palabras comunes que interfieren
  const cleanName = (name: string) => {
    return name.toLowerCase().replace(/\blote\b|\bpotrero\b/gi, '').trim();
  };

  // 2. Coincidencia por substring limpio (ej: "tala pozo" con "Lote Tala Pozo")
  const cleanedMatches = paddocks.filter(p => {
    const cleaned = cleanName(p.name);
    if (cleaned.length <= 2) return false;
    return normalizedInput.includes(cleaned) || cleaned.includes(normalizedInput);
  });

  if (cleanedMatches.length === 1 && cleanedMatches[0]) {
    return cleanedMatches[0];
  }
  if (cleanedMatches.length > 1) {
    return cleanedMatches;
  }

  // 3. Similitud aproximada (Levenshtein) para tolerar errores ortográficos (ej. "tala pozp")
  const getLevenshteinDistance = (s1: string, s2: string): number => {
    const len1 = s1.length;
    const len2 = s2.length;
    
    const matrix: number[][] = Array.from({ length: len1 + 1 }, () => 
      Array(len2 + 1).fill(0)
    );

    for (let i = 0; i <= len1; i++) {
      const row = matrix[i];
      if (row) row[0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      const firstRow = matrix[0];
      if (firstRow) firstRow[j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        const row = matrix[i];
        const prevRow = matrix[i - 1];
        if (row && prevRow) {
          const val1 = (prevRow[j] ?? 0) + 1;
          const val2 = (row[j - 1] ?? 0) + 1;
          const val3 = (prevRow[j - 1] ?? 0) + cost;
          row[j] = Math.min(val1, val2, val3);
        }
      }
    }
    
    const finalRow = matrix[len1];
    return finalRow ? (finalRow[len2] ?? 0) : 0;
  };

  const fuzzyMatches: { paddock: Paddock; distance: number }[] = [];
  for (const p of paddocks) {
    const cleaned = cleanName(p.name);
    const overallDist = getLevenshteinDistance(normalizedInput, cleaned);
    
    // Comparar palabra por palabra
    const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 3);
    const paddockWords = cleaned.split(/\s+/).filter(w => w.length > 3);
    
    let minWordDist = 999;
    for (const iw of inputWords) {
      for (const pw of paddockWords) {
        const d = getLevenshteinDistance(iw, pw);
        if (d < minWordDist) minWordDist = d;
      }
    }

    if (overallDist <= 2 || minWordDist <= 1) {
      const score = Math.min(overallDist, minWordDist);
      fuzzyMatches.push({ paddock: p, distance: score });
    }
  }

  // Ordenar de menor a mayor distancia
  fuzzyMatches.sort((a, b) => a.distance - b.distance);
  if (fuzzyMatches.length > 0 && fuzzyMatches[0]) {
    if (fuzzyMatches.length === 1 || (fuzzyMatches[1] && fuzzyMatches[1].distance > fuzzyMatches[0].distance + 1)) {
      return fuzzyMatches[0].paddock;
    }
    return fuzzyMatches.map(m => m.paddock);
  }

  return null;
}

/**
 * Busca múltiples insumos en el texto
 */
function findInventoryItems(text: string, inventory: InventoryItem[]): InventoryItem[] {
  const normalizedText = text.toLowerCase();
  const matched: InventoryItem[] = [];
  
  const storeAliases = useAgriStore.getState().customAliases;
  const aliasMap = storeAliases && Object.keys(storeAliases).length > 0 ? storeAliases : {
    'gasoil': 'Gasoil Grado 3',
    'gas-oil': 'Gasoil Grado 3',
    'combustible': 'Gasoil Grado 3',
    'diesel': 'Gasoil Grado 3',
    'glifosato': 'Glifosato 66.2%',
    'glifo': 'Glifosato 66.2%',
    '2,4-d': '2,4-D Éster 100%',
    '2.4-d': '2,4-D Éster 100%',
    '24d': '2,4-D Éster 100%',
    'urea': 'Urea Granulada 46-0-0',
    'uan': 'Fertilizante UAN 32%',
    'semilla de soja': 'Semilla Soja DM40R16',
    'semilla soja': 'Semilla Soja DM40R16',
    'semilla de maiz': 'Semilla Híbrida Maíz DK72',
    'semilla de maíz': 'Semilla Híbrida Maíz DK72',
    'semilla maiz': 'Semilla Híbrida Maíz DK72',
    'semilla maíz': 'Semilla Híbrida Maíz DK72',
  };

  for (const [alias, targetName] of Object.entries(aliasMap)) {
    const regex = new RegExp(`\\b${alias.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
    if (regex.test(normalizedText)) {
      const found = inventory.find(item => item.name.toLowerCase() === targetName.toLowerCase());
      if (found && !matched.some(m => m.id === found.id)) {
        matched.push(found);
      }
    }
  }

  for (const item of inventory) {
    if (matched.some(m => m.id === item.id)) continue;
    
    const itemNameLower = item.name.toLowerCase();
    const cleanItemName = itemNameLower.replace(/[0-9%.,-]/g, '').trim();
    const words = cleanItemName.split(/\s+/).filter(w => w.length > 3);
    
    let wordMatched = false;
    for (const word of words) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(normalizedText)) {
        wordMatched = true;
        break;
      }
    }
    
    if (wordMatched || normalizedText.includes(itemNameLower)) {
      matched.push(item);
    }
  }

  return matched;
}

/**
 * Extraer cantidades asociadas a múltiples insumos
 */
function extractQuantitiesForInputs(text: string, items: InventoryItem[], paddockName?: string): Record<string, number> {
  const result: Record<string, number> = {};
  let cleaned = text.toLowerCase();
  
  if (paddockName) {
    cleaned = cleaned.replace(paddockName.toLowerCase(), '');
  }
  
  cleaned = cleaned.replace(/hace \d+\s*días?/gi, '');
  cleaned = cleaned.replace(/hace \d+\s*dias?/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*mm\b/gi, '');
  cleaned = cleaned.replace(/ndvi\s*\d+(\.\d+)?/gi, '');

  for (const item of items) {
    let unitPattern = '';
    if (item.unit.startsWith('litro')) {
      unitPattern = '(?:litros|litro|lts|lt|l)';
    } else if (item.unit.startsWith('kg') || item.unit.startsWith('kilo')) {
      unitPattern = '(?:kg|kgs|kilos|kilo|g)';
    } else if (item.unit.startsWith('bolsa')) {
      unitPattern = '(?:bolsas|bolsa|b)';
    }
    
    const regex = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unitPattern}\\b`, 'i');
    const match = cleaned.match(regex);
    if (match && match[1]) {
      result[item.id] = parseFloat(match[1].replace(',', '.'));
      cleaned = cleaned.replace(match[0], '');
    }
  }

  // Fallback: si hay un solo ítem y un solo número restante
  if (items.length === 1 && items[0]) {
    const numbers = cleaned.match(/\b\d+(?:[.,]\d+)?\b/g);
    if (numbers && numbers.length === 1 && numbers[0]) {
      const val = parseFloat(numbers[0].replace(',', '.'));
      if (!(val >= 1900 && val <= 2100)) {
        result[items[0].id] = val;
      }
    }
  }

  return result;
}

/**
 * Extraer una sola cantidad genérica
 */
function extractQuantity(text: string, paddockName?: string): number | null {
  let cleaned = text.toLowerCase();
  
  if (paddockName) {
    cleaned = cleaned.replace(paddockName.toLowerCase(), '');
  }
  
  cleaned = cleaned.replace(/hace \d+\s*días?/gi, '');
  cleaned = cleaned.replace(/hace \d+\s*dias?/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*mm\b/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*milimetros\b/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*milímetros\b/gi, '');
  cleaned = cleaned.replace(/ndvi\s*\d+(\.\d+)?/gi, '');

  const unitRegex = /\b(\d+(?:[.,]\d+)?)\s*(litros|litro|lts|lt|l|kg|kgs|kilos|kilo|bolsas|bolsa|b)\b/i;
  const unitMatch = cleaned.match(unitRegex);
  if (unitMatch && unitMatch[1]) {
    return parseFloat(unitMatch[1].replace(',', '.'));
  }

  const numbers = cleaned.match(/\b\d+(?:[.,]\d+)?\b/g);
  if (numbers) {
    for (const numStr of numbers) {
      const val = parseFloat(numStr.replace(',', '.'));
      if (val >= 1900 && val <= 2100) continue;
      return val;
    }
  }

  return null;
}

/**
 * Valida si hay stock suficiente para todos los insumos consumidos
 */
function validateStock(inputs: { inventoryItemId: string; quantity: number }[], inventory: InventoryItem[]): string {
  let warnings = '';
  for (const input of inputs) {
    const item = inventory.find(i => i.id === input.inventoryItemId);
    if (item) {
      if (item.currentStock < input.quantity) {
        warnings += `\n⚠️ **Advertencia:** El stock de **${item.name}** es insuficiente (Stock actual: **${item.currentStock} ${item.unit}**, solicitado: **${input.quantity} ${item.unit}**).`;
      }
    }
  }
  return warnings;
}

/**
 * Procesar texto de lenguaje natural
 */
export function processNaturalLanguage(
  input: string, 
  paddocks: Paddock[], 
  inventory: InventoryItem[],
  partialAction: PendingActivity | null
): {
  success: boolean;
  message: string;
  pendingAction?: PendingActivity;
  nextPartialAction?: PendingActivity | null;
} {
  const normalized = normalizeText(input);
  const actionDate = extractDate(normalized);

  // 0. Cancelación
  if (/cancelar|cancel/i.test(normalized)) {
    return {
      success: true,
      message: 'Operación cancelada. ¿En qué más puedo ayudarte?',
      nextPartialAction: null
    };
  }

  // ─── LÓGICA DE SEGUIMIENTO CONVERSACIONAL ──────────────────────────────────
  if (partialAction) {
    const updatedAction = { ...partialAction };

    // --- Caso 1: Buscando Tipo de Actividad ---
    if (partialAction.type === 'PENDING_TYPE') {
      let resolvedType = '';
      if (/siembr|sembr/i.test(normalized)) resolvedType = 'Siembra';
      else if (/pulveriz|aplic|fumig|pulverización/i.test(normalized)) resolvedType = 'Pulverizacion';
      else if (/fertiliz|abono|fertilización/i.test(normalized)) resolvedType = 'Fertilizacion';
      else if (/riego|regar/i.test(normalized)) resolvedType = 'Riego';
      else if (/cosech|recol/i.test(normalized)) resolvedType = 'Cosecha';
      else if (/llov|lluvia|precipitacion/i.test(normalized)) resolvedType = 'Lluvia';

      if (resolvedType) {
        updatedAction.type = resolvedType;
      } else {
        return {
          success: false,
          message: 'No pude identificar la actividad. ¿Deseas registrar Siembra, Pulverización, Fertilización, Cosecha, Riego o Lluvia?',
          nextPartialAction: updatedAction
        };
      }
    }

    // --- Caso 2: Buscando Lote (Paddock) ---
    if (updatedAction.paddockId === undefined) {
      const padRes = findPaddock(normalized, paddocks);
      
      if (padRes && !Array.isArray(padRes)) {
        updatedAction.paddockId = padRes.id;
        updatedAction.paddockOptions = undefined;
      } else if (Array.isArray(padRes)) {
        updatedAction.paddockOptions = padRes.map(p => p.name);
        const optionsList = padRes.map(p => `**${p.name}**`).join(', ');
        return {
          success: false,
          message: `Encontré varios lotes con ese nombre: ${optionsList}. ¿A cuál te refieres?`,
          nextPartialAction: updatedAction
        };
      } else {
        if (updatedAction.paddockOptions && updatedAction.paddockOptions.length > 0) {
          const matchedOpt = paddocks.find(p => 
            updatedAction.paddockOptions?.some(opt => opt.toLowerCase() === p.name.toLowerCase()) &&
            normalized.includes(p.name.toLowerCase())
          );
          if (matchedOpt) {
            updatedAction.paddockId = matchedOpt.id;
            updatedAction.paddockOptions = undefined;
          } else {
            const optionsList = updatedAction.paddockOptions.map(o => `**${o}**`).join(', ');
            return {
              success: false,
              message: `Por favor, elige una de las opciones: ${optionsList} (o escribe "cancelar").`,
              nextPartialAction: updatedAction
            };
          }
        } else {
          return {
            success: false,
            message: `¿En qué lote realizaste la labor? Por favor, dime el lote.`,
            nextPartialAction: updatedAction
          };
        }
      }
    }

    // --- Caso 3: Lluvia (flujo particular para milímetros) ---
    if (updatedAction.type === 'Lluvia') {
      if (updatedAction.rainfallMm === undefined) {
        const mmMatch = normalized.match(/(\d+)/);
        if (mmMatch && mmMatch[1]) {
          updatedAction.rainfallMm = parseInt(mmMatch[1], 10);
        } else {
          return {
            success: false,
            message: '¿Cuántos milímetros (mm) llovieron?',
            nextPartialAction: updatedAction
          };
        }
      }

      const padName = paddocks.find(p => p.id === updatedAction.paddockId)?.name || 'todo el campo';
      return {
        success: true,
        message: `Entendí que se registraron **${updatedAction.rainfallMm} mm** de lluvia en **${padName}**. ¿Confirma el registro?`,
        pendingAction: updatedAction,
        nextPartialAction: null
      };
    }

    // --- Caso 4: Insumos (Siembra, Pulverización, Fertilización, Riego, Cosecha) ---
    if (!updatedAction.inputsAsked) {
      if (/no|ningun|nada/i.test(normalized)) {
        updatedAction.inputsAsked = true;
      } else {
        const matchedItems = findInventoryItems(normalized, inventory);
        if (matchedItems.length > 0) {
          const quantities = extractQuantitiesForInputs(normalized, matchedItems);
          updatedAction.inputsConsumed = matchedItems.map(item => ({
            inventoryItemId: item.id,
            quantity: quantities[item.id] || 0,
            unit: item.unit
          }));
          updatedAction.inputsAsked = true;
        } else {
          return {
            success: false,
            message: `¿Consumiste algún insumo para esta labor? Por favor, dime el insumo y su cantidad (ej. 50 litros de gasoil, o escribe "no" si no usaste ninguno).`,
            nextPartialAction: updatedAction
          };
        }
      }
    }

    const emptyInput = updatedAction.inputsConsumed.find(i => i.quantity <= 0);
    if (emptyInput) {
      const item = inventory.find(inv => inv.id === emptyInput.inventoryItemId);
      const qty = extractQuantity(normalized);
      if (qty !== null && qty > 0) {
        emptyInput.quantity = qty;
      } else {
        return {
          success: false,
          message: `¿Qué cantidad de **${item?.name || 'insumo'}** (en ${item?.unit || 'unidades'}) usaste?`,
          nextPartialAction: updatedAction
        };
      }
    }

    const nextEmptyInput = updatedAction.inputsConsumed.find(i => i.quantity <= 0);
    if (nextEmptyInput) {
      const item = inventory.find(inv => inv.id === nextEmptyInput.inventoryItemId);
      return {
        success: false,
        message: `¿Qué cantidad de **${item?.name || 'insumo'}** (en ${item?.unit || 'unidades'}) usaste?`,
        nextPartialAction: updatedAction
      };
    }

    // --- Caso 5: Resumen y Confirmación Final ---
    const activePaddock = paddocks.find(p => p.id === updatedAction.paddockId);
    const padName = activePaddock?.name || 'General';

    // Conversión de dosis por hectárea a total si es aplicable en Pulverización/Fertilización
    if (activePaddock && (updatedAction.type === 'Pulverizacion' || updatedAction.type === 'Fertilizacion')) {
      for (const input of updatedAction.inputsConsumed) {
        const item = inventory.find(i => i.id === input.inventoryItemId);
        const lowerNotes = updatedAction.notes.toLowerCase();
        const isPerHa = lowerNotes.includes('/ha') || lowerNotes.includes('por ha') || lowerNotes.includes('por hectarea') || lowerNotes.includes('por hectárea') || (item && (item.category === 'Agroquimico' || item.category === 'Fertilizante'));
        if (isPerHa && input.quantity < 20) {
          input.quantity = input.quantity * activePaddock.area;
        }
      }
    }

    let msg = `Entendí: **${updatedAction.type}** en **${padName}**.`;
    if (updatedAction.inputsConsumed.length > 0) {
      const inputList = updatedAction.inputsConsumed.map(input => {
        const item = inventory.find(inv => inv.id === input.inventoryItemId);
        return `**${input.quantity} ${item?.unit || ''}** de **${item?.name || ''}**`;
      }).join(' y ');
      msg += ` Consumo: ${inputList}.`;
    } else {
      msg += ` (sin insumos).`;
    }

    const stockWarnings = validateStock(updatedAction.inputsConsumed, inventory);
    if (stockWarnings) {
      msg += ` ${stockWarnings}`;
    }
    msg += ` ¿Confirma registrar la actividad?`;

    return {
      success: true,
      message: msg,
      pendingAction: updatedAction,
      nextPartialAction: null
    };
  }

  // ─── PARSEO INICIAL DE COMANDOS ────────────────────────────────────────────

  // 1. NDVI Update (Flujo especial directo)
  if (/ndvi/i.test(normalized)) {
    const valueMatch = normalized.match(/(\d+\.?\d*)/);
    const ndviValue = valueMatch?.[1] ? parseFloat(valueMatch[1]) : undefined;
    const padRes = findPaddock(normalized, paddocks);
    const paddockObj = padRes && !Array.isArray(padRes) ? padRes : null;
    
    if (paddockObj && ndviValue !== undefined) {
      return {
        success: true,
        message: `Entendí que el NDVI de **${paddockObj.name}** es ${ndviValue}. ¿Confirma actualizar?`,
        pendingAction: {
          type: 'NDVI_UPDATE',
          paddockId: paddockObj.id,
          ndviValue: ndviValue,
          date: actionDate,
          inputsConsumed: [],
          notes: input
        }
      };
    } else {
      const nextAction: PendingActivity = {
        type: 'NDVI_UPDATE',
        paddockId: paddockObj?.id || undefined,
        ndviValue: ndviValue,
        date: actionDate,
        inputsConsumed: [],
        notes: input
      };
      
      const missingMsg = !paddockObj 
        ? '¿Para qué lote deseas actualizar el NDVI? Por favor, dime el nombre del lote.'
        : `¿Cuál es el nuevo valor de NDVI para el lote **${paddockObj.name}**? (ej. 0.72)`;
        
      return {
        success: false,
        message: `Identifiqué una actualización de NDVI. ${missingMsg}`,
        nextPartialAction: nextAction
      };
    }
  }

  // 2. Inventario (Flujo especial directo)
  if (/stock|inventario|insumo/i.test(normalized)) {
    return {
      success: true,
      message: 'INVENTORY_REQUEST',
    };
  }

  // --- Lógica Guiada de Creación de Labores ---
  let detectedType = '';
  if (/siembr|sembr/i.test(normalized)) detectedType = 'Siembra';
  else if (/pulveriz|aplic|fumig|pulverización/i.test(normalized)) detectedType = 'Pulverizacion';
  else if (/fertiliz|abono|fertilización/i.test(normalized)) detectedType = 'Fertilizacion';
  else if (/riego|regar/i.test(normalized)) detectedType = 'Riego';
  else if (/cosech|recol/i.test(normalized)) detectedType = 'Cosecha';
  else if (/llov|lluvia|precipitacion/i.test(normalized)) detectedType = 'Lluvia';

  if (!detectedType) {
    const nextAction: PendingActivity = {
      type: 'PENDING_TYPE',
      date: actionDate,
      inputsConsumed: [],
      notes: input
    };
    return {
      success: false,
      message: '¿Qué tipo de actividad deseas registrar? (Siembra, Pulverización, Fertilización, Cosecha, Riego o Lluvia)',
      nextPartialAction: nextAction
    };
  }

  const padRes = findPaddock(normalized, paddocks);
  let paddockId: string | undefined = undefined;
  let paddockOptions: string[] | undefined = undefined;

  if (padRes && !Array.isArray(padRes)) {
    paddockId = padRes.id;
  } else if (Array.isArray(padRes)) {
    paddockOptions = padRes.map(p => p.name);
  }

  const matchedItems = findInventoryItems(normalized, inventory);
  const inputsConsumed = [];
  let isQtyMissing = false;

  if (matchedItems.length > 0) {
    const paddockObj = padRes && !Array.isArray(padRes) ? padRes : undefined;
    const quantities = extractQuantitiesForInputs(normalized, matchedItems, paddockObj?.name);
    for (const item of matchedItems) {
      const qty = quantities[item.id] || 0;
      if (qty <= 0) isQtyMissing = true;
      inputsConsumed.push({
        inventoryItemId: item.id,
        quantity: qty,
        unit: item.unit
      });
    }
  }

  const nextAction: PendingActivity = {
    type: detectedType,
    paddockId: paddockId,
    date: actionDate,
    inputsConsumed,
    notes: input,
    inputsAsked: matchedItems.length > 0 ? true : undefined,
    paddockOptions
  };

  // 1. Validar Lote
  if (paddockId === undefined) {
    if (paddockOptions && paddockOptions.length > 0) {
      const optionsList = paddockOptions.map(o => `**${o}**`).join(', ');
      return {
        success: false,
        message: `Identifiqué un registro de ${detectedType}. Encontré varios lotes con ese nombre: ${optionsList}. ¿A cuál te refieres?`,
        nextPartialAction: nextAction
      };
    } else {
      return {
        success: false,
        message: `Identifiqué un registro de ${detectedType}. ¿En qué lote se realizó? Por favor, dime el lote.`,
        nextPartialAction: nextAction
      };
    }
  }

  // 2. Especial para Lluvia
  if (detectedType === 'Lluvia') {
    const mmMatch = normalized.match(/(\d+)/);
    if (mmMatch && mmMatch[1]) {
      nextAction.rainfallMm = parseInt(mmMatch[1], 10);
    } else {
      return {
        success: false,
        message: `Identifiqué un registro de Lluvia. ¿Cuántos milímetros (mm) llovieron?`,
        nextPartialAction: nextAction
      };
    }
    
    const padName = paddocks.find(p => p.id === paddockId)?.name || 'todo el campo';
    return {
      success: true,
      message: `Entendí que se registraron **${nextAction.rainfallMm} mm** de lluvia en **${padName}**. ¿Confirma el registro?`,
      pendingAction: nextAction
    };
  }

  // 3. Validar Insumos
  if (nextAction.inputsAsked === undefined) {
    return {
      success: false,
      message: `¿Consumiste algún insumo para esta ${detectedType.toLowerCase()}? Por favor, dime el insumo y su cantidad (ej. 50 litros de gasoil, o escribe "no" si no usaste ninguno).`,
      nextPartialAction: nextAction
    };
  }

  // 4. Validar cantidades de insumos
  if (isQtyMissing) {
    const firstEmpty = nextAction.inputsConsumed.find(i => i.quantity <= 0);
    if (firstEmpty) {
      const item = inventory.find(inv => inv.id === firstEmpty.inventoryItemId);
      return {
        success: false,
        message: `¿Qué cantidad de **${item?.name || 'insumo'}** (en ${item?.unit || 'unidades'}) usaste?`,
        nextPartialAction: nextAction
      };
    }
  }

  // 5. Todo listo
  const activePaddock = paddocks.find(p => p.id === paddockId);
  const padName = activePaddock?.name || 'General';

  if (activePaddock && (detectedType === 'Pulverizacion' || detectedType === 'Fertilizacion')) {
    for (const input of inputsConsumed) {
      const item = inventory.find(i => i.id === input.inventoryItemId);
      const isPerHa = normalized.includes('/ha') || normalized.includes('por ha') || normalized.includes('por hectarea') || normalized.includes('por hectárea') || (item && (item.category === 'Agroquimico' || item.category === 'Fertilizante'));
      if (isPerHa && input.quantity < 20) {
        input.quantity = input.quantity * activePaddock.area;
      }
    }
  }

  let msg = `Entendí: **${detectedType}** en **${padName}**.`;
  if (inputsConsumed.length > 0) {
    const inputList = inputsConsumed.map(input => {
      const item = inventory.find(inv => inv.id === input.inventoryItemId);
      return `**${input.quantity} ${item?.unit || ''}** de **${item?.name || ''}**`;
    }).join(' y ');
    msg += ` Consumo: ${inputList}.`;
  } else {
    msg += ` (sin insumos).`;
  }

  const stockWarnings = validateStock(inputsConsumed, inventory);
  if (stockWarnings) {
    msg += ` ${stockWarnings}`;
  }
  msg += ` ¿Confirma registrar la actividad?`;

  return {
    success: true,
    message: msg,
    pendingAction: nextAction
  };
}
