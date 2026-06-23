import { useState } from 'react';
import {
  Warehouse,
  Package,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Calendar,
  Layers,
  Plus,
  MoreVertical,
  Edit2,
  Trash2
} from 'lucide-react';
import { useAgriStore } from '../store/useAgriStore';
import { cn, formatNumber, formatCurrency, formatDate } from '../lib/utils';
import type { InputCategory, InventoryItem } from '../types';
import InventoryModal from '../components/inventory/InventoryModal';

// ─── Category Style Config ────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<InputCategory, { bg: string; text: string }> = {
  Agricola: { bg: 'bg-green-100', text: 'text-green-700' },
  Ganadero: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Estructura: { bg: 'bg-slate-100', text: 'text-slate-700' },
  Semilla: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Fertilizante: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Agroquimico: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Combustible: { bg: 'bg-orange-100', text: 'text-orange-700' },
  Otro: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStockStatus(current: number, minimum: number) {
  if (current < minimum) return 'critical';
  if (current < minimum * 2) return 'warning';
  return 'healthy';
}

function getStockBarColor(status: string) {
  switch (status) {
    case 'critical':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-emerald-500';
  }
}

function getStockBarTrack(status: string) {
  switch (status) {
    case 'critical':
      return 'bg-red-100';
    case 'warning':
      return 'bg-amber-100';
    default:
      return 'bg-emerald-100';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryView() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useAgriStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleSave = async (itemData: Partial<InventoryItem>) => {
    if (editingItem) {
      await updateInventoryItem(editingItem.id, itemData);
    } else {
      await addInventoryItem(itemData as any);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este insumo?')) {
      await deleteInventoryItem(id);
    }
    setActiveMenuId(null);
  };

  // Computed stats
  const totalValue = inventory.reduce(
    (acc, item) => acc + item.currentStock * item.unitCost,
    0
  );
  const belowMinimum = inventory.filter(
    (item) => item.currentStock < item.minimumStock
  );
  const distinctCategories = new Set(inventory.map((item) => item.category));

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Warehouse className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Pañol de Insumos
            </h1>
            <p className="text-sm text-gray-500">
              {inventory.length} insumos registrados
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Insumo
        </button>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Value */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Valor total inventario
              </p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Below Minimum */}
        <div
          className={cn(
            'rounded-2xl border bg-white p-5 shadow-sm',
            belowMinimum.length > 0
              ? 'border-red-200 bg-red-50/30'
              : 'border-gray-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                belowMinimum.length > 0 ? 'bg-red-100' : 'bg-gray-100'
              )}
            >
              <TrendingDown
                className={cn(
                  'h-5 w-5',
                  belowMinimum.length > 0 ? 'text-red-600' : 'text-gray-500'
                )}
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Bajo stock mínimo
              </p>
              <p
                className={cn(
                  'text-xl font-bold',
                  belowMinimum.length > 0 ? 'text-red-600' : 'text-gray-900'
                )}
              >
                {belowMinimum.length}{' '}
                <span className="text-sm font-normal text-gray-400">
                  / {inventory.length}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Layers className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Categorías
              </p>
              <p className="text-xl font-bold text-gray-900">
                {distinctCategories.size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inventory Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const status = getStockStatus(item.currentStock, item.minimumStock);
          const isBelowMin = status === 'critical';
          const maxBar = item.minimumStock * 3;
          const percentage = Math.min(
            100,
            (item.currentStock / maxBar) * 100
          );
          const thresholdPercent = Math.min(
            100,
            (item.minimumStock / maxBar) * 100
          );
          const catStyle = CATEGORY_STYLES[item.category];

          return (
            <div
              key={item.id}
              className={cn(
                'group relative rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md',
                isBelowMin
                  ? 'border-red-200 ring-1 ring-red-100'
                  : 'border-gray-100'
              )}
            >
              {/* Below minimum warning badge */}
              {isBelowMin && (
                <div className="absolute -right-2 -top-2 z-10">
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-lg">
                      <AlertTriangle className="h-3.5 w-3.5 text-white" />
                    </span>
                  </div>
                </div>
              )}

              {/* Name and category */}
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-gray-200">
                    <Package className="h-4 w-4 text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight text-gray-900">
                    {item.name}
                  </h3>
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {activeMenuId === item.id && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="py-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <span
                className={cn(
                  'mb-4 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  catStyle.bg,
                  catStyle.text
                )}
              >
                {item.category}
              </span>

              {/* Stock level */}
              <div className="mb-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatNumber(item.currentStock)}
                  </span>
                  <span className="text-sm text-gray-400">{item.unit}</span>
                </div>

                {/* Progress bar with threshold line */}
                <div className="relative mt-2">
                  <div
                    className={cn(
                      'h-2.5 w-full overflow-hidden rounded-full',
                      getStockBarTrack(status)
                    )}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        getStockBarColor(status)
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {/* Minimum threshold marker */}
                  <div
                    className="absolute top-0 h-2.5 w-0.5 bg-gray-800/50"
                    style={{ left: `${thresholdPercent}%` }}
                    title={`Stock mínimo: ${formatNumber(item.minimumStock)} ${item.unit}`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Mínimo:{' '}
                  <span className="font-medium text-gray-500">
                    {formatNumber(item.minimumStock)} {item.unit}
                  </span>
                </p>
              </div>

              {/* Footer: cost and date */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(item.unitCost)}
                  <span className="text-gray-400">/ {item.unit.slice(0, -1) || item.unit}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="h-3 w-3" />
                  {formatDate(item.lastRestocked)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <InventoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSave}
        editingItem={editingItem}
      />
    </div>
  );
}
