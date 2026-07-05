import React, { useState } from 'react';
import { useAgriStore } from '../../store/useAgriStore';
import { X, Plus, BookOpen } from 'lucide-react';
import type { AccountType } from '../../types';

interface AccountManagerModalProps {
  onClose: () => void;
}

export default function AccountManagerModal({ onClose }: AccountManagerModalProps) {
  const chartOfAccounts = useAgriStore((s) => s.chartOfAccounts);
  const addChartOfAccount = useAgriStore((s) => s.addChartOfAccount);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('OPEX_INDIRECT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;

    setIsSubmitting(true);
    try {
      await addChartOfAccount({ code, name, type });
      setCode('');
      setName('');
    } catch (err) {
      alert('Error al crear la cuenta. Quizás el código ya exista.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Cuentas Contables</h2>
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
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Agregar Nueva Cuenta</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Código</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2.5"
                  className="w-full rounded-lg border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mantenimiento Vehículos"
                  className="w-full rounded-lg border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de Cuenta</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full rounded-lg border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="OPEX_DIRECT">Costo Directo (Lotes)</option>
                  <option value="OPEX_INDIRECT">Costo Indirecto (Estructura)</option>
                  <option value="CAPEX">Bienes de Capital (Activos)</option>
                  <option value="REVENUE">Ingresos</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>Guardar Cuenta</span>
              </button>
            </div>
          </form>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Catálogo Actual</h3>
            {chartOfAccounts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No hay cuentas contables registradas.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {chartOfAccounts
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{acc.code}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{acc.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                            {acc.type}
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
