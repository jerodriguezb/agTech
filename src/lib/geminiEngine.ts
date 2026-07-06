import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { Paddock, InventoryItem, Crop, ChatMessage, PendingActivity } from '../types';
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
  intent: 'register_activity' | 'update_ndvi' | 'check_inventory' | 'register_sale' | 'conversation';
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
  sale_details?: {
    crop_id: string | null;
    tons: number;
    price_per_ton: number;
  };
}

// ─── Constructor de System Prompt ────────────────────────────────────────────

function buildSystemPrompt(
  paddocks: Paddock[],
  inventory: InventoryItem[],
  crops: Crop[],
  customPrompt: string | null = null,
  partialAction: PendingActivity | null = null
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

  // Cultivos disponibles
  const cropList = crops.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');

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

## CULTIVOS DISPONIBLES (PARA VENTAS)
${cropList || '  (No hay cultivos cargados)'}

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
   - LA FECHA Y HORA ACTUAL ES: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}).
   - Si el usuario dice "hoy", usá la fecha de arriba. Si dice "ayer", restá un día. Si dice "antes de ayer", restá dos días. Y así sucesivamente.
   - Si no menciona ninguna fecha, asumí la fecha de hoy (${new Date().toISOString().split('T')[0]}).
   - Las fechas en el JSON resultante deben estar en formato ISO 8601 (YYYY-MM-DD).

5. **Formato JSON:**
   Respondé SIEMPRE y ÚNICAMENTE en formato JSON válido con esta estructura exacta (no agregues texto fuera del JSON):

{
  "message": "Tu respuesta en lenguaje natural al usuario (con markdown básico si querés resaltar algo, y usando el tono amigable y humano en español argentino descripto arriba)",
  "intent": "register_activity | update_ndvi | check_inventory | register_sale | conversation",
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
  },
  "sale_details": {
    "crop_id": "ID del cultivo o null",
    "tons": 100,
    "price_per_ton": 350.5
  }
}

- "intent": DEBE ser "register_activity" o "register_sale" en el momento que tengas los datos para registrar (aunque falten algunos). NO uses "conversation" cuando estés armando un registro.
- "ready_to_confirm": true/false. DEBE SER true EXACTAMENTE en el MISMO mensaje en el que le mostrás el resumen al usuario y le preguntás "¿Está todo correcto para confirmar?". Es obligatorio que sea true en ese momento para que el sistema pueda mostrarle los botones de [Sí, confirmar] en la pantalla.
- "activity" se usa para labores de campo. Puede ser null si estás en medio de la charla o si es una venta.
- "sale_details" se usa EXCLUSIVAMENTE cuando "intent" es "register_sale". Puede ser null en otros casos.
- En "inputs", usá los IDs y nombres reales del inventario. Si no se usaron insumos, dejá el array vacío.

