import { useMemo, useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  Sprout,
  CloudRain,
  AlertTriangle,
  Activity as ActivityIcon,
  Droplets,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { parseISO, isThisMonth } from 'date-fns';
import { useAgriStore } from '../store/useAgriStore';
import PaddockManagerModal from '../components/paddock/PaddockManagerModal';
import type { Activity, Paddock, Crop } from '../types';
import {
  cn,
  formatNumber,
  formatHectares,
  formatDate,
  ndviToColor,
  ndviLabel,
} from '../lib/utils';

// ─── Activity-type badge colors ──────────────────────────────────────────────
const activityBadge: Record<Activity['type'], string> = {
  Siembra: 'bg-emerald-100 text-emerald-700',
  Cosecha: 'bg-amber-100 text-amber-700',
  Pulverizacion: 'bg-rose-100 text-rose-700',
  Fertilizacion: 'bg-sky-100 text-sky-700',
  Riego: 'bg-blue-100 text-blue-700',
  Lluvia: 'bg-indigo-100 text-indigo-700',
};

// ─── Custom PieChart tooltip ─────────────────────────────────────────────────
interface CropSlice {
  name: string;
  value: number;
  color: string;
}

function CropTooltip({
  active,
  payload,
  totalArea,
}: {
  active?: boolean;
  payload?: { payload: CropSlice }[];
  totalArea: number;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const { name, value, color } = data;
  const pct = totalArea > 0 ? ((value / totalArea) * 100).toFixed(1) : '0';
  return (
    <div className="rounded-xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold text-gray-800">{name}</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {formatHectares(value)} — {pct}%
      </p>
    </div>
  );
}

// ─── Custom Legend ────────────────────────────────────────────────────────────
function CropLegend({ payload }: { payload?: { value: string; color: string }[] }) {
  if (!payload) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

// ─── Center label rendered inside the doughnut ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-800 text-2xl font-bold"
        style={{ fontSize: 22, fontWeight: 700 }}
      >
        {formatNumber(total)}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-400 text-xs"
        style={{ fontSize: 12 }}
      >
        ha totales
      </text>
    </g>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DashboardView() {
  const paddocks = useAgriStore((s) => s.paddocks);
  const crops = useAgriStore((s) => s.crops);
  const inventory = useAgriStore((s) => s.inventory);
  const activities = useAgriStore((s) => s.activities);

  // Staggered card mount animation
  const [visible, setVisible] = useState(false);
  const [isPaddockManagerOpen, setIsPaddockManagerOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── KPI derivations ─────────────────────────────────────────────────────
  const coveredArea = useMemo(
    () => paddocks.filter((p) => p.cropId !== null).reduce((s, p) => s + p.area, 0),
    [paddocks],
  );

  const monthlyRainfall = useMemo(
    () =>
      activities
        .filter((a) => a.type === 'Lluvia' && isThisMonth(parseISO(a.date)))
        .reduce((s, a) => s + (a.rainfallMm ?? 0), 0),
    [activities],
  );

  const inventoryAlerts = useMemo(
    () => inventory.filter((i) => i.currentStock < i.minimumStock).length,
    [inventory],
  );

  const monthlyActivities = useMemo(
    () => activities.filter((a) => isThisMonth(parseISO(a.date))).length,
    [activities],
  );

  // ── Crop-area distribution for doughnut ─────────────────────────────────
  const { cropSlices, totalArea } = useMemo(() => {
    const cropMap = new Map<string, { name: string; area: number; color: string }>();

    for (const crop of crops) {
      cropMap.set(crop.id, { name: crop.name, area: 0, color: crop.color });
    }

    let unassigned = 0;
    let total = 0;

    for (const p of paddocks) {
      total += p.area;
      if (p.cropId && cropMap.has(p.cropId)) {
        cropMap.get(p.cropId)!.area += p.area;
      } else {
        unassigned += p.area;
      }
    }

    const slices: CropSlice[] = [];
    for (const entry of cropMap.values()) {
      if (entry.area > 0) slices.push({ name: entry.name, value: entry.area, color: entry.color });
    }
    if (unassigned > 0) {
      slices.push({ name: 'Sin Asignar', value: unassigned, color: '#94A3B8' });
    }

    return { cropSlices: slices, totalArea: total };
  }, [paddocks, crops]);

  // ── Costs and Income by Crop (Gross Margin indicator) ───────────────────
  const { costsByCrop, totalCosts, totalIncome } = useMemo(() => {
    const cropMap = new Map<string, { name: string; cost: number; income: number; color: string }>();

    for (const crop of crops) {
      cropMap.set(crop.id, { name: crop.name, cost: 0, income: 0, color: crop.color });
    }

    const inventoryMap = new Map(inventory.map((i) => [i.id, i]));
    let generalCost = 0;
    let totalC = 0;
    let totalI = 0;

    // 1. Calcular Costos (Insumos + Servicios)
    for (const activity of activities) {
      let activityCost = 0;
      
      // Costo de insumos
      for (const input of activity.inputsConsumed) {
        const item = inventoryMap.get(input.inventoryItemId);
        if (item) {
          activityCost += input.quantity * item.unitCost;
        }
      }
      
      // Costo de labor (servicio)
      if (activity.serviceCostPerHa && activity.appliedArea) {
        activityCost += activity.serviceCostPerHa * activity.appliedArea;
      }

      if (activityCost > 0) {
        totalC += activityCost;
        if (activity.cropId && cropMap.has(activity.cropId)) {
          cropMap.get(activity.cropId)!.cost += activityCost;
        } else {
          generalCost += activityCost;
        }
      }
    }

    // 2. Calcular Ingresos (Rinde * Area * Precio / 1000)
    for (const paddock of paddocks) {
      if (paddock.cropId && paddock.yieldKgHa && cropMap.has(paddock.cropId)) {
        const crop = crops.find(c => c.id === paddock.cropId);
        if (crop && crop.marketPriceUsdTon) {
          const paddockIncome = paddock.area * paddock.yieldKgHa * (crop.marketPriceUsdTon / 1000);
          cropMap.get(paddock.cropId)!.income += paddockIncome;
          totalI += paddockIncome;
        }
      }
    }

    const slices = [];
    for (const entry of cropMap.values()) {
      if (entry.cost > 0 || entry.income > 0) {
        slices.push({ 
          name: entry.name, 
          value: entry.cost, // Para la torta mostramos el costo
          income: entry.income,
          margin: entry.income - entry.cost,
          color: entry.color 
        });
      }
    }
    if (generalCost > 0) {
      slices.push({ name: 'Costos Generales', value: generalCost, income: 0, margin: -generalCost, color: '#94A3B8' });
    }

    slices.sort((a, b) => b.value - a.value);

    return { costsByCrop: slices, totalCosts: totalC, totalIncome: totalI };
  }, [activities, crops, inventory, paddocks]);

  // ── NDVI paddock cards – enriched with crop name ────────────────────────
  const enrichedPaddocks = useMemo(() => {
    const cropById = new Map<string, Crop>();
    for (const c of crops) cropById.set(c.id, c);

    return paddocks.map((p) => ({
      ...p,
      cropName: p.cropId ? cropById.get(p.cropId)?.name ?? 'Sin cultivo' : 'Sin cultivo',
    }));
  }, [paddocks, crops]);

  // ── Recent activities (last 5) ──────────────────────────────────────────
  const recentActivities = useMemo(() => {
    const paddockMap = new Map<string, Paddock>();
    for (const p of paddocks) paddockMap.set(p.id, p);

    return [...activities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((a) => ({
        ...a,
        paddockName: a.paddockId ? paddockMap.get(a.paddockId)?.name ?? '—' : 'General',
      }));
  }, [activities, paddocks]);

  // ── Temporal Data for Chart ─────────────────────────────────────────────
  const monthlyStats = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentYear = new Date().getFullYear();
    
    // Initialize data array
    const data = months.map(m => ({ month: m, lluvia: 0, labores: 0 }));

    activities.forEach(a => {
      const d = new Date(a.date);
      if (d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        const monthData = data[mIdx];
        if (monthData) {
          if (a.type === 'Lluvia') {
            monthData.lluvia += (a.rainfallMm || 0);
          } else {
            // Count as labor
            monthData.labores += 1;
          }
        }
      }
    });

    return data;
  }, [activities]);

  // ── KPI card definitions ────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Área Total Cubierta',
      value: formatHectares(coveredArea),
      icon: Sprout,
      accent: 'bg-emerald-50 text-emerald-600',
      ring: 'ring-emerald-200',
      pulse: false,
    },
    {
      label: 'Acumulado Pluviométrico',
      value: `${formatNumber(monthlyRainfall)} mm`,
      icon: CloudRain,
      accent: 'bg-sky-50 text-sky-600',
      ring: 'ring-sky-200',
      pulse: false,
    },
    {
      label: 'Alertas de Inventario',
      value: String(inventoryAlerts),
      icon: AlertTriangle,
      accent: inventoryAlerts > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
      ring: inventoryAlerts > 0 ? 'ring-red-200' : 'ring-amber-200',
      pulse: inventoryAlerts > 0,
    },
    {
      label: 'Actividades del Mes',
      value: String(monthlyActivities),
      icon: ActivityIcon,
      accent: 'bg-violet-50 text-violet-600',
      ring: 'ring-violet-200',
      pulse: false,
    },
  ] as const;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 p-6">
      {/* ─ KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={cn(
                'group relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-md',
                visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
              )}
              style={{ transitionDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl',
                    kpi.accent,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {kpi.pulse && (
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                )}
              </div>

              <p className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                {kpi.value}
              </p>
              <p className="mt-1 text-sm text-gray-500">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* ─ Charts row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Doughnut */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Distribución de Superficie por Cultivo
          </h2>

          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={cropSlices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={120}
                paddingAngle={3}
                cornerRadius={6}
                stroke="none"
              >
                {cropSlices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={<CropTooltip totalArea={totalArea} />}
                wrapperStyle={{ outline: 'none' }}
              />
              <Legend
                content={<CropLegend />}
                verticalAlign="bottom"
              />
              {/* center label */}
              <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 22, fontWeight: 700 }} className="fill-gray-800">
                {formatNumber(totalArea)}
              </text>
              <text x="50%" y="52%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12 }} className="fill-gray-400">
                ha totales
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Finanzas por Cultivo (ComposedChart) */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Margen Bruto por Cultivo
          </h2>

          <ResponsiveContainer width="100%" height={320}>
            {totalCosts > 0 || totalIncome > 0 ? (
              <ComposedChart data={costsByCrop} margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, '']}
                  wrapperStyle={{ outline: 'none' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1E293B', marginBottom: '4px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name="Ingresos (USD)" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="value" name="Egresos (USD)" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line type="monotone" dataKey="margin" name="Margen (USD)" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </ComposedChart>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
                <PieChartIcon className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">No hay costos ni ingresos registrados.</p>
              </div>
            )}
          </ResponsiveContainer>
        </div>

        {/* NDVI Status Grid */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Estado Fisiológico de Lotes (NDVI)
            </h2>
            <button
              onClick={() => setIsPaddockManagerOpen(true)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Administrar Lotes
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {enrichedPaddocks.map((p) => {
              const color = ndviToColor(p.ndvi);
              const label = ndviLabel(p.ndvi);
              return (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition hover:shadow-md"
                >
                  {/* Color strip */}
                  <div
                    className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl"
                    style={{ backgroundColor: color }}
                  />

                  <div className="pl-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {p.name}
                      </h3>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {label}
                      </span>
                    </div>

                    <p className="mt-1 text-2xl font-bold" style={{ color }}>
                      {p.ndvi.toFixed(2)}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Sprout className="h-3 w-3" />
                        {p.cropName}
                      </span>
                      <span>{formatHectares(p.area)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─ Recent Activities Table ─────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Actividades Recientes
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                <th className="pb-3 pr-4 font-medium">Fecha</th>
                <th className="pb-3 pr-4 font-medium">Tipo</th>
                <th className="pb-3 pr-4 font-medium">Lote</th>
                <th className="pb-3 pr-4 font-medium">Responsable</th>
                <th className="pb-3 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((a, idx) => (
                <tr
                  key={a.id}
                  className={cn(
                    'border-b border-gray-100 transition-colors hover:bg-gray-50/70',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                  )}
                >
                  <td className="whitespace-nowrap py-3 pr-4 text-gray-700">
                    {formatDate(a.date)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        activityBadge[a.type] || 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {a.type === 'Lluvia' && <Droplets className="h-3 w-3" />}
                      {a.type}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{a.paddockName}</td>
                  <td className="py-3 pr-4 text-gray-700">{a.responsible}</td>
                  <td className="max-w-xs truncate py-3 text-gray-500">
                    {a.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─ Temporal Comparison Chart ───────────────────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Relación Precipitaciones vs. Actividad (Anual)
        </h2>
        <div className="h-80 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyStats} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" scale="band" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
              <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={-10} label={{ value: 'Lluvia (mm)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 } }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={10} label={{ value: 'Labores (cant)', angle: -90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 } }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar yAxisId="left" dataKey="lluvia" name="Lluvia (mm)" barSize={20} fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="labores" name="Labores (cant)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <PaddockManagerModal
        isOpen={isPaddockManagerOpen}
        onClose={() => setIsPaddockManagerOpen(false)}
      />
    </div>
  );
}
