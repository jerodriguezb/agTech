// ============================================================================
// agroCopilot.ag — Ontología del Dominio Agrícola
// Modelo de datos fundacional para gestión agropecuaria geoespacial
// ============================================================================

/** Alias de tipo para cadenas en formato ISO 8601 */
export type ISOString = string;

/** Alias de tipo para identificadores únicos */
export type ID = string;

/** Categorías de insumos agropecuarios */
export type InputCategory = 'Agricola' | 'Ganadero' | 'Estructura' | 'Semilla' | 'Fertilizante' | 'Agroquimico' | 'Combustible' | 'Otro';

/** Tipos de actividades de campo registrables */
export type ActivityType =
  | 'Siembra'
  | 'Cosecha'
  | 'Pulverizacion'
  | 'Fertilizacion'
  | 'Riego'
  | 'Lluvia';

/** Vistas navegables de la aplicación */
export type AppView = 'dashboard' | 'map' | 'tasks' | 'inventory' | 'expenses' | 'commercial';

// ============================================================================
// Entidades de Negocio
// ============================================================================

/**
 * Farm — Establecimiento agropecuario.
 * Representa la identidad y dimensiones generales del campo.
 */
export interface Farm {
  id: ID;
  name: string;
  totalArea: number; // hectáreas
  location: string;
  owner: string;
  createdAt: ISOString;
}

/**
 * Coordenadas GeoJSON para geometrías de lotes.
 * Soporta Polygon y MultiPolygon conforme al estándar RFC 7946.
 */
