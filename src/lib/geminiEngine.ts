import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { Paddock, InventoryItem, Crop, ChatMessage, PendingActivity } from '../types';
import { processNaturalLanguage } from './nlpEngine';
import { useAgriStore } from '../store/useAgriStore';

// ─── Configuración ───────────────────────────────────────────────────────────

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();

export const isGeminiConfigured = GEMINI_API_KEY !== '' && !GEMINI_API_KEY.includes('tu-gemini');

let genAI: GoogleGenerativeAI | null = null;

if (isGeminiConfigured) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// ─── Tipos de Respuesta del LLM ──────────────────────────────────────────────

interface GeminiParsedResponse {
  message: string;
  intent: 'register_activity' | 'update_ndvi' | 'check_inventory' | 'conversation';
  ready_to_confirm: boolean;
  activity?: {
    type: string;
    paddock_id: string | null;
    paddock_name: string | null;
    date: string;
    inputs: Array<{
      inventory_item_id: string;
      name: string;
      quantity: number;
      unit: string;
    }>;
    rainfall_mm?: number;
    ndvi_value?: number;
    notes: string;
  };
}

// ─── Constructor de System Prompt ────────────────────────────────────────────

function buildSystemPrompt(
  paddocks: Paddock[],
  inventory: InventoryItem[],
  crops: Crop[],
  customPrompt: string | null = null
): string {
  // Construir lista de lotes con info del cultivo
  const paddockList = paddocks.map(p => {
    const crop = crops.find(c => c.id === p.cropId);
    const cropName = crop ? crop.name : 'Sin cultivo';
    return `  - ID: "${p.id}" | Nombre: "${p.name}" | Área: ${p.area} ha | Cultivo: ${cropName} | NDVI: ${p.ndvi}`;
  }).join('\n');

  // Construir lista de insumos con stock
  const inventoryList = inventory.map(i => {
    const stockStatus = i.currentStock < i.minimumStock ? '⚠️ BAJO MÍNIMO' : 'OK';
    return `  - ID: "${i.id}" | Nombre: "${i.name}" | Stock: ${i.currentStock} ${i.unit} | Mínimo: ${i.minimumStock} ${i.unit} | Estado: ${stockStatus}`;
  }).join('\n');

  // Lotes disponibles para listar en caso de error
  const paddockNamesList = paddocks.map(p => `- ${p.name}`).join('\n');

  // Primeros 10 insumos con stock > 0
  const top10WithStock = inventory
    .filter(i => i.currentStock > 0)
    .slice(0, 10)
    .map(i => `- ${i.name} (Stock: ${i.currentStock} ${i.unit})`)
    .join('\n');

  const basePrompt = customPrompt || `Sos agroCopilot, un asistente agrícola inteligente para gestión de campo en Argentina.
Hablás en español argentino de manera muy natural, humana, amigable e informal (usá "vos", tildes rioplatenses, "che" de vez en cuando, de forma cálida). Queremos humanizar la carga de datos del campo, haciendo que se sienta como charlar con un colega o compañero de trabajo, no como llenar un formulario robótico o frío. Usá emojis con moderación pero con buena onda.

## TU ROL
Ayudás a registrar labores de campo (Siembra, Pulverización, Fertilización, Cosecha, Riego, Lluvia), actualizar NDVI de lotes, y consultar el inventario de insumos.`;

  return `${basePrompt}

## LOTES DISPONIBLES EN EL CAMPO
${paddockList || '  (No hay lotes cargados)'}

## INSUMOS EN INVENTARIO (PAÑOL)
${inventoryList || '  (No hay insumos cargados)'}

## REGLAS DE NEGOCIO ESTRICTAS (HUMANIZADAS)

1. **Validación de Lotes (Paddocks):**
   - Si el usuario menciona un lote que NO coincide con ninguno de los lotes cargados (por ejemplo, "vaca muerta" o "lote mala mia"), debés responderle de forma muy amigable diciéndole que ese lote específico no está disponible en este momento.
   - En el mismo mensaje, enviale la lista completa de los lotes que sí están disponibles en el campo para guiarlo.
   - Lotes actualmente disponibles:
${paddockNamesList || '- (No hay lotes cargados)'}
   - Sé flexible y comprensivo con variaciones del nombre: si dice "norte", asumí que es "Lote Norte". Si hay dudas o ambigüedad, preguntale con calidez.

2. **Validación de Insumos (Inventory Items):**
   - Si el usuario te pide registrar o menciona un insumo que NO existe en la base de datos de insumos (o sea, no está en la lista de inventario de arriba), decile con buena onda que ese insumo no lo tenés cargado en la base de datos.
   - Para guiar al usuario a encontrar insumos correctos, debés listarle en tu respuesta los primeros 10 insumos que tienen stock (stock mayor a 0) como ejemplos del inventario actual.
   - Insumos de ejemplo con stock disponible en este momento:
${top10WithStock || '- (No hay insumos con stock actualmente)'}
   - Aceptá sinónimos comunes de insumos (ej. "glifo" por "Glifosato", "gasoil" por "Gasoil Grado 3", "urea" por "Urea Granulada").
   - Si el insumo existe pero el stock es insuficiente para la cantidad que dice el usuario, hacele una advertencia amigable ("Ojo, que tenemos poco stock de eso..."), pero permitile confirmar el registro de todos modos (no bloquees la carga).

3. **Flujo Conversacional Humano y Natural:**
   - La conversación debe sentirse fluida. Para registrar una labor de campo (Tarea de campo), recordá indagar y preguntar de forma natural antes de confirmar: el Tipo de actividad, el Lote y los insumos utilizados (que pueden ser varios y con sus cantidades).
   - Siempre pedí confirmación clara al final con un resumen de los datos antes de grabar definitivamente la actividad.
   - Si el usuario no usó insumos, permitile decir "no" y registrá la actividad sin insumos.
   - Hablá siempre como un ser humano que asiste a otro, no des respuestas esquemáticas o excesivamente cortantes salvo cuando sea necesario para ser claro.

4. **Fechas:**
   - Si dice "ayer", "antes de ayer", etc., calculá la fecha relativa correspondiente. Si no dice nada, asumí el día de hoy. Las fechas en el JSON resultante deben estar en formato ISO 8601 (YYYY-MM-DD).

5. **Formato JSON:**
   Respondé SIEMPRE y ÚNICAMENTE en formato JSON válido con esta estructura exacta (no agregues texto fuera del JSON):

{
  "message": "Tu respuesta en lenguaje natural al usuario (con markdown básico si querés resaltar algo, y usando el tono amigable y humano en español argentino descripto arriba)",
  "intent": "register_activity | update_ndvi | check_inventory | conversation",
  "ready_to_confirm": true/false,
  "activity": {
    "type": "Siembra | Pulverizacion | Fertilizacion | Cosecha | Riego | Lluvia",
    "paddock_id": "ID del lote o null",
    "paddock_name": "Nombre del lote o null",
    "date": "ISO 8601 (YYYY-MM-DD)",
    "inputs": [
      {
        "inventory_item_id": "ID del insumo",
        "name": "Nombre del insumo",
        "quantity": 50,
        "unit": "litros/kg/etc"
      }
    ],
    "rainfall_mm": null,
    "ndvi_value": null,
    "notes": "Texto original del usuario"
  }
}

- "ready_to_confirm" = true solo cuando ya tenés todos los datos indispensables (Actividad, Lote, e Insumos consultados si corresponden) y le estás mostrando el resumen final de confirmación con los botones "Sí, confirmar" y "Cancelar".
- "activity" puede ser null si estás en medio de la charla preguntando datos faltantes o conversando.
- En "inputs", usá los IDs y nombres reales del inventario. Si no se usaron insumos, dejá el array vacío.`;
}

