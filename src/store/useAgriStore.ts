import { create } from 'zustand';
import type { AgriStore, Activity, ChatMessage, AppView, ID, InputCategory, InventoryItem, Paddock, StaffMember, FarmActivityType, UserRole, FarmUser } from '../types';
import { generateId } from '../lib/utils';
import {
  mockFarm,
  mockPaddocks,
  mockCrops,
  mockInventory,
  mockActivities,
  mockStaff,
  mockActivityTypes,
} from './mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const welcomeMessage: ChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content:
    '¡Hola! 👋 Soy tu asistente agrícola agroCopilot. Podés decirme cosas como:\n\n• "Ayer llovieron 25 mm"\n• "Se sembró trigo en Lote Este"\n• "Aplicamos glifosato en Lote Norte"\n• "Actualizar NDVI de Lote Sur a 0.72"\n\n¿En qué puedo ayudarte?',
  timestamp: new Date().toISOString(),
};

const saveToLocalStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
  }
};

const clearLocalStorage = () => {
  localStorage.removeItem('agrocopilot_paddocks');
  localStorage.removeItem('agrocopilot_inventory');
  localStorage.removeItem('agrocopilot_activities');
  localStorage.removeItem('agrocopilot_chat');
};

/**
 * Store global de Zustand para agroCopilot.ag.
 * Gestiona el estado de dominio conectado a Supabase con fallback simulado.
 */
