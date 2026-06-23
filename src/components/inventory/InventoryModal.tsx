import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { InventoryItem, InputCategory } from '../../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<InventoryItem>) => Promise<void>;
  editingItem?: InventoryItem | null;
}

export default function InventoryModal({ isOpen, onClose, onSave, editingItem }: InventoryModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InputCategory>('Agricola');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minimumStock, setMinimumStock] = useState<number>(0);
  const [unit, setUnit] = useState('L');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category);
      setCurrentStock(editingItem.currentStock);
      setMinimumStock(editingItem.minimumStock);
      setUnit(editingItem.unit);
      setUnitCost(editingItem.unitCost);
    } else {
      setName('');
      setCategory('Agricola');
      setCurrentStock(0);
      setMinimumStock(0);
      setUnit('L');
      setUnitCost(0);
    }
  }, [editingItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        name,
        category,
        currentStock: Number(currentStock),
        minimumStock: Number(minimumStock),
        unit,
        unitCost: Number(unitCost)
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving inventory item:', err);
      alert('Error al guardar: ' + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-0">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingItem ? 'Editar Insumo' : 'Nuevo Insumo'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nombre del Insumo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="Ej. Glifosato 48%"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InputCategory)}
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                >
                  <option value="Agricola">Agrícola</option>
                  <option value="Ganadero">Ganadero</option>
                  <option value="Estructura">Estructura</option>
                  <option value="Semilla">Semilla</option>
                  <option value="Fertilizante">Fertilizante</option>
                  <option value="Agroquimico">Agroquímico</option>
                  <option value="Combustible">Combustible</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Unidad
                </label>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="Ej. L, Kg, Unid"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Stock Actual
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={currentStock}
                  onChange={(e) => setCurrentStock(parseFloat(e.target.value))}
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Stock Mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(parseFloat(e.target.value))}
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Costo Unitario (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value))}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Agregar Insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