// ─── Conversión de Respuesta Gemini a formato del Store ──────────────────────

function geminiResponseToResult(
  parsed: GeminiParsedResponse,
  _paddocks: Paddock[],
  inventory: InventoryItem[]
): {
  success: boolean;
  message: string;
  pendingAction?: PendingActivity;
  nextPartialAction?: PendingActivity | null;
} {
  // Intent: check_inventory
  if (parsed.intent === 'check_inventory') {
    return {
      success: true,
      message: 'INVENTORY_REQUEST',
    };
  }

  // Intent: conversation (saludo, ayuda, etc)
  if (parsed.intent === 'conversation' || !parsed.activity) {
    return {
      success: false,
      message: parsed.message,
      nextPartialAction: null,
    };
  }

  // Intent: update_ndvi
  if (parsed.intent === 'update_ndvi' && parsed.ready_to_confirm && parsed.activity) {
    const act = parsed.activity;
    return {
      success: true,
      message: parsed.message,
      pendingAction: {
        type: 'NDVI_UPDATE',
        paddockId: act.paddock_id || undefined,
        ndviValue: act.ndvi_value,
        date: act.date || new Date().toISOString(),
        inputsConsumed: [],
        notes: act.notes || '',
      },
    };
  }

  // Intent: register_activity
  if (parsed.intent === 'register_activity' || parsed.intent === 'update_ndvi') {
    const act = parsed.activity;
    
    // Validar que los IDs de insumos existen realmente en el inventario
    const validatedInputs = (act.inputs || [])
      .filter(input => inventory.some(inv => inv.id === input.inventory_item_id))
      .map(input => ({
        inventoryItemId: input.inventory_item_id,
        quantity: input.quantity,
        unit: input.unit,
      }));

    const pendingActivity: PendingActivity = {
      type: act.type || '',
      paddockId: act.paddock_id || undefined,
      date: act.date || new Date().toISOString(),
      inputsConsumed: validatedInputs,
      notes: act.notes || '',
      rainfallMm: act.rainfall_mm || undefined,
      ndviValue: act.ndvi_value || undefined,
    };

    if (parsed.ready_to_confirm) {
      return {
        success: true,
        message: parsed.message,
        pendingAction: pendingActivity,
      };
    } else {
      // Gemini necesita más info, mantener como partial
      return {
        success: false,
        message: parsed.message,
        nextPartialAction: null, // Gemini maneja el contexto via historial
      };
    }
  }

  // Fallback
  return {
    success: false,
    message: parsed.message || 'No pude procesar tu mensaje. ¿Podés reformularlo?',
    nextPartialAction: null,
  };
}

