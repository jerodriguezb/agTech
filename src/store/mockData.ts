import type { Farm, Paddock, Crop, InventoryItem, Activity, StaffMember, FarmActivityType } from '../types';

// ============================================================================
// FARM — Estancia Las Pampas
// Ubicación: Pampa Húmeda, cercanías de Junín, Prov. Buenos Aires
// Centro aproximado: -34.59°S, -60.96°W
// ============================================================================

export const mockFarm: Farm = {
  id: 'farm-001',
  name: 'Estancia Las Pampas',
  totalArea: 1250,
  location: 'Partido de Junín, Buenos Aires, Argentina',
  owner: 'Agrícola Las Pampas S.A.',
  createdAt: '2024-01-15T10:00:00.000Z',
};

// ============================================================================
// CROPS — Cultivos activos con colores HEX para renderizado cartográfico
// ============================================================================

export const mockCrops: Crop[] = [
  {
    id: 'crop-soja',
    name: 'Soja',
    variety: 'DM 40R16 STS',
    color: '#2E7D32', // Verde oscuro
    plantingDate: '2025-11-10T00:00:00.000Z',
    expectedHarvestDate: '2026-04-15T00:00:00.000Z',
    cycleLength: 155,
  },
  {
    id: 'crop-maiz',
    name: 'Maíz',
    variety: 'DK 7210 VT3P',
    color: '#F59E0B', // Ámbar dorado
    plantingDate: '2025-09-20T00:00:00.000Z',
    expectedHarvestDate: '2026-03-01T00:00:00.000Z',
    cycleLength: 160,
  },
  {
    id: 'crop-trigo',
    name: 'Trigo',
    variety: 'Baguette 620',
    color: '#D97706', // Naranja trigo
    plantingDate: '2026-06-01T00:00:00.000Z',
    expectedHarvestDate: '2026-12-15T00:00:00.000Z',
    cycleLength: 195,
  },
  {
    id: 'crop-girasol',
    name: 'Girasol',
    variety: 'Paraíso 1000 CL Plus',
    color: '#7C3AED', // Violeta
    plantingDate: '2025-10-15T00:00:00.000Z',
    expectedHarvestDate: '2026-03-20T00:00:00.000Z',
    cycleLength: 155,
  },
];

// ============================================================================
// PADDOCKS — Lotes con polígonos GeoJSON reales (Pampa Húmeda)
// Coordenadas en formato [longitud, latitud] conforme a RFC 7946
// ============================================================================

export const mockPaddocks: Paddock[] = [
  {
    id: 'pad-norte',
    farmId: 'farm-001',
    name: 'Lote Norte',
    area: 280,
    cropId: 'crop-soja',
    ndvi: 0.82,
    soilType: 'Argiudol típico',
    lastUpdated: '2026-06-15T14:30:00.000Z',
    coordinates: {
      type: 'Polygon',
      coordinates: [
        [
          [-60.985, -34.545],
          [-60.940, -34.545],
          [-60.935, -34.550],
          [-60.935, -34.570],
          [-60.945, -34.575],
          [-60.985, -34.575],
          [-60.990, -34.560],
          [-60.985, -34.545],
        ],
      ],
    },
  },
  {
    id: 'pad-sur',
    farmId: 'farm-001',
    name: 'Lote Sur',
    area: 220,
    cropId: 'crop-maiz',
    ndvi: 0.45,
    soilType: 'Hapludol éntico',
    lastUpdated: '2026-06-14T09:15:00.000Z',
    coordinates: {
      type: 'Polygon',
      coordinates: [
        [
          [-60.985, -34.610],
          [-60.940, -34.608],
          [-60.935, -34.615],
          [-60.935, -34.635],
          [-60.950, -34.640],
          [-60.985, -34.638],
          [-60.990, -34.625],
          [-60.985, -34.610],
        ],
      ],
    },
  },
  {
    id: 'pad-este',
    farmId: 'farm-001',
    name: 'Lote Este',
    area: 195,
    cropId: 'crop-trigo',
    ndvi: 0.15,
    soilType: 'Argiudol típico',
    lastUpdated: '2026-06-13T16:45:00.000Z',
    coordinates: {
      type: 'Polygon',
      coordinates: [
        [
          [-60.925, -34.578],
          [-60.895, -34.575],
          [-60.888, -34.582],
          [-60.890, -34.605],
          [-60.900, -34.610],
          [-60.925, -34.608],
          [-60.930, -34.595],
          [-60.925, -34.578],
        ],
      ],
    },
  },
  {
    id: 'pad-oeste',
    farmId: 'farm-001',
    name: 'Lote Oeste',
    area: 310,
    cropId: 'crop-girasol',
    ndvi: 0.68,
    soilType: 'Hapludol thapto árgico',
    lastUpdated: '2026-06-12T11:00:00.000Z',
    coordinates: {
      type: 'Polygon',
      coordinates: [
        [
          [-61.045, -34.575],
          [-61.000, -34.573],
          [-60.995, -34.580],
          [-60.995, -34.605],
          [-61.005, -34.612],
          [-61.045, -34.610],
          [-61.050, -34.595],
          [-61.045, -34.575],
        ],
      ],
    },
  },
  {
    id: 'pad-central',
    farmId: 'farm-001',
    name: 'Potrero Central',
    area: 145,
    cropId: null,
    ndvi: 0.30,
    soilType: 'Natracuol típico',
    lastUpdated: '2026-06-10T08:20:00.000Z',
    coordinates: {
      type: 'Polygon',
      coordinates: [
        [
          [-60.975, -34.578],
          [-60.940, -34.578],
          [-60.935, -34.585],
          [-60.938, -34.605],
          [-60.950, -34.608],
          [-60.975, -34.607],
          [-60.980, -34.592],
          [-60.975, -34.578],
        ],
      ],
    },
  },
];