${partialAction ? `## CONTEXTO ACTUAL (MEMORIA A CORTO PLAZO)
Actualmente estás recolectando datos para una actividad y el usuario ya te dio esta información en turnos anteriores:
\`\`\`json
${JSON.stringify(partialAction, null, 2)}
\`\`\`
=> ¡IMPORTANTE! Recordá y utilizá estos datos. NO le vuelvas a preguntar al usuario cosas que ya están en este JSON (por ejemplo, si ya dice "paddockId" o "type", es porque ya te lo dijo). Solo preguntá lo que falta, o si ya tenés todo (Tipo, Lote, Fecha e insumos si los hay), preguntale si quiere confirmar y marcá "ready_to_confirm": true.` : ''}`;
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
  if (parsed.intent === 'conversation' || (!parsed.activity && !parsed.sale_details)) {
    return {
      success: false,
      message: parsed.message,
      nextPartialAction: null,
    };
  }

  // Intent: register_sale
  if (parsed.intent === 'register_sale' && parsed.sale_details) {
    const sale = parsed.sale_details;
    const pendingActivity: PendingActivity = {
      type: 'SALE_CONFIRMATION',
      date: new Date().toISOString(),
      cropId: sale.crop_id === 'null' ? null : sale.crop_id,
      notes: parsed.message,
      inputsConsumed: [],
      appliedArea: sale.tons, // Usamos appliedArea temporalmente para las toneladas
      serviceCostPerHa: sale.price_per_ton, // Usamos serviceCostPerHa para el precio
    };

    const isComplete = !!sale.crop_id && sale.tons > 0 && parsed.ready_to_confirm;

    if (isComplete) {
      return {
        success: true,
        message: parsed.message,
        pendingAction: pendingActivity,
        nextPartialAction: pendingActivity,
      };
    } else {
      return {
        success: false,
        message: parsed.message,
        nextPartialAction: pendingActivity,
      };
    }
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
      paddockId: (act.paddock_id === 'null' ? null : act.paddock_id) || undefined,
      date: act.date || new Date().toISOString(),
      inputsConsumed: validatedInputs,
      notes: act.notes || '',
      rainfallMm: act.rainfall_mm && act.rainfall_mm !== 'null' ? Number(act.rainfall_mm) : undefined,
      ndviValue: act.ndvi_value && act.ndvi_value !== 'null' ? Number(act.ndvi_value) : undefined,
    };

    // Confiamos exclusivamente en el flag de la IA que fue instruida para setearlo en true
    // solo cuando está pidiendo la confirmación final.
    const isComplete = !!act.type && parsed.ready_to_confirm;

    if (isComplete) {
      return {
        success: true,
        message: parsed.message,
        pendingAction: pendingActivity,
        nextPartialAction: pendingActivity, // Mantenemos la memoria por si el usuario decide modificar algo en vez de hacer clic
      };
    } else {
      // Gemini necesita más info, mantener como partial
      return {
        success: false,
        message: parsed.message,
        nextPartialAction: pendingActivity, // Guardamos lo recolectado hasta ahora
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
  if (!isGeminiConfigured || !genAI) {
    return {
      success: false,
      message: '⚠️ La Inteligencia Artificial no está configurada. Por favor, agregá tu API Key de Gemini en los Ajustes.',
      nextPartialAction: null
    };
  }

  try {
    const customPrompt = useAgriStore.getState().customSystemPrompt;
    // Construir system prompt con datos actuales de la BD y memoria a corto plazo
    const systemPrompt = buildSystemPrompt(paddocks, inventory, crops, customPrompt, partialAction);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    // Filtrar mensajes del sistema y placeholders de procesamiento
    const chatHistoryClean = chatHistory.filter(m => m.role !== 'system' && !m.isProcessing);

    // Obtener los mensajes pasados (excluyendo el mensaje actual que vamos a enviar en sendMessage)
    const pastMessages = chatHistoryClean.slice(0, -1);

    // Construir historial válido para Gemini (estrictamente alternado, empezando con user y terminando con model)
    const geminiHistory: { role: 'user' | 'model', parts: { text: string }[] }[] = [];
    let expectedRole = 'model';
    
    for (let i = pastMessages.length - 1; i >= 0; i--) {
      const role = pastMessages[i].role === 'user' ? 'user' : 'model';
      if (role === expectedRole) {
        
        let textContent = pastMessages[i].content;
        // Si el rol es model y estamos forzando application/json, el historial del modelo debe ser JSON válido
        if (role === 'model') {
           textContent = JSON.stringify({
             message: pastMessages[i].content,
             intent: 'conversation',
             ready_to_confirm: false,
             activity: null
           });
        }

        geminiHistory.unshift({
          role: role as 'user' | 'model',
          parts: [{ text: textContent }],
        });
        expectedRole = expectedRole === 'model' ? 'user' : 'model';
      }
      if (geminiHistory.length >= 20) break;
    }
    
    // Gemini requiere que el historial comience con 'user'
    if (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.shift();
    }

    console.log('[agroCopilot] Input:', userMessage);
    console.log('[agroCopilot] Clean history:', chatHistoryClean);
    console.log('[agroCopilot] Past messages:', pastMessages);
    console.log('[agroCopilot] Gemini history:', geminiHistory);

    // Crear chat con historial
    const chat = model.startChat({
      history: geminiHistory,
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

    console.log('[agroCopilot] Gemini RAW Response:', JSON.stringify(parsed, null, 2));

    // Convertir a formato del store
    return geminiResponseToResult(parsed, paddocks, inventory);
  } catch (error: any) {
    console.error('[agroCopilot] Error con Gemini:', error);
    
    // Fallback: Si Gemini falla (ej. JSON mal formado o red), retornamos mensaje seguro
    return {
      success: false,
      message: `⚠️ **Oops:** Hubo un pequeño corte en la comunicación con la IA (${error?.message?.split('\\n')[0] || 'Error desconocido'}). ¿Podés repetirlo?`,
      nextPartialAction: null
    };
  }
}

import { ParsedInvoice, ParsedInvoiceItem } from '../types';

// ─── OCR de Facturas (Módulo Compras) ──────────────────────────────────────────

export async function parseInvoiceImage(
  base64Image: string,
  mimeType: string,
  inventory: InventoryItem[]
): Promise<ParsedInvoice> {
  if (!genAI) {
    throw new Error('Gemini no está configurado.');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1, // Baja temperatura para OCR estricto
      responseMimeType: 'application/json',
    },
  });

  const inventoryContext = inventory.map(i => `- ID: "${i.id}" | Nombre: "${i.name}"`).join('\n');

  const prompt = `
Actúa como un OCR experto en facturas y remitos agropecuarios.
Analiza la imagen adjunta y extrae los datos de la compra.
Devuelve ÚNICAMENTE un objeto JSON con la siguiente estructura exacta:
{
  "date": "YYYY-MM-DD",
  "provider": "Nombre del proveedor o comercio",
  "totalAmount": 1500.50, // Número total de la factura
  "items": [
    {
      "inventoryItemId": "ID_DEL_INSUMO_O_NULL",
      "originalName": "Nombre original en la factura",
      "quantity": 10.5,
      "unitPrice": 100.0,
      "subtotal": 1050.0
    }
  ]
}

Reglas:
1. Las fechas deben estar en formato YYYY-MM-DD. Si no hay fecha, usa la fecha de hoy.
2. Para "inventoryItemId", intenta hacer coincidir (fuzzy match) el nombre original de la factura con la siguiente lista de insumos de mi pañol. Si estás MUY seguro de que coinciden (ej. "Glifo 48%" y "Glifosato"), pon el ID exacto. Si no coincide con nada, pon null.
Lista de insumos en mi pañol:
${inventoryContext || '(Lista vacía)'}
3. Extrae la cantidad, precio unitario y subtotal numéricamente. Si la imagen no tiene precio unitario, calcúlalo como subtotal / quantity.
`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
        
    const parsed: ParsedInvoice = JSON.parse(cleanJson);
    return parsed;
  } catch (err: any) {
    console.error('[parseInvoiceImage] Error parsing invoice:', err);
    throw err;
  }
}