// ─── Función Principal ───────────────────────────────────────────────────────

export async function processWithGemini(
  userMessage: string,
  chatHistory: ChatMessage[],
  paddocks: Paddock[],
  inventory: InventoryItem[],
  crops: Crop[],
  partialAction: PendingActivity | null
): Promise<{
  success: boolean;
  message: string;
  pendingAction?: PendingActivity;
  nextPartialAction?: PendingActivity | null;
}> {
  // Si Gemini no está configurado, usar fallback regex
  if (!isGeminiConfigured || !genAI) {
    console.warn('[agroCopilot] Gemini no configurado, usando motor NLP regex.');
    return processNaturalLanguage(userMessage, paddocks, inventory, partialAction);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const customPrompt = useAgriStore.getState().customSystemPrompt;
    // Construir system prompt con datos actuales de la BD
    const systemPrompt = buildSystemPrompt(paddocks, inventory, crops, customPrompt);

    // Construir historial de conversación (últimos 20 mensajes para contexto)
    const recentMessages = chatHistory
      .filter(m => m.role !== 'system' && !m.isProcessing)
      .slice(-20);

    const geminiHistory = recentMessages.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));

    // Crear chat con historial
    const chat = model.startChat({
      history: geminiHistory,
      systemInstruction: systemPrompt,
    });

    // Enviar mensaje del usuario
    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    // Parsear JSON
    let parsed: GeminiParsedResponse;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Si el JSON viene con markdown fences, limpiar
      const cleanJson = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      parsed = JSON.parse(cleanJson);
    }

    // Convertir a formato del store
    return geminiResponseToResult(parsed, paddocks, inventory);
  } catch (error: any) {
    console.error('[agroCopilot] Error con Gemini, usando fallback regex:', error);

    // Fallback al motor regex local
    const fallbackResult = processNaturalLanguage(userMessage, paddocks, inventory, partialAction);
    
    // Si el error es de API key o configuración, agregar nota
    if (error?.message?.includes('API_KEY') || error?.status === 403) {
      return {
        ...fallbackResult,
        message: `⚠️ _Modo offline (error de API)._ ${fallbackResult.message}`,
      };
    }

    return fallbackResult;
  }
}