// ============================================================================
// INVENTORY — Pañol de insumos con niveles de stock
// ============================================================================

export const mockInventory: InventoryItem[] = [
  {
    id: 'inv-uan32',
    name: 'Fertilizante UAN 32%',
    category: 'Agricola',
    currentStock: 4500,
    unit: 'litros',
    minimumStock: 2000,
    unitCost: 0.85,
    lastRestocked: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'inv-glifosato',
    name: 'Glifosato 66.2%',
    category: 'Agricola',
    currentStock: 350,
    unit: 'litros',
    minimumStock: 500,
    unitCost: 6.2,
    lastRestocked: '2026-04-10T00:00:00.000Z',
  },
  {
    id: 'inv-semilla-maiz',
    name: 'Semilla Híbrida Maíz DK72',
    category: 'Agricola',
    currentStock: 120,
    unit: 'bolsas',
    minimumStock: 50,
    unitCost: 280,
    lastRestocked: '2026-03-15T00:00:00.000Z',
  },
  {
    id: 'inv-urea',
    name: 'Urea Granulada 46-0-0',
    category: 'Agricola',
    currentStock: 8200,
    unit: 'kg',
    minimumStock: 3000,
    unitCost: 0.52,
    lastRestocked: '2026-05-05T00:00:00.000Z',
  },
  {
    id: 'inv-24d',
    name: '2,4-D Éster 100%',
    category: 'Agricola',
    currentStock: 80,
    unit: 'litros',
    minimumStock: 100,
    unitCost: 9.5,
    lastRestocked: '2026-02-28T00:00:00.000Z',
  },
  {
    id: 'inv-semilla-soja',
    name: 'Semilla Soja DM40R16',
    category: 'Agricola',
    currentStock: 200,
    unit: 'bolsas',
    minimumStock: 80,
    unitCost: 95,
    lastRestocked: '2026-04-20T00:00:00.000Z',
  },
  {
    id: 'inv-gasoil',
    name: 'Gasoil Grado 3',
    category: 'Estructura',
    currentStock: 3500,
    unit: 'litros',
    minimumStock: 1500,
    unitCost: 1.1,
    lastRestocked: '2026-06-01T00:00:00.000Z',
  },
];

// ============================================================================
// ACTIVITIES — Historial de operaciones de campo
// ============================================================================

