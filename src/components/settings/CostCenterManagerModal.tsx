import React, { useState } from 'react';
import { useAgriStore } from '../../store/useAgriStore';
import { X, Plus, Target } from 'lucide-react';
import type { CostCenterType } from '../../types';

interface CostCenterManagerModalProps {
  onClose: () => void;
}

export default function CostCenterManagerModal({ onClose }: CostCenterManagerModalProps) {
  const costCenters = useAgriStore((s) => s.costCenters);
  const addCostCenter = useAgriStore((s) => s.addCostCenter);

  const [name, setName] = useState('');
  const [type, setType] = useState<CostCenterType>('INDIRECT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);
    try {
      await addCostCenter({ name, type });
      setName('');
    } catch (err) {
      alert('Error al crear el Centro de Costo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-orange-100 p-2 text-orange-600">
              <Target className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Centros de Costo</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Agregar Nuevo Centro de Costo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Flota de Tractores"
                  className="w-full rounded-lg border-slate-300 text-sm focus:border-orange-500 focus:ring-orange-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CostCenterType)}
                  className="w-full rounded-lg border-slate-300 text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="INDIRECT">Indirecto (Estructura/Taller)</option>
                  <option value="DIRECT">Directo (Lote)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>Guardar Centro</span>
              </button>
            </div>
          </form>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Centros de Costo Registrados</h3>
            {costCenters.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No hay centros de costo registrados.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {costCenters
                      .sort((a, b) => a.type.localeCompare(b.type))
                      .map((cc) => (
                      <tr key={cc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{cc.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cc.type === 'DIRECT' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                            {cc.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