export const useAgriStore = create<AgriStore>((set, get) => ({
  // ─── Estado Inicial del Dominio ────────────────────────────────────
  farms: [mockFarm],
  campaigns: [],
  paddocks: [...mockPaddocks],
  crops: [...mockCrops],
  inventory: [...mockInventory],
  activities: [...mockActivities],
  staff: [...mockStaff],
  activityTypes: [...mockActivityTypes],
  chartOfAccounts: [],
  costCenters: [],
  transactions: [],

  // ─── Estado de UI y Carga ──────────────────────────────────────────
  currentFarmId: mockFarm.id,
  activeCampaignId: null,
  currentView: 'dashboard' as AppView,
  isSidebarCollapsed: false,
  isCopilotOpen: false,
  isLoading: false,
  isAuthModalOpen: false,
  supabaseStatus: isSupabaseConfigured ? 'disconnected' : 'simulated',
  user: null,
  partialAction: null,

  // ─── Chat del Copiloto ─────────────────────────────────────────────
  chatMessages: [welcomeMessage],

  // Configuración de agroCopilot AI
  customSystemPrompt: null,
  customAliases: {
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
  },
  userRole: null,
  farmUsers: [],

  // ─── Carga de Datos y Autenticación ────────────────────────────────

  loadInitialData: async () => {
    const state = get();
    
    // Si no está configurado Supabase o no hay usuario autenticado, usamos modo local (simulado)
    if (!isSupabaseConfigured || !supabase || !state.user) {
      const savedPaddocks = localStorage.getItem('agrocopilot_paddocks');
      const savedInventory = localStorage.getItem('agrocopilot_inventory');
      const savedActivities = localStorage.getItem('agrocopilot_activities');
      const savedChat = localStorage.getItem('agrocopilot_chat');

      const savedPrompt = localStorage.getItem('agrocopilot_custom_prompt');
      const savedAliases = localStorage.getItem('agrocopilot_custom_aliases');
      const savedPermissions = localStorage.getItem('agrocopilot_farm_users');
      
      const defaultPermissions: FarmUser[] = [
        { id: 'perm-1', farmId: mockFarm.id, email: 'owner@campo.com', userId: 'user-owner', role: 'owner', createdAt: new Date().toISOString() },
        { id: 'perm-2', farmId: mockFarm.id, email: 'capataz@campo.com', userId: null, role: 'manager', createdAt: new Date().toISOString() },
        { id: 'perm-3', farmId: mockFarm.id, email: 'contador@campo.com', userId: null, role: 'accountant', createdAt: new Date().toISOString() },
      ];

      set({
        farms: [mockFarm],
        paddocks: savedPaddocks ? JSON.parse(savedPaddocks) : [...mockPaddocks],
        crops: [...mockCrops],
        inventory: savedInventory ? JSON.parse(savedInventory) : [...mockInventory],
        activities: savedActivities ? JSON.parse(savedActivities) : [...mockActivities],
        chatMessages: savedChat ? JSON.parse(savedChat) : [welcomeMessage],
        currentFarmId: mockFarm.id,
        supabaseStatus: isSupabaseConfigured ? 'disconnected' : 'simulated',
        isLoading: false,
        customSystemPrompt: savedPrompt || null,
        customAliases: savedAliases ? JSON.parse(savedAliases) : get().customAliases,
        userRole: state.user ? 'owner' : null,
        farmUsers: savedPermissions ? JSON.parse(savedPermissions) : defaultPermissions,
      });
      return;
    }

    set({ isLoading: true, supabaseStatus: 'connected' });

    try {
      const userId = state.user.id;

      // 1. Obtener establecimientos del usuario
      let { data: farmsData, error: farmsError } = await supabase
        .from('farms')
        .select('*');

      if (farmsError) throw farmsError;

      // 2. Si no tiene establecimientos, sembramos los datos de prueba
      if (!farmsData || farmsData.length === 0) {
        // Formatear coordenadas de lotes para insertar como GeoJSON
        const formattedPaddocks = mockPaddocks.map((p) => ({
          name: p.name,
          ndvi: p.ndvi,
          cropId: p.cropId,
          coordinates: p.coordinates,
        }));

        const { data: seedSuccess, error: seedError } = await supabase.rpc(
          'fn_seed_database_if_empty',
          {
            p_user_id: userId,
            p_farm_name: mockFarm.name,
            p_farm_area: mockFarm.totalArea,
            p_crops: mockCrops,
            p_paddocks: formattedPaddocks,
            p_inventory: [], // Enviamos vacío para evitar conflictos de constraints (como inventory_items_category_check) con la BD del usuario
          }
        );

        if (seedError) throw seedError;

        if (seedSuccess) {
          // Re-consultar establecimientos después de sembrar
          const { data: reFarms } = await supabase.from('farms').select('*');
          farmsData = reFarms;
        }
      }

      if (!farmsData || farmsData.length === 0) {
        throw new Error('No se pudo inicializar ni cargar ningún establecimiento.');
      }

      const activeFarm = farmsData[0];
      const farmId = activeFarm.id;

      // 3. Consultas paralelas para el establecimiento seleccionado
      const [
        cropsRes, paddocksRes, inventoryRes, activitiesRes, 
        chatRes, staffRes, typesRes, settingsRes, 
        userRoleRes, farmUsersRes, campaignsRes,
        chartOfAccountsRes, costCentersRes, transactionsRes,
        storageLocationsRes, grainStocksRes, salesOrdersRes, salesPaymentsRes
      ] = await Promise.all([
        supabase.from('crops').select('*'),
        supabase.from('v_paddocks').select('*').eq('farm_id', farmId),
        supabase.from('inventory_items').select('*').eq('farm_id', farmId),
        supabase
          .from('activities')
          .select('*, activity_inputs(*)')
          .eq('farm_id', farmId)
          .order('date', { ascending: false }),
        supabase
          .from('chat_messages')
          .select('*')
          .eq('farm_id', farmId)
          .order('created_at', { ascending: true }),
        supabase.from('staff').select('*').eq('farm_id', farmId),
        supabase.from('farm_activity_types').select('*').eq('farm_id', farmId),
        supabase.from('farm_ai_settings').select('*').eq('farm_id', farmId).maybeSingle(),
        supabase.from('farm_users').select('*').eq('farm_id', farmId).eq('user_id', userId).maybeSingle(),
        supabase.from('farm_users').select('*').eq('farm_id', farmId),
        supabase.from('campaigns').select('*').eq('farm_id', farmId),
        // ERP
        supabase.from('chart_of_accounts').select('*').eq('farm_id', farmId),
        supabase.from('cost_centers').select('*').eq('farm_id', farmId),
        supabase.from('financial_transactions').select('*').eq('farm_id', farmId).order('date', { ascending: false }),
        supabase.from('storage_locations').select('*').eq('farm_id', farmId),
        supabase.from('grain_stocks').select('*').eq('farm_id', farmId),
        supabase.from('sales_orders').select('*').eq('farm_id', farmId).order('date', { ascending: false }),
        supabase.from('sales_payments').select('*, sales_orders!inner(farm_id)').eq('sales_orders.farm_id', farmId),
      ]);

      if (cropsRes.error) throw cropsRes.error;
      if (paddocksRes.error) throw paddocksRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (chatRes.error) throw chatRes.error;
      if (staffRes.error) throw staffRes.error;
      if (typesRes.error) throw typesRes.error;

      // 4. Mapeo de datos del esquema SQL al tipado del Frontend (React)
      const mappedFarms = farmsData.map((f: any) => ({
        id: f.id,
        name: f.name,
        totalArea: Number(f.total_area),
        location: 'Pampa Húmeda',
        owner: f.owner_id,
        createdAt: f.created_at,
      }));

      const mappedCrops = (cropsRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        variety: c.type,
        color: c.color,
        plantingDate: null,
        expectedHarvestDate: null,
        cycleLength: 120,
        targetNdvi: Number(c.target_ndvi || 0.5),
        marketPriceUsdTon: c.market_price_usd_ton ? Number(c.market_price_usd_ton) : undefined,
      }));

      const mappedPaddocks = (paddocksRes.data || []).map((p: any) => ({
        id: p.id,
        farmId: p.farm_id,
        name: p.name,
        area: Number(p.area),
        cropId: p.crop_id,
        ndvi: Number(p.ndvi || 0),
        yieldKgHa: p.yield_kg_ha ? Number(p.yield_kg_ha) : null,
        coordinates: p.boundary, // GeoJSON JSONB procesado por la vista SQL
        lastUpdated: p.last_updated,
      }));

      const mappedInventory = (inventoryRes.data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category as InputCategory,
        currentStock: Number(i.current_stock),
        minimumStock: Number(i.minimum_stock),
        unit: i.unit,
        unitCost: Number(i.unit_cost),
        lastRestocked: i.last_restocked || i.created_at,
      }));

      const mappedStaff = (staffRes.data || []).map((s: any) => ({
        id: s.id,
        farmId: s.farm_id,
        firstName: s.first_name,
        lastName: s.last_name,
        role: s.role,
        phone: s.phone,
      }));

      const mappedTypes = (typesRes.data || []).map((t: any) => ({
        id: t.id,
        farmId: t.farm_id,
        name: t.name,
        color: t.color,
        icon: t.icon,
      }));

      const mappedActivities = (activitiesRes.data || []).map((a: any) => {
        const typeMatch = mappedTypes.find((t: any) => t.id === a.activity_type_id);
        const staffMatch = mappedStaff.find((s: any) => s.id === a.staff_id);
        return {
          id: a.id,
          farmId: a.farm_id,
          campaignId: a.campaign_id,
          cropId: a.crop_id,
          paddockId: a.paddock_id,
          activityTypeId: a.activity_type_id,
          type: typeMatch ? typeMatch.name : a.type,
          color: typeMatch ? typeMatch.color : undefined,
          icon: typeMatch ? typeMatch.icon : undefined,
          date: a.date,
          staffId: a.staff_id,
          responsible: staffMatch ? `${staffMatch.firstName} ${staffMatch.lastName}`.trim() : a.responsible,
          notes: a.notes || '',
          rainfallMm: a.rainfall_mm ? Number(a.rainfall_mm) : undefined,
          appliedArea: a.applied_area ? Number(a.applied_area) : undefined,
          serviceCostPerHa: a.service_cost_per_ha ? Number(a.service_cost_per_ha) : undefined,
          createdAt: a.created_at,
          inputsConsumed: (a.activity_inputs || []).map((ai: any) => ({
            inventoryItemId: ai.inventory_item_id,
            quantity: Number(ai.quantity),
            unit: ai.unit,
          })),
        };
      });

      const mappedChat = (chatRes.data || []).map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.created_at,
      }));

      // Determinar rol del usuario
      let userRole: UserRole | null = null;
      if (activeFarm.owner_id === userId) {
        userRole = 'owner';
      } else if (userRoleRes.data) {
        userRole = userRoleRes.data.role as UserRole;
      } else {
        userRole = 'operator';
      }

      // Cargar ajustes de IA desde BD
      const dbSettings = settingsRes.data;
      const customSystemPrompt = dbSettings ? dbSettings.custom_system_prompt : null;
      const customAliases = dbSettings ? dbSettings.custom_aliases : get().customAliases;

      // Mapear miembros de la granja
      const mappedFarmUsers: FarmUser[] = (farmUsersRes.data || []).map((fu: any) => ({
        id: fu.id,
        farmId: fu.farm_id,
        email: fu.email,
        userId: fu.user_id,
        role: fu.role as UserRole,
        createdAt: fu.created_at,
      }));

      // Mapear campañas
      const mappedCampaigns = (campaignsRes.data || []).map((c: any) => ({
        id: c.id,
        farmId: c.farm_id,
        name: c.name,
        startDate: c.start_date,
        endDate: c.end_date,
        isActive: c.is_active,
      }));
      const defaultActiveCampaign = mappedCampaigns.find(c => c.isActive)?.id || null;

      // Mapear ERP
      const mappedChartOfAccounts = (chartOfAccountsRes.data || []).map((a: any) => ({
        id: a.id,
        farmId: a.farm_id,
        code: a.code,
        name: a.name,
        type: a.type,
        createdAt: a.created_at,
      }));

      const mappedCostCenters = (costCentersRes.data || []).map((cc: any) => ({
        id: cc.id,
        farmId: cc.farm_id,
        name: cc.name,
        type: cc.type,
        paddockId: cc.paddock_id,
        createdAt: cc.created_at,
      }));

      const mappedTransactions = (transactionsRes.data || []).map((t: any) => ({
        id: t.id,
        farmId: t.farm_id,
        date: t.date,
        description: t.description,
        accountId: t.account_id,
        costCenterId: t.cost_center_id,
        amount: Number(t.amount),
        type: t.type,
        createdAt: t.created_at,
      }));

      // Mapear Comercialización
      const mappedStorageLocations = (storageLocationsRes.data || []).map((s: any) => ({
        id: s.id,
        farmId: s.farm_id,
        name: s.name,
        type: s.type,
        capacityTons: s.capacity_tons ? Number(s.capacity_tons) : undefined,
        createdAt: s.created_at,
      }));

      const mappedGrainStocks = (grainStocksRes.data || []).map((g: any) => ({
        id: g.id,
        farmId: g.farm_id,
        storageLocationId: g.storage_location_id,
        cropId: g.crop_id,
        currentTons: Number(g.current_tons),
        updatedAt: g.updated_at,
      }));

      const mappedSalesOrders = (salesOrdersRes.data || []).map((o: any) => ({
        id: o.id,
        farmId: o.farm_id,
        date: o.date,
        cropId: o.crop_id,
        storageLocationId: o.storage_location_id,
        tonsSold: Number(o.tons_sold),
        unitPrice: Number(o.unit_price),
        subtotal: Number(o.subtotal),
        taxPercentage: Number(o.tax_percentage),
        freightDeduction: Number(o.freight_deduction),
        netTotal: Number(o.net_total),
        status: o.status,
        createdAt: o.created_at,
      }));

      const mappedSalesPayments = (salesPaymentsRes.data || []).map((p: any) => ({
        id: p.id,
        salesOrderId: p.sales_order_id,
        paymentMethod: p.payment_method,
        amount: Number(p.amount),
        referenceNumber: p.reference_number,
        dueDate: p.due_date,
        perceptionsAmount: Number(p.perceptions_amount),
        createdAt: p.created_at,
      }));

      set({
        farms: mappedFarms,
        campaigns: mappedCampaigns,
        crops: mappedCrops,
        paddocks: mappedPaddocks,
        inventory: mappedInventory,
        activities: mappedActivities,
        staff: mappedStaff.length > 0 ? mappedStaff : mockStaff,
        activityTypes: mappedTypes.length > 0 ? mappedTypes : mockActivityTypes,
        chartOfAccounts: mappedChartOfAccounts,
        costCenters: mappedCostCenters,
        transactions: mappedTransactions,
        storageLocations: mappedStorageLocations,
        grainStocks: mappedGrainStocks,
        salesOrders: mappedSalesOrders,
        salesPayments: mappedSalesPayments,
        chatMessages: mappedChat.length > 0 ? mappedChat : [welcomeMessage],
        currentFarmId: farmId,
        activeCampaignId: defaultActiveCampaign,
        supabaseStatus: 'connected',
        customSystemPrompt,
        customAliases,
        userRole,
        farmUsers: mappedFarmUsers,
      });
    } catch (err: any) {
      console.error('Error al cargar datos desde Supabase:', err);
      // DEBUG para el usuario:
      alert('Error crítico de conexión a Supabase: ' + err.message);
      
      // Fallback a simulación ante errores de red o consulta, cargando datos locales si existen
      const savedPaddocks = localStorage.getItem('agrocopilot_paddocks');
      const savedInventory = localStorage.getItem('agrocopilot_inventory');
      const savedActivities = localStorage.getItem('agrocopilot_activities');
      const savedChat = localStorage.getItem('agrocopilot_chat');

      set({ 
        supabaseStatus: 'disconnected',
        paddocks: savedPaddocks ? JSON.parse(savedPaddocks) : get().paddocks,
        inventory: savedInventory ? JSON.parse(savedInventory) : get().inventory,
        activities: savedActivities ? JSON.parse(savedActivities) : get().activities,
        chatMessages: savedChat ? JSON.parse(savedChat) : get().chatMessages,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    if (!supabase) return { error: new Error('Supabase no está configurado.') };
    return await supabase.auth.signInWithPassword({ email, password });
  },

  signUp: async (email, password) => {
    if (!supabase) return { error: new Error('Supabase no está configurado.') };
    return await supabase.auth.signUp({ email, password });
  },

  signInAnonymously: async () => {
    if (!supabase) return { error: new Error('Supabase no está configurado.') };
    return await supabase.auth.signInAnonymously();
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearLocalStorage();
    set({
      user: null,
      supabaseStatus: isSupabaseConfigured ? 'disconnected' : 'simulated',
      chatMessages: [welcomeMessage],
    });
    // Recarga el estado local simulado
    get().loadInitialData();
  },

  setAuthModalOpen: (isOpen: boolean) => {
    set({ isAuthModalOpen: isOpen });
  },

  setUser: (user: any) => {
    set({ user });
  },

  setPartialAction: (action) => {
    set({ partialAction: action });
  },

  clearChatMessages: () => {
    set({ chatMessages: [welcomeMessage], partialAction: null });
    saveToLocalStorage('agrocopilot_chat', [welcomeMessage]);
  },

  // ─── Lógica de Dominio Centralizada ─────────────────────────────────────────

  addActivity: async (activityData: Omit<Activity, 'id' | 'createdAt'>) => {
    const state = get();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[addActivity] 🟡 INICIO');
    console.log('[addActivity] supabaseStatus:', state.supabaseStatus);
    console.log('[addActivity] supabase client exists:', !!supabase);
    console.log('[addActivity] currentFarmId:', state.currentFarmId);
    console.log('[addActivity] activityData:', JSON.stringify(activityData, null, 2));

    if (state.supabaseStatus !== 'connected' || !supabase) {
      console.log('[addActivity] ⚠️ Usando flujo LOCAL (no conectado a Supabase)');
      // Flujo local simulado
      const newActivity: Activity = {
        ...activityData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };

      set((s) => {
        const updatedActivities = [newActivity, ...s.activities];
        saveToLocalStorage('agrocopilot_activities', updatedActivities);
        return { activities: updatedActivities };
      });

      // Descuento automático local
      if (newActivity.inputsConsumed.length > 0) {
        for (const input of newActivity.inputsConsumed) {
          get().updateInventoryStock(input.inventoryItemId, -input.quantity);
        }
      }
      console.log('[addActivity] ✅ Actividad guardada LOCALMENTE. Total actividades:', get().activities.length);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    // Flujo persistente en Supabase
    console.log('[addActivity] 🟢 Usando flujo SUPABASE');
    try {
      // 1. Insertar actividad principal
      const insertPayload = {
        farm_id: state.currentFarmId,
        campaign_id: state.activeCampaignId || null,
        crop_id: activityData.cropId || null,
        paddock_id: activityData.paddockId,
        activity_type_id: activityData.activityTypeId || null,
        type: activityData.type,
        date: activityData.date,
        staff_id: activityData.staffId || null,
        responsible: activityData.responsible,
        notes: activityData.notes,
        rainfall_mm: activityData.rainfallMm,
        applied_area: activityData.appliedArea,
        service_cost_per_ha: activityData.serviceCostPerHa,
      };
      console.log('[addActivity] INSERT payload:', JSON.stringify(insertPayload, null, 2));

      const { data: actData, error: actError } = await supabase
        .from('activities')
        .insert(insertPayload)
        .select()
        .single();

      console.log('[addActivity] INSERT result - data:', JSON.stringify(actData, null, 2));
      console.log('[addActivity] INSERT result - error:', actError);

      if (actError) throw actError;

      // 2. Insertar insumos consumidos si existen
      if (activityData.inputsConsumed.length > 0) {
        const { error: inputsError } = await supabase
          .from('activity_inputs')
          .insert(
            activityData.inputsConsumed.map((input) => ({
              activity_id: actData.id,
              inventory_item_id: input.inventoryItemId,
              quantity: input.quantity,
              unit: input.unit,
            }))
          );

        if (inputsError) throw inputsError;
      }

      // 3. Re-cargar actividades e inventario (para capturar el ajuste del trigger de base de datos)
      const [inventoryRes, activitiesRes] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('farm_id', state.currentFarmId),
        supabase
          .from('activities')
          .select('*, activity_inputs(*)')
          .eq('farm_id', state.currentFarmId)
          .order('date', { ascending: false }),
      ]);

      if (inventoryRes.error) throw inventoryRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      console.log('[addActivity] RE-SELECT activities count:', activitiesRes.data?.length);
      console.log('[addActivity] RE-SELECT inventory count:', inventoryRes.data?.length);

      // Actualizar estado en React
      const mappedInventory = (inventoryRes.data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category as InputCategory,
        currentStock: Number(i.current_stock),
        minimumStock: Number(i.minimum_stock),
        unit: i.unit,
        unitCost: Number(i.unit_cost),
        lastRestocked: i.last_restocked || i.created_at,
      }));

      const mappedActivities = (activitiesRes.data || []).map((a: any) => {
        const typeMatch = state.activityTypes.find((t: any) => t.id === a.activity_type_id);
        const staffMatch = state.staff.find((s: any) => s.id === a.staff_id);
        return {
          id: a.id,
          farmId: a.farm_id,
          campaignId: a.campaign_id,
          cropId: a.crop_id,
          paddockId: a.paddock_id,
          activityTypeId: a.activity_type_id,
          type: typeMatch ? typeMatch.name : a.type,
          color: typeMatch ? typeMatch.color : undefined,
          icon: typeMatch ? typeMatch.icon : undefined,
          date: a.date,
          staffId: a.staff_id,
          responsible: staffMatch ? `${staffMatch.firstName} ${staffMatch.lastName}`.trim() : a.responsible,
          notes: a.notes || '',
          rainfallMm: a.rainfall_mm ? Number(a.rainfall_mm) : undefined,
          appliedArea: a.applied_area ? Number(a.applied_area) : undefined,
          createdAt: a.created_at,
          inputsConsumed: (a.activity_inputs || []).map((ai: any) => ({
            inventoryItemId: ai.inventory_item_id,
            quantity: Number(ai.quantity),
            unit: ai.unit,
          })),
        };
      });

      set({
        inventory: mappedInventory,
        activities: mappedActivities,
      });
      console.log('[addActivity] ✅ Estado actualizado con Supabase. Total actividades en state:', mappedActivities.length);
      const top5 = [...mappedActivities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
      console.log('[addActivity] Top 5 actividades en el estado ahora mismo:', JSON.stringify(top5.map(a => ({ id: a.id, type: a.type, date: a.date })), null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
      console.error('[addActivity] ❌ Error al registrar actividad en Supabase:', err);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw err;
    }
  },

  addTransaction: async (transactionData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      // Local fallback (simplificado)
      const newTransaction = {
        ...transactionData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ transactions: [newTransaction, ...s.transactions] }));
      return;
    }

    try {
      // 1. Insertar Transacción Principal
      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([{
          farm_id: state.currentFarmId,
          date: transactionData.date,
          description: transactionData.description,
          account_id: transactionData.accountId,
          cost_center_id: transactionData.costCenterId || null,
          amount: transactionData.amount,
          type: transactionData.type,
          receipt_url: transactionData.receiptUrl || null,
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Insertar Ítems y Calcular PPP si hay items
      let finalItems = [];
      if (transactionData.items && transactionData.items.length > 0) {
        const itemsPayload = transactionData.items.map(item => ({
          transaction_id: data.id,
          inventory_item_id: item.inventoryItemId || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
        }));

        const { data: insertedItems, error: itemsError } = await supabase
          .from('transaction_items')
          .insert(itemsPayload)
          .select();

        if (itemsError) throw itemsError;

        finalItems = insertedItems.map(item => ({
          id: item.id,
          transactionId: item.transaction_id,
          inventoryItemId: item.inventory_item_id,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        }));

        // Actualizar Inventario y PPP
        for (const item of transactionData.items) {
          if (item.inventoryItemId) {
            const currentItem = state.inventory.find(i => i.id === item.inventoryItemId);
            if (currentItem) {
              const currentStock = currentItem.currentStock;
              const currentUnitCost = currentItem.unitCost || 0;
              const currentTotalValue = currentStock * currentUnitCost;
              
              const purchasedQuantity = item.quantity;
              const purchasedUnitCost = item.unitPrice;
              const purchasedTotalValue = purchasedQuantity * purchasedUnitCost;
              
              const newTotalStock = currentStock + purchasedQuantity;
              
              // PPP (Precio Promedio Ponderado)
              const newUnitCost = newTotalStock > 0 
                ? (currentTotalValue + purchasedTotalValue) / newTotalStock 
                : purchasedUnitCost;

              await get().updateInventoryItem(currentItem.id, {
                currentStock: newTotalStock,
                unitCost: Number(newUnitCost.toFixed(2)),
                lastRestocked: new Date().toISOString()
              });
            }
          }
        }
      }

      const newTransaction = {
        id: data.id,
        farmId: data.farm_id,
        date: data.date,
        description: data.description,
        accountId: data.account_id,
        costCenterId: data.cost_center_id,
        amount: Number(data.amount),
        type: data.type,
        receiptUrl: data.receipt_url,
        items: finalItems,
        createdAt: data.created_at,
      };

      set((s) => ({ transactions: [newTransaction, ...s.transactions] }));
    } catch (err) {
      console.error('Error adding transaction:', err);
      throw err;
    }
  },

  addChartOfAccount: async (accountData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert([{ farm_id: state.currentFarmId, ...accountData }])
        .select()
        .single();
      if (error) throw error;
      const newAccount = {
        id: data.id,
        farmId: data.farm_id,
        code: data.code,
        name: data.name,
        type: data.type,
        createdAt: data.created_at,
      };
      set((s) => ({ chartOfAccounts: [...s.chartOfAccounts, newAccount] }));
    } catch (err) {
      console.error('Error adding account:', err);
      throw err;
    }
  },

  addCostCenter: async (costCenterData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('cost_centers')
        .insert([{ farm_id: state.currentFarmId, ...costCenterData }])
        .select()
        .single();
      if (error) throw error;
      const newCenter = {
        id: data.id,
        farmId: data.farm_id,
        name: data.name,
        type: data.type,
        paddockId: data.paddock_id,
        createdAt: data.created_at,
      };
      set((s) => ({ costCenters: [...s.costCenters, newCenter] }));
    } catch (err) {
      console.error('Error adding cost center:', err);
      throw err;
    }
  },

  // ============================================================================
  // Comercialización
  // ============================================================================

  addStorageLocation: async (locationData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('storage_locations')
        .insert([{ 
          farm_id: state.currentFarmId, 
          name: locationData.name,
          type: locationData.type,
          capacity_tons: locationData.capacityTons
        }])
        .select()
        .single();
      if (error) throw error;
      const newLoc = {
        id: data.id,
        farmId: data.farm_id,
        name: data.name,
        type: data.type,
        capacityTons: data.capacity_tons ? Number(data.capacity_tons) : undefined,
        createdAt: data.created_at,
      };
      set((s) => ({ storageLocations: [...s.storageLocations, newLoc] }));
    } catch (err) {
      console.error('Error adding storage location:', err);
      throw err;
    }
  },

  updateGrainStock: async (storageLocationId, cropId, tonsDelta) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) return;
    try {
      const existingStock = state.grainStocks.find(s => s.storageLocationId === storageLocationId && s.cropId === cropId);
      let newTons = tonsDelta;
      
      if (existingStock) {
        newTons = existingStock.currentTons + tonsDelta;
        
        const { data, error } = await supabase
          .from('grain_stocks')
          .update({ current_tons: newTons, updated_at: new Date().toISOString() })
          .eq('id', existingStock.id)
          .select()
          .single();
          
        if (error) throw error;
        
        set(s => ({
          grainStocks: s.grainStocks.map(stock => stock.id === existingStock.id ? { ...stock, currentTons: Number(data.current_tons), updatedAt: data.updated_at } : stock)
        }));
      } else {
        const { data, error } = await supabase
          .from('grain_stocks')
          .insert([{ 
            farm_id: state.currentFarmId, 
            storage_location_id: storageLocationId,
            crop_id: cropId,
            current_tons: newTons
          }])
          .select()
          .single();
          
        if (error) throw error;
        
        set(s => ({
          grainStocks: [...s.grainStocks, {
            id: data.id,
            farmId: data.farm_id,
            storageLocationId: data.storage_location_id,
            cropId: data.crop_id,
            currentTons: Number(data.current_tons),
            updatedAt: data.updated_at
          }]
        }));
      }
    } catch (err) {
      console.error('Error updating grain stock:', err);
      throw err;
    }
  },

  addSalesOrder: async (orderData, paymentsData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) return;
    try {
      // 1. Crear Orden de Venta
      const { data: orderResp, error: orderErr } = await supabase
        .from('sales_orders')
        .insert([{
          farm_id: state.currentFarmId,
          date: orderData.date,
          crop_id: orderData.cropId,
          storage_location_id: orderData.storageLocationId,
          tons_sold: orderData.tonsSold,
          unit_price: orderData.unitPrice,
          subtotal: orderData.subtotal,
          tax_percentage: orderData.taxPercentage,
          freight_deduction: orderData.freightDeduction,
          net_total: orderData.netTotal,
          status: 'PENDING'
        }])
        .select()
        .single();
        
      if (orderErr) throw orderErr;

      // 2. Insertar Pagos
      let finalPayments: any[] = [];
      if (paymentsData && paymentsData.length > 0) {
        const paymentsPayload = paymentsData.map(p => ({
          sales_order_id: orderResp.id,
          payment_method: p.paymentMethod,
          amount: p.amount,
          reference_number: p.referenceNumber || null,
          due_date: p.dueDate || null,
          perceptions_amount: p.perceptionsAmount
        }));

        const { data: payResp, error: payErr } = await supabase
          .from('sales_payments')
          .insert(paymentsPayload)
          .select();
          
        if (payErr) throw payErr;
        finalPayments = payResp;
      }

      // 3. Descontar Stock
      if (orderData.storageLocationId) {
        await get().updateGrainStock(orderData.storageLocationId, orderData.cropId, -orderData.tonsSold);
      }

      // 4. Agregar Transacción de Ingreso (REVENUE)
      const revenueAccount = state.chartOfAccounts.find(a => a.type === 'REVENUE');
      if (revenueAccount) {
        await get().addTransaction({
          date: orderData.date,
          description: `Venta de Granos (Liq. #${orderResp.id.substring(0, 8)})`,
          accountId: revenueAccount.id,
          costCenterId: null,
          amount: orderData.netTotal,
          type: 'INCOME',
          items: [{
            id: Math.random().toString(36).substring(2),
            transactionId: '',
            cropId: orderData.cropId,
            description: 'Kilogramos Liquidados',
            quantity: orderData.tonsSold,
            unitPrice: orderData.unitPrice,
            subtotal: orderData.subtotal,
          }]
        });
      }

      // Actualizar estado local
      const newOrder = {
        id: orderResp.id,
        farmId: orderResp.farm_id,
        date: orderResp.date,
        cropId: orderResp.crop_id,
        storageLocationId: orderResp.storage_location_id,
        tonsSold: Number(orderResp.tons_sold),
        unitPrice: Number(orderResp.unit_price),
        subtotal: Number(orderResp.subtotal),
        taxPercentage: Number(orderResp.tax_percentage),
        freightDeduction: Number(orderResp.freight_deduction),
        netTotal: Number(orderResp.net_total),
        status: orderResp.status,
        createdAt: orderResp.created_at,
      };

      const mappedPayments = finalPayments.map(p => ({
        id: p.id,
        salesOrderId: p.sales_order_id,
        paymentMethod: p.payment_method,
        amount: Number(p.amount),
        referenceNumber: p.reference_number,
        dueDate: p.due_date,
        perceptionsAmount: Number(p.perceptions_amount),
        createdAt: p.created_at,
      }));

      set((s) => ({ 
        salesOrders: [newOrder, ...s.salesOrders],
        salesPayments: [...mappedPayments, ...s.salesPayments]
      }));

    } catch (err) {
      console.error('Error adding sales order:', err);
      throw err;
    }
  },

  deleteActivity: async (id: ID) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      // Local fallback: Restore stock manually and delete activity
      const activityToDelete = state.activities.find(a => a.id === id);
      if (activityToDelete && activityToDelete.inputsConsumed.length > 0) {
        for (const input of activityToDelete.inputsConsumed) {
          get().updateInventoryStock(input.inventoryItemId, input.quantity); // restore quantity
        }
      }
      set((s) => {
        const updatedActivities = s.activities.filter((a) => a.id !== id);
        saveToLocalStorage('agrocopilot_activities', updatedActivities);
        return { activities: updatedActivities };
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Re-cargar inventario y actividades para reflejar la restauración del trigger en BD
      const [inventoryRes, activitiesRes] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('farm_id', state.currentFarmId),
        supabase
          .from('activities')
          .select('*, activity_inputs(*)')
          .eq('farm_id', state.currentFarmId)
          .order('date', { ascending: false }),
      ]);

      if (inventoryRes.error) throw inventoryRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      const mappedInventory = (inventoryRes.data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category as InputCategory,
        currentStock: Number(i.current_stock),
        minimumStock: Number(i.minimum_stock),
        unit: i.unit,
        unitCost: Number(i.unit_cost),
        lastRestocked: i.last_restocked || i.created_at,
      }));

      const mappedActivities = (activitiesRes.data || []).map((a: any) => {
        const typeMatch = state.activityTypes.find((t: any) => t.id === a.activity_type_id);
        const staffMatch = state.staff.find((s: any) => s.id === a.staff_id);
        return {
          id: a.id,
          farmId: a.farm_id,
          campaignId: a.campaign_id,
          cropId: a.crop_id,
          paddockId: a.paddock_id,
          activityTypeId: a.activity_type_id,
          type: typeMatch ? typeMatch.name : a.type,
          color: typeMatch ? typeMatch.color : undefined,
          icon: typeMatch ? typeMatch.icon : undefined,
          date: a.date,
          staffId: a.staff_id,
          responsible: staffMatch ? `${staffMatch.firstName} ${staffMatch.lastName}`.trim() : a.responsible,
          notes: a.notes || '',
          rainfallMm: a.rainfall_mm ? Number(a.rainfall_mm) : undefined,
          appliedArea: a.applied_area ? Number(a.applied_area) : undefined,
          createdAt: a.created_at,
          inputsConsumed: (a.activity_inputs || []).map((ai: any) => ({
            inventoryItemId: ai.inventory_item_id,
            quantity: Number(ai.quantity),
            unit: ai.unit,
          })),
        };
      });

      set({
        inventory: mappedInventory,
        activities: mappedActivities,
      });
    } catch (err) {
      console.error('Error al eliminar actividad en Supabase:', err);
      throw err;
    }
  },

  updateActivity: async (id, activityData) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      // Flujo local simulado
      // 1. Revertir stock viejo
      const oldActivity = state.activities.find((a) => a.id === id);
      if (oldActivity && oldActivity.inputsConsumed.length > 0) {
        for (const input of oldActivity.inputsConsumed) {
          get().updateInventoryStock(input.inventoryItemId, input.quantity);
        }
      }

      // 2. Aplicar stock nuevo
      if (activityData.inputsConsumed.length > 0) {
        for (const input of activityData.inputsConsumed) {
          get().updateInventoryStock(input.inventoryItemId, -input.quantity);
        }
      }

      // 3. Actualizar la actividad
      set((s) => {
        const updatedActivities = s.activities.map((a) =>
          a.id === id
            ? {
                ...a,
                ...activityData,
              }
            : a
        );
        saveToLocalStorage('agrocopilot_activities', updatedActivities);
        return { activities: updatedActivities };
      });
      return;
    }

    // Flujo persistente en Supabase
    try {
      // 1. Actualizar actividad principal
      const { error: actError } = await supabase
        .from('activities')
        .update({
          crop_id: activityData.cropId || null,
          paddock_id: activityData.paddockId,
          activity_type_id: activityData.activityTypeId || null,
          type: activityData.type,
          date: activityData.date,
          staff_id: activityData.staffId || null,
          responsible: activityData.responsible,
          notes: activityData.notes,
          rainfall_mm: activityData.rainfallMm,
          applied_area: activityData.appliedArea,
          service_cost_per_ha: activityData.serviceCostPerHa,
        })
        .eq('id', id);

      if (actError) throw actError;

      // 2. Actualizar insumos consumidos.
      // La forma más limpia es eliminar los viejos e insertar los nuevos para disparar los triggers.
      const { error: deleteError } = await supabase
        .from('activity_inputs')
        .delete()
        .eq('activity_id', id);

      if (deleteError) throw deleteError;

      if (activityData.inputsConsumed.length > 0) {
        const { error: inputsError } = await supabase
          .from('activity_inputs')
          .insert(
            activityData.inputsConsumed.map((input) => ({
              activity_id: id,
              inventory_item_id: input.inventoryItemId,
              quantity: input.quantity,
              unit: input.unit,
            }))
          );

        if (inputsError) throw inputsError;
      }

      // 3. Re-cargar actividades e inventario
      const [inventoryRes, activitiesRes] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('farm_id', state.currentFarmId),
        supabase
          .from('activities')
          .select('*, activity_inputs(*)')
          .eq('farm_id', state.currentFarmId)
          .order('date', { ascending: false }),
      ]);

      if (inventoryRes.error) throw inventoryRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      const mappedInventory = (inventoryRes.data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category as InputCategory,
        currentStock: Number(i.current_stock),
        minimumStock: Number(i.minimum_stock),
        unit: i.unit,
        unitCost: Number(i.unit_cost),
        lastRestocked: i.last_restocked || i.created_at,
      }));

      const mappedActivities = (activitiesRes.data || []).map((a: any) => {
        const typeMatch = state.activityTypes.find((t: any) => t.id === a.activity_type_id);
        const staffMatch = state.staff.find((s: any) => s.id === a.staff_id);
        return {
          id: a.id,
          farmId: a.farm_id,
          campaignId: a.campaign_id,
          cropId: a.crop_id,
          paddockId: a.paddock_id,
          activityTypeId: a.activity_type_id,
          type: typeMatch ? typeMatch.name : a.type,
          color: typeMatch ? typeMatch.color : undefined,
          icon: typeMatch ? typeMatch.icon : undefined,
          date: a.date,
          staffId: a.staff_id,
          responsible: staffMatch ? `${staffMatch.firstName} ${staffMatch.lastName}`.trim() : a.responsible,
          notes: a.notes || '',
          rainfallMm: a.rainfall_mm ? Number(a.rainfall_mm) : undefined,
          appliedArea: a.applied_area ? Number(a.applied_area) : undefined,
          createdAt: a.created_at,
          inputsConsumed: (a.activity_inputs || []).map((ai: any) => ({
            inventoryItemId: ai.inventory_item_id,
            quantity: Number(ai.quantity),
            unit: ai.unit,
          })),
        };
      });

      set({
        inventory: mappedInventory,
        activities: mappedActivities,
      });
    } catch (err) {
      console.error('Error al actualizar actividad en Supabase:', err);
      throw err;
    }
  },

  addInventoryItem: async (itemData) => {
    const state = get();
    
    if (state.supabaseStatus !== 'connected' || !supabase) {
      const newItem: InventoryItem = {
        ...itemData,
        id: generateId(),
        lastRestocked: new Date().toISOString()
      };
      set((s) => {
        const updatedInventory = [...s.inventory, newItem];
        saveToLocalStorage('agrocopilot_inventory', updatedInventory);
        return { inventory: updatedInventory };
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          farm_id: state.currentFarmId,
          name: itemData.name,
          category: itemData.category,
          current_stock: itemData.currentStock,
          unit: itemData.unit,
          minimum_stock: itemData.minimumStock,
          unit_cost: itemData.unitCost,
          last_restocked: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const newItem: InventoryItem = {
        id: data.id,
        name: data.name,
        category: data.category as InputCategory,
        currentStock: Number(data.current_stock),
        minimumStock: Number(data.minimum_stock),
        unit: data.unit,
        unitCost: Number(data.unit_cost),
        lastRestocked: data.last_restocked || data.created_at
      };

      set((s) => ({ inventory: [...s.inventory, newItem] }));
    } catch (err) {
      console.error('Error al agregar insumo en Supabase:', err);
      throw err;
    }
  },

  updateInventoryItem: async (id, updates) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updatedInventory = s.inventory.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        );
        saveToLocalStorage('agrocopilot_inventory', updatedInventory);
        return { inventory: updatedInventory };
      });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.currentStock !== undefined) dbUpdates.current_stock = updates.currentStock;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      if (updates.minimumStock !== undefined) dbUpdates.minimum_stock = updates.minimumStock;
      if (updates.unitCost !== undefined) dbUpdates.unit_cost = updates.unitCost;

      const { error } = await supabase
        .from('inventory_items')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        inventory: s.inventory.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));
    } catch (err) {
      console.error('Error al actualizar insumo en Supabase:', err);
      throw err;
    }
  },

  deleteInventoryItem: async (id) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updatedInventory = s.inventory.filter((item) => item.id !== id);
        saveToLocalStorage('agrocopilot_inventory', updatedInventory);
        return { inventory: updatedInventory };
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        inventory: s.inventory.filter((item) => item.id !== id),
      }));
    } catch (err) {
      console.error('Error al eliminar insumo en Supabase:', err);
      throw err;
    }
  },

  updateInventoryStock: async (itemId: ID, quantityDelta: number) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      // Flujo local
      set((s) => {
        const updatedInventory = s.inventory.map((item) =>
          item.id === itemId
            ? {
                ...item,
                currentStock: Math.max(0, item.currentStock + quantityDelta),
                ...(quantityDelta > 0 ? { lastRestocked: new Date().toISOString() } : {}),
              }
            : item
        );
        saveToLocalStorage('agrocopilot_inventory', updatedInventory);
        return { inventory: updatedInventory };
      });
      return;
    }

    // Flujo Supabase
    try {
      const item = state.inventory.find((i) => i.id === itemId);
      if (!item) return;

      const newStock = Math.max(0, item.currentStock + quantityDelta);

      const { error } = await supabase
        .from('inventory_items')
        .update({
          current_stock: newStock,
          ...(quantityDelta > 0 ? { last_restocked: new Date().toISOString() } : {}),
        })
        .eq('id', itemId);

      if (error) throw error;

      set((s) => ({
        inventory: s.inventory.map((i) =>
          i.id === itemId
            ? {
                ...i,
                currentStock: newStock,
                ...(quantityDelta > 0 ? { lastRestocked: new Date().toISOString() } : {}),
              }
            : i
        ),
      }));
    } catch (err) {
      console.error('Error al actualizar inventario en Supabase:', err);
    }
  },

  updatePaddockNDVI: async (paddockId: ID, newNdvi: number) => {
    const state = get();
    const clampedNdvi = Math.max(-1.0, Math.min(1.0, newNdvi));

    if (state.supabaseStatus !== 'connected' || !supabase) {
      // Flujo local
      set((s) => {
        const updatedPaddocks = s.paddocks.map((pad) =>
          pad.id === paddockId
            ? { ...pad, ndvi: clampedNdvi, lastUpdated: new Date().toISOString() }
            : pad
        );
        saveToLocalStorage('agrocopilot_paddocks', updatedPaddocks);
        return { paddocks: updatedPaddocks };
      });
      return;
    }

    // Flujo Supabase
    try {
      const { error } = await supabase
        .from('paddocks')
        .update({
          ndvi: clampedNdvi,
          last_updated: new Date().toISOString(),
        })
        .eq('id', paddockId);

      if (error) throw error;

      set((s) => ({
        paddocks: s.paddocks.map((pad) =>
          pad.id === paddockId
            ? { ...pad, ndvi: clampedNdvi, lastUpdated: new Date().toISOString() }
            : pad
        ),
      }));
    } catch (err) {
      console.error('Error al actualizar NDVI en Supabase:', err);
    }
  },

  addPaddock: async (paddockData) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      const newPaddock: Paddock = {
        ...paddockData,
        id: generateId(),
        area: paddockData.area || 10, // Simulated area
        lastUpdated: new Date().toISOString(),
      };
      set((s) => {
        const updatedPaddocks = [...s.paddocks, newPaddock];
        saveToLocalStorage('agrocopilot_paddocks', updatedPaddocks);
        return { paddocks: updatedPaddocks };
      });
      return;
    }

    try {
      const { error: createError } = await supabase.rpc(
        'fn_create_paddock',
        {
          p_farm_id: state.currentFarmId,
          p_name: paddockData.name,
          p_crop_id: paddockData.cropId || null,
          p_boundary_geojson: paddockData.coordinates || null,
          p_area: paddockData.area || null,
        }
      );

      if (createError) throw createError;

      // Re-fetch to get the automatically calculated area and formatted geojson
      const { data: paddocksRes, error: fetchError } = await supabase
        .from('v_paddocks')
        .select('*')
        .eq('farm_id', state.currentFarmId);

      if (fetchError) throw fetchError;

      const mappedPaddocks = (paddocksRes || []).map((p: any) => ({
        id: p.id,
        farmId: p.farm_id,
        name: p.name,
        area: Number(p.area),
        cropId: p.crop_id,
        ndvi: Number(p.ndvi || 0),
        yieldKgHa: p.yield_kg_ha ? Number(p.yield_kg_ha) : null,
        coordinates: p.boundary,
        lastUpdated: p.last_updated,
      }));

      set({ paddocks: mappedPaddocks });
    } catch (err) {
      console.error('Error al agregar lote en Supabase:', err);
      throw err;
    }
  },

  updatePaddock: async (id, updates) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updatedPaddocks = s.paddocks.map((pad) =>
          pad.id === id ? { ...pad, ...updates, lastUpdated: new Date().toISOString() } : pad
        );
        saveToLocalStorage('agrocopilot_paddocks', updatedPaddocks);
        return { paddocks: updatedPaddocks };
      });
      return;
    }

    try {
      const dbUpdates: any = {
        last_updated: new Date().toISOString(),
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.cropId !== undefined) dbUpdates.crop_id = updates.cropId;
      if (updates.ndvi !== undefined) dbUpdates.ndvi = updates.ndvi;
      if (updates.area !== undefined) dbUpdates.area = updates.area;

      const { error } = await supabase
        .from('paddocks')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        paddocks: s.paddocks.map((pad) =>
          pad.id === id ? { ...pad, ...updates, lastUpdated: new Date().toISOString() } : pad
        ),
      }));
    } catch (err) {
      console.error('Error al actualizar lote en Supabase:', err);
      throw err;
    }
  },

  deletePaddock: async (id) => {
    const state = get();

    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updatedPaddocks = s.paddocks.filter((pad) => pad.id !== id);
        saveToLocalStorage('agrocopilot_paddocks', updatedPaddocks);
        return { paddocks: updatedPaddocks };
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('paddocks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        paddocks: s.paddocks.filter((pad) => pad.id !== id),
      }));
    } catch (err) {
      console.error('Error al eliminar lote en Supabase:', err);
      throw err;
    }
  },

  // ─── Navegación y UI ───────────────────────────────────────────────

  setCurrentFarm: (id: ID) => {
    set({ currentFarmId: id });
  },

  setActiveCampaign: (id: ID | null) => {
    set({ activeCampaignId: id });
  },

  setCurrentView: (view: AppView) => {
    set({ currentView: view });
  },

  toggleSidebar: () => {
    set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed }));
  },

  toggleCopilot: () => {
    set((s) => ({ isCopilotOpen: !s.isCopilotOpen }));
  },

  // ─── Chat ──────────────────────────────────────────────────────────

  addChatMessage: async (messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const state = get();

    const localMessage: ChatMessage = {
      ...messageData,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    // Agregar mensaje a la UI inmediatamente para fluidez reactiva
    set((s) => {
      const updatedChat = [...s.chatMessages, localMessage];
      saveToLocalStorage('agrocopilot_chat', updatedChat);
      return { chatMessages: updatedChat };
    });

    if (state.supabaseStatus !== 'connected' || !supabase) return;

    // Persistir mensaje en Supabase
    try {
      await supabase.from('chat_messages').insert({
        farm_id: state.currentFarmId,
        user_id: state.user?.id,
        role: messageData.role,
        content: messageData.content,
      });
    } catch (err) {
      console.error('Error al persistir mensaje de chat:', err);
    }
  },

  setMessageProcessing: (messageId: ID, isProcessing: boolean) => {
    set((s) => ({
      chatMessages: s.chatMessages.map((msg) =>
        msg.id === messageId ? { ...msg, isProcessing } : msg
      ),
    }));
  },

  // ─── Staff & Activity Types ────────

  addStaff: async (staffData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      const newItem = { ...staffData, id: generateId(), farmId: state.currentFarmId };
      set((s) => ({ staff: [...s.staff, newItem] }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({
          farm_id: state.currentFarmId,
          first_name: staffData.firstName,
          last_name: staffData.lastName,
          role: staffData.role,
          phone: staffData.phone,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      const newStaff: StaffMember = {
        id: data.id,
        farmId: data.farm_id,
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
        phone: data.phone,
      };
      
      set((s) => ({ staff: [...s.staff, newStaff] }));
    } catch (err) {
      console.error('Error adding staff:', err);
      throw err;
    }
  },

  updateStaff: async (id, updates) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => ({
        staff: s.staff.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

      const { error } = await supabase
        .from('staff')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        staff: s.staff.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    } catch (err) {
      console.error('Error updating staff:', err);
      throw err;
    }
  },

  deleteStaff: async (id) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => ({ staff: s.staff.filter((i) => i.id !== id) }));
      return;
    }

    try {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      set((s) => ({ staff: s.staff.filter((i) => i.id !== id) }));
    } catch (err) {
      console.error('Error deleting staff:', err);
      throw err;
    }
  },

  addActivityType: async (typeData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      const newItem = { ...typeData, id: generateId(), farmId: state.currentFarmId };
      set((s) => ({ activityTypes: [...s.activityTypes, newItem] }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('farm_activity_types')
        .insert({
          farm_id: state.currentFarmId,
          name: typeData.name,
          color: typeData.color,
          icon: typeData.icon,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      const newType: FarmActivityType = {
        id: data.id,
        farmId: data.farm_id,
        name: data.name,
        color: data.color,
        icon: data.icon,
      };
      
      set((s) => ({ activityTypes: [...s.activityTypes, newType] }));
    } catch (err) {
      console.error('Error adding activity type:', err);
      throw err;
    }
  },

  updateActivityType: async (id, updates) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => ({
        activityTypes: s.activityTypes.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;

      const { error } = await supabase
        .from('farm_activity_types')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        activityTypes: s.activityTypes.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    } catch (err) {
      console.error('Error updating activity type:', err);
      throw err;
    }
  },

  deleteActivityType: async (id) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => ({ activityTypes: s.activityTypes.filter((i) => i.id !== id) }));
      return;
    }

    try {
      const { error } = await supabase.from('farm_activity_types').delete().eq('id', id);
      if (error) throw error;
      set((s) => ({ activityTypes: s.activityTypes.filter((i) => i.id !== id) }));
    } catch (err) {
      console.error('Error deleting activity type:', err);
      throw err;
    }
  },

  updateSystemPrompt: async (prompt) => {
    const state = get();
    set({ customSystemPrompt: prompt });
    
    if (state.supabaseStatus === 'connected' && supabase) {
      try {
        const { error } = await supabase
          .from('farm_ai_settings')
          .upsert({
            farm_id: state.currentFarmId,
            custom_system_prompt: prompt,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      } catch (err) {
        console.error('Error updating system prompt in Supabase:', err);
        throw err;
      }
    } else {
      if (prompt === null) {
        localStorage.removeItem('agrocopilot_custom_prompt');
      } else {
        localStorage.setItem('agrocopilot_custom_prompt', prompt);
      }
    }
  },

  updateAliases: async (aliases) => {
    const state = get();
    set({ customAliases: aliases });
    
    if (state.supabaseStatus === 'connected' && supabase) {
      try {
        const { error } = await supabase
          .from('farm_ai_settings')
          .upsert({
            farm_id: state.currentFarmId,
            custom_aliases: aliases,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      } catch (err) {
        console.error('Error updating custom aliases in Supabase:', err);
        throw err;
      }
    } else {
      localStorage.setItem('agrocopilot_custom_aliases', JSON.stringify(aliases));
    }
  },

  loadFarmUsers: async () => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('farm_users')
        .select('*')
        .eq('farm_id', state.currentFarmId);
      if (error) throw error;
      
      const mappedUsers: FarmUser[] = (data || []).map((fu: any) => ({
        id: fu.id,
        farmId: fu.farm_id,
        email: fu.email,
        userId: fu.user_id,
        role: fu.role as UserRole,
        createdAt: fu.created_at,
      }));
      set({ farmUsers: mappedUsers });
    } catch (err) {
      console.error('Error loading farm users:', err);
    }
  },

  addFarmUser: async (email, role) => {
    const state = get();
    const newEmail = email.trim().toLowerCase();
    
    if (state.supabaseStatus !== 'connected' || !supabase) {
      const newPermission: FarmUser = {
        id: generateId(),
        farmId: state.currentFarmId,
        email: newEmail,
        userId: null,
        role,
        createdAt: new Date().toISOString(),
      };
      set((s) => {
        const updated = [...s.farmUsers, newPermission];
        saveToLocalStorage('agrocopilot_farm_users', updated);
        return { farmUsers: updated };
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('farm_users')
        .insert({
          farm_id: state.currentFarmId,
          email: newEmail,
          role,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newMember: FarmUser = {
        id: data.id,
        farmId: data.farm_id,
        email: data.email,
        userId: data.user_id,
        role: data.role as UserRole,
        createdAt: data.created_at,
      };
      set((s) => ({ farmUsers: [...s.farmUsers, newMember] }));
    } catch (err) {
      console.error('Error adding farm user:', err);
      throw err;
    }
  },

  updateFarmUser: async (id, role) => {
    const state = get();
    
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updated = s.farmUsers.map((fu) => (fu.id === id ? { ...fu, role } : fu));
        saveToLocalStorage('agrocopilot_farm_users', updated);
        return { farmUsers: updated };
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('farm_users')
        .update({ role })
        .eq('id', id);

      if (error) throw error;
      set((s) => ({
        farmUsers: s.farmUsers.map((fu) => (fu.id === id ? { ...fu, role } : fu)),
      }));
    } catch (err) {
      console.error('Error updating farm user role:', err);
      throw err;
    }
  },

  deleteFarmUser: async (id) => {
    const state = get();
    
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updated = s.farmUsers.filter((fu) => fu.id !== id);
        saveToLocalStorage('agrocopilot_farm_users', updated);
        return { farmUsers: updated };
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('farm_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      set((s) => ({
        farmUsers: s.farmUsers.filter((fu) => fu.id !== id),
      }));
    } catch (err) {
      console.error('Error deleting farm user:', err);
      throw err;
    }
  },

  addCrop: async (cropData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      const newCrop: Crop = {
        id: generateId(),
        ...cropData,
      };
      set((s) => {
        const updated = [...s.crops, newCrop];
        saveToLocalStorage('agrocopilot_crops', updated);
        return { crops: updated };
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('crops')
        .insert({
          name: cropData.name,
          type: cropData.variety,
          color: cropData.color,
          target_ndvi: cropData.targetNdvi,
          market_price_usd_ton: cropData.marketPriceUsdTon,
        })
        .select()
        .single();

      if (error) throw error;

      const newCrop: Crop = {
        id: data.id,
        name: data.name,
        variety: data.type,
        color: data.color,
        plantingDate: null,
        expectedHarvestDate: null,
        cycleLength: 120,
        targetNdvi: Number(data.target_ndvi || 0.5),
        marketPriceUsdTon: data.market_price_usd_ton ? Number(data.market_price_usd_ton) : undefined,
      };

      set((s) => ({ crops: [...s.crops, newCrop] }));
    } catch (err) {
      console.error('Error adding crop:', err);
      throw err;
    }
  },

  updateCrop: async (id, cropData) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updated = s.crops.map((c) => (c.id === id ? { ...c, ...cropData } : c));
        saveToLocalStorage('agrocopilot_crops', updated);
        return { crops: updated };
      });
      return;
    }

    try {
      const updatePayload: any = {};
      if (cropData.name !== undefined) updatePayload.name = cropData.name;
      if (cropData.variety !== undefined) updatePayload.type = cropData.variety;
      if (cropData.color !== undefined) updatePayload.color = cropData.color;
      if (cropData.targetNdvi !== undefined) updatePayload.target_ndvi = cropData.targetNdvi;
      if (cropData.marketPriceUsdTon !== undefined) updatePayload.market_price_usd_ton = cropData.marketPriceUsdTon;

      const { error } = await supabase
        .from('crops')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        crops: s.crops.map((c) => (c.id === id ? { ...c, ...cropData } : c)),
      }));
    } catch (err) {
      console.error('Error updating crop:', err);
      throw err;
    }
  },

  assignCropToPaddock: async (paddockId: ID, cropId: ID) => {
    const state = get();
    if (!state.activeCampaignId) return;

    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updatedPaddocks = s.paddocks.map((pad) =>
          pad.id === paddockId
            ? { ...pad, cropId, lastUpdated: new Date().toISOString() }
            : pad
        );
        saveToLocalStorage('agrocopilot_paddocks', updatedPaddocks);
        return { paddocks: updatedPaddocks };
      });
      return;
    }

    try {
      const { error } = await supabase.rpc('set_paddock_campaign_crop', {
        p_paddock_id: paddockId,
        p_campaign_id: state.activeCampaignId,
        p_crop_id: cropId,
      });

      if (error) throw error;

      set((s) => ({
        paddocks: s.paddocks.map((pad) =>
          pad.id === paddockId
            ? { ...pad, cropId, lastUpdated: new Date().toISOString() }
            : pad
        ),
      }));
    } catch (err) {
      console.error('Error assigning crop to paddock:', err);
      throw err;
    }
  },

  recordPaddockYield: async (paddockId: ID, yieldKgHa: number) => {
    const state = get();
    if (!state.activeCampaignId) return;

    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updatedPaddocks = s.paddocks.map((pad) =>
          pad.id === paddockId
            ? { ...pad, yieldKgHa, lastUpdated: new Date().toISOString() }
            : pad
        );
        saveToLocalStorage('agrocopilot_paddocks', updatedPaddocks);
        return { paddocks: updatedPaddocks };
      });
      return;
    }

    try {
      const { error } = await supabase.rpc('set_paddock_campaign_yield', {
        p_paddock_id: paddockId,
        p_campaign_id: state.activeCampaignId,
        p_yield_kg_ha: yieldKgHa,
      });

      if (error) throw error;

      set((s) => ({
        paddocks: s.paddocks.map((pad) =>
          pad.id === paddockId
            ? { ...pad, yieldKgHa, lastUpdated: new Date().toISOString() }
            : pad
        ),
      }));
    } catch (err) {
      console.error('Error recording paddock yield:', err);
      throw err;
    }
  },

  deleteCrop: async (id) => {
    const state = get();
    if (state.supabaseStatus !== 'connected' || !supabase) {
      set((s) => {
        const updated = s.crops.filter((c) => c.id !== id);
        saveToLocalStorage('agrocopilot_crops', updated);
        return { crops: updated };
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('crops')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        crops: s.crops.filter((c) => c.id !== id),
      }));
    } catch (err) {
      console.error('Error deleting crop:', err);
      throw err;
    }
  },
}));