export const mockActivities: Activity[] = [
  {
    id: 'act-001',
    farmId: 'farm-001',
    paddockId: 'pad-norte',
    type: 'Pulverizacion',
    date: '2026-06-10T07:30:00.000Z',
    responsible: 'Carlos Mendoza',
    inputsConsumed: [
      { inventoryItemId: 'inv-glifosato', quantity: 120, unit: 'litros' },
      { inventoryItemId: 'inv-24d', quantity: 15, unit: 'litros' },
    ],
    notes: 'Aplicación de barbecho químico pre-siembra. Condiciones: viento 8 km/h SO, Temp 22°C, HR 65%.',
    createdAt: '2026-06-10T07:30:00.000Z',
  },
  {
    id: 'act-002',
    farmId: 'farm-001',
    paddockId: 'pad-sur',
    type: 'Fertilizacion',
    date: '2026-06-08T09:00:00.000Z',
    responsible: 'Martín Suárez',
    inputsConsumed: [
      { inventoryItemId: 'inv-urea', quantity: 2200, unit: 'kg' },
    ],
    notes: 'Fertilización nitrogenada en cobertura V6 maíz. Dosis: 100 kg/ha.',
    createdAt: '2026-06-08T09:00:00.000Z',
  },
  {
    id: 'act-003',
    farmId: 'farm-001',
    paddockId: null,
    type: 'Lluvia',
    date: '2026-06-05T15:00:00.000Z',
    responsible: 'Sistema automático',
    inputsConsumed: [],
    notes: 'Evento de precipitaciones generalizado sobre el establecimiento.',
    rainfallMm: 35,
    createdAt: '2026-06-05T15:00:00.000Z',
  },
  {
    id: 'act-004',
    farmId: 'farm-001',
    paddockId: 'pad-este',
    type: 'Siembra',
    date: '2026-06-01T06:00:00.000Z',
    responsible: 'Carlos Mendoza',
    inputsConsumed: [
      { inventoryItemId: 'inv-semilla-soja', quantity: 45, unit: 'bolsas' },
    ],
    notes: 'Siembra directa de trigo sobre rastrojo de soja. Densidad: 130 kg/ha.',
    createdAt: '2026-06-01T06:00:00.000Z',
  },
  {
    id: 'act-005',
    farmId: 'farm-001',
    paddockId: 'pad-oeste',
    type: 'Riego',
    date: '2026-05-28T10:00:00.000Z',
    responsible: 'Martín Suárez',
    inputsConsumed: [],
    notes: 'Riego suplementario pivot central. Lámina aplicada: 25 mm.',
    createdAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: 'act-006',
    farmId: 'farm-001',
    paddockId: null,
    type: 'Lluvia',
    date: '2026-06-12T18:00:00.000Z',
    responsible: 'Sistema automático',
    inputsConsumed: [],
    notes: 'Lluvia frontal con actividad eléctrica moderada.',
    rainfallMm: 18,
    createdAt: '2026-06-12T18:00:00.000Z',
  },
];

// ============================================================================
// STAFF & ACTIVITY TYPES
// ============================================================================

export const mockStaff: StaffMember[] = [
  { id: 'staff-1', farmId: 'farm-001', firstName: 'Carlos', lastName: 'Mendoza', role: 'Encargado', phone: '341-555-0101' },
  { id: 'staff-2', farmId: 'farm-001', firstName: 'Martín', lastName: 'Suárez', role: 'Tractorista', phone: '341-555-0102' },
  { id: 'staff-3', farmId: 'farm-001', firstName: 'Roberto', lastName: 'García', role: 'Ingeniero Agrónomo', phone: '341-555-0103' },
];

export const mockActivityTypes: FarmActivityType[] = [
  { id: 'type-1', farmId: 'farm-001', name: 'Siembra', color: '#10B981', icon: 'Sprout' },
  { id: 'type-2', farmId: 'farm-001', name: 'Cosecha', color: '#F59E0B', icon: 'Tractor' },
  { id: 'type-3', farmId: 'farm-001', name: 'Pulverización', color: '#6366F1', icon: 'Droplets' },
  { id: 'type-4', farmId: 'farm-001', name: 'Fertilización', color: '#8B5CF6', icon: 'Beaker' },
  { id: 'type-5', farmId: 'farm-001', name: 'Riego', color: '#3B82F6', icon: 'Waves' },
  { id: 'type-6', farmId: 'farm-001', name: 'Lluvia', color: '#0EA5E9', icon: 'CloudRain' },
];