export type PaddockGeometry =
  | {
      type: 'Polygon';
      coordinates: number[][][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: number[][][][];
    };

/**
 * Paddock (Lote) — Unidad de manejo agronómico georreferenciada.
 * Contiene la geometría espacial, estado fenológico (NDVI) y relación con cultivo.
 */
export interface Paddock {
  id: ID;
  farmId: ID;
  name: string;
  area: number; // hectáreas
  cropId: ID | null;
  ndvi: number; // Índice de Vegetación de Diferencia Normalizada [-1.0, 1.0]
  coordinates: PaddockGeometry;
  soilType?: string;
  yieldKgHa?: number | null;
  lastUpdated: ISOString;
}

/**
 * Crop — Cultivo asignado a un lote.
 * Incluye atributos descriptivos y color para visualización en mapas.
 */
export interface Crop {
  id: ID;
  name: string;
  variety: string;
  color: string; // HEX color para renderizado cartográfico (ej. "#2E7D32")
  plantingDate: ISOString | null;
  expectedHarvestDate: ISOString | null;
  cycleLength: number; // días
  targetNdvi: number; // NDVI Objetivo [0.0, 1.0]
  marketPriceUsdTon?: number; // Precio de venta objetivo (USD/Ton)
}

/**
 * InventoryItem — Registro de bienes/insumos en pañol.
 * Soporta control de stock mínimo para alertas.
 */
export interface InventoryItem {
  id: ID;
  name: string;
  category: InputCategory;
  currentStock: number;
  unit: string; // unidad métrica (litros, kg, unidades, bolsas)
  minimumStock: number;
  unitCost: number; // costo unitario en USD
  lastRestocked: ISOString;
}

/**
 * StaffMember — Operario o personal del establecimiento.
 */
export interface StaffMember {
  id: ID;
  farmId: ID;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
}

/**
 * FarmActivityType — Tipo de actividad paramétrico por campo.
 */
export interface FarmActivityType {
  id: ID;
  farmId: ID;
  name: string;
  color: string;
  icon: string;
}

/**
 * ActivityInput — Insumo consumido en una actividad de campo.
 * Referencia relacional al ítem de inventario y cantidad utilizada.
 */
export interface ActivityInput {
  inventoryItemId: ID;
  quantity: number;
  unit: string;
}

/**
 * Campaign — Ciclo productivo temporal (Campaña Agrícola).
 */
export interface Campaign {
  id: ID;
  farmId: ID;
  name: string;
  startDate: ISOString;
  endDate: ISOString;
  isActive: boolean;
  createdAt: ISOString;
}

// ============================================================================
// Comercialización y Acopio
// ============================================================================

export interface StorageLocation {
  id: ID;
  farmId: ID;
  name: string;
  type: 'SILO' | 'BAG' | 'EXTERNAL';
  capacityTons?: number;
  createdAt: ISOString;
}

export interface GrainStock {
  id: ID;
  farmId: ID;
  storageLocationId: ID;
  cropId: ID;
  currentTons: number;
  updatedAt: ISOString;
}

export interface SalesOrder {
  id: ID;
  farmId: ID;
  date: ISOString;
  cropId: ID;
  storageLocationId: ID | null;
  tonsSold: number;
  unitPrice: number;
  subtotal: number;
  taxPercentage: number;
  freightDeduction: number;
  netTotal: number;
  status: 'PENDING' | 'PAID';
  createdAt: ISOString;
}

export interface SalesPayment {
  id: ID;
  salesOrderId: ID;
  paymentMethod: 'ECHEQ' | 'PHYSICAL_CHEQUE' | 'TRANSFER';
  amount: number;
  referenceNumber?: string;
  dueDate?: ISOString;
  perceptionsAmount: number;
  createdAt: ISOString;
}

/**
 * PaddockCampaign — Relación entre Lote y Campaña con su cultivo asignado.
 */
export interface PaddockCampaign {
  id: ID;
  paddockId: ID;
  campaignId: ID;
  cropId: ID | null;
  yieldKgHa?: number;
}

/**
 * Activity — Registro transaccional del libro mayor de operaciones.
 * Contiene metadatos, responsable, insumos consumidos y notas.
 */
export interface Activity {
  id: ID;
  farmId: ID;
  campaignId?: ID | null;
  cropId?: ID | null;
  paddockId: ID | null;
  activityTypeId?: ID | null;
  type: string; // Nombre resuelto o legacy
  color?: string; // Hex color resuelto
  icon?: string; // Nombre del ícono resuelto
  date: ISOString;
  staffId?: ID | null;
  responsible: string; // Nombre resuelto o legacy
  inputsConsumed: ActivityInput[];
  notes: string;
  rainfallMm?: number; // solo para tipo 'Lluvia'
  appliedArea?: number; // Hectáreas reales trabajadas si fue labor parcial
  serviceCostPerHa?: number; // Costo operativo / contratista (USD/ha)
  createdAt: ISOString;
}

export interface ParsedInvoiceItem {
  inventoryItemId: string | null;
  originalName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ParsedInvoice {
  date: string;
  provider: string;
  totalAmount: number;
  items: ParsedInvoiceItem[];
  receiptUrl?: string | null; // Guardamos la URL local o remota de la foto
}

/**
 * PendingActivity — Estructura temporal para la confirmación desde el chat
 */
export interface PendingActivity {
  type: string;
  paddockId?: ID | null;
  cropId?: ID | null;
  date: ISOString;
  rainfallMm?: number;
  ndviValue?: number;
  notes: string;
  inputsConsumed: ActivityInput[];
  appliedArea?: number;
  serviceCostPerHa?: number;
  inputsAsked?: boolean;
  paddockOptions?: string[];
  parsedInvoice?: ParsedInvoice; // Usado cuando type === 'INVOICE_CONFIRMATION'
}

// ============================================================================
// Permisos y Roles de Usuario
// ============================================================================

/** Miembro asignado a un establecimiento con un rol específico */
export interface FarmUser {
  id: ID;
  farmId: ID;
  email: string;
  userId: ID | null;
  role: UserRole;
  createdAt: ISOString;
}

// ============================================================================
// Mensajería del Copiloto
// ============================================================================

/** Mensaje en el canal conversacional del copiloto IA */
export interface ChatMessage {
  id: ID;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: ISOString;
  isProcessing?: boolean;
  // Metadata especial para tarjetas de confirmación en la UI del bot
  pendingAction?: PendingActivity;
  showLoginButton?: boolean;
}

// ============================================================================
// Módulo ERP (Costos y Finanzas)
// ============================================================================

export type AccountType = 'OPEX_DIRECT' | 'OPEX_INDIRECT' | 'CAPEX' | 'REVENUE';
export type CostCenterType = 'DIRECT' | 'INDIRECT';
export type TransactionType = 'EXPENSE' | 'INCOME';

export interface ChartOfAccount {
  id: ID;
  farmId: ID;
  code: string;
  name: string;
  type: AccountType;
  createdAt: ISOString;
}

export interface CostCenter {
  id: ID;
  farmId: ID;
  name: string;
  type: CostCenterType;
  paddockId?: ID | null;
  createdAt: ISOString;
}

export interface TransactionItem {
  id: ID;
  transactionId: ID;
  inventoryItemId?: ID | null;
  cropId?: ID | null; // Agregado para ventas de cosecha
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface FinancialTransaction {
  id: ID;
  farmId: ID;
  date: ISOString;
  description: string;
  accountId: ID;
  costCenterId?: ID | null;
  amount: number;
  type: TransactionType;
  receiptUrl?: string | null;
  items?: TransactionItem[];
  createdAt: ISOString;
}

// ============================================================================
// Interfaz del Store Global
// ============================================================================

export interface AgriState {
  // Datos del dominio
  farms: Farm[];
  campaigns: Campaign[];
  paddocks: Paddock[];
  crops: Crop[];
  inventory: InventoryItem[];
  activities: Activity[];
  staff: StaffMember[];
  activityTypes: FarmActivityType[];
  
  // ERP
  chartOfAccounts: ChartOfAccount[];
  costCenters: CostCenter[];
  transactions: FinancialTransaction[];

  // Data: Comercialización
  storageLocations: StorageLocation[];
  grainStocks: GrainStock[];
  salesOrders: SalesOrder[];
  salesPayments: SalesPayment[];

  // Estado de UI y Carga
  currentFarmId: ID;
  activeCampaignId: ID | null; // La campaña actualmente seleccionada en el sistema
  currentView: AppView;
  isSidebarCollapsed: boolean;
  isCopilotOpen: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  supabaseStatus: 'disconnected' | 'connected' | 'simulated';
  user: any | null; // Guardará el objeto User de Supabase o null
  partialAction: PendingActivity | null; // Acción parcial en construcción conversacional

  // Chat del copiloto
  chatMessages: ChatMessage[];

  // Configuración de agroCopilot AI
  customSystemPrompt: string | null;
  customAliases: Record<string, string>;
  userRole: UserRole | null;

  // Gestión de Permisos y Miembros del Campo
  farmUsers: FarmUser[];
}

export type UserRole = 'owner' | 'manager' | 'accountant' | 'agronomist' | 'operator';

export interface AgriActions {
  // Inicialización y Auth
  loadInitialData: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  setUser: (user: any | null) => void;
  setAuthModalOpen: (isOpen: boolean) => void;
  setPartialAction: (action: PendingActivity | null) => void;
  clearChatMessages: () => void;

  // Modificadores de UI
  setCurrentFarm: (id: ID) => void;
  setActiveCampaign: (id: ID | null) => void;
  setCurrentView: (view: AppView) => void;
  toggleSidebar: () => void;
  toggleCopilot: () => void;

  // Finanzas / ERP
  addTransaction: (transaction: Omit<FinancialTransaction, 'id' | 'farmId' | 'createdAt'>) => Promise<void>;
  addChartOfAccount: (account: Omit<ChartOfAccount, 'id' | 'createdAt' | 'farmId'>) => Promise<void>;
  addCostCenter: (costCenter: Omit<CostCenter, 'id' | 'createdAt' | 'farmId'>) => Promise<void>;

  // Acciones Comercialización
  addStorageLocation: (location: Omit<StorageLocation, 'id' | 'farmId' | 'createdAt'>) => Promise<void>;
  updateGrainStock: (storageLocationId: string, cropId: string, tonsDelta: number) => Promise<void>;
  addSalesOrder: (order: Omit<SalesOrder, 'id' | 'farmId' | 'createdAt' | 'status'>, payments: Omit<SalesPayment, 'id' | 'salesOrderId' | 'createdAt'>[]) => Promise<void>;

  // Lotes (Paddocks)
  addPaddock: (paddockData: Omit<Paddock, 'id' | 'area' | 'lastUpdated'> & { area?: number }) => Promise<void>;
  updatePaddock: (id: ID, updates: Partial<Paddock>) => Promise<void>;
  deletePaddock: (id: ID) => Promise<void>;
  updatePaddockNDVI: (paddockId: ID, newNdvi: number) => Promise<void>;
  assignCropToPaddock: (paddockId: ID, cropId: ID) => Promise<void>;
  recordPaddockYield: (paddockId: ID, yieldKgHa: number) => Promise<void>;

  // Pañol (Inventory)
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'lastRestocked'>) => Promise<void>;
  updateInventoryItem: (id: ID, updates: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: ID) => Promise<void>;
  updateInventoryStock: (itemId: ID, quantityDelta: number) => Promise<void>;

  // Personal (Staff)
  addStaff: (staff: Omit<StaffMember, 'id' | 'farmId'>) => Promise<void>;
  updateStaff: (id: ID, staff: Partial<StaffMember>) => Promise<void>;
  deleteStaff: (id: ID) => Promise<void>;

  // Tipos de Actividad (Activity Types)
  addActivityType: (type: Omit<FarmActivityType, 'id' | 'farmId'>) => Promise<void>;
  updateActivityType: (id: ID, type: Partial<FarmActivityType>) => Promise<void>;
  deleteActivityType: (id: ID) => Promise<void>;

  // Historial de Actividades (Activities)
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>;
  updateActivity: (id: ID, activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>;
  deleteActivity: (id: ID) => Promise<void>;

  // Chat
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  setMessageProcessing: (messageId: ID, isProcessing: boolean) => void;

  // AI Prompt & Aliases
  updateSystemPrompt: (prompt: string | null) => Promise<void>;
  updateAliases: (aliases: Record<string, string>) => Promise<void>;

  // Permisos de Usuarios
  loadFarmUsers: () => Promise<void>;
  addFarmUser: (email: string, role: UserRole) => Promise<void>;
  updateFarmUser: (id: ID, role: UserRole) => Promise<void>;
  deleteFarmUser: (id: ID) => Promise<void>;

  // Cultivos (Crops)
  addCrop: (crop: Omit<Crop, 'id'>) => Promise<void>;
  updateCrop: (id: ID, crop: Partial<Crop>) => Promise<void>;
  deleteCrop: (id: ID) => Promise<void>;
}

export type AgriStore = AgriState & AgriActions;

