import React, { useState } from 'react';
import { useAgriStore } from '../store/useAgriStore';
import { Plus, Receipt, Calendar } from 'lucide-react';
import { TransactionType } from '../types';

export const ExpensesView: React.FC = () => {
  const { transactions, chartOfAccounts, costCenters, addTransaction } = useAgriStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State (Local Timezone adjustment)
  const getLocalDateString = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
  };

  const [date, setDate] = useState(getLocalDateString());
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [amount, setAmount] = useState('');
  const type: TransactionType = 'EXPENSE';

  // Limpiar centro de costo cuando cambia la cuenta para evitar inconsistencias
  React.useEffect(() => {
    setCostCenterId('');
  }, [accountId]);

  // Filtrar solo transacciones (Opex) por ahora
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const expenseAccounts = chartOfAccounts.filter((a) => a.type.startsWith('OPEX_'));

  const selectedAccount = chartOfAccounts.find((a) => a.id === accountId);
  const filteredCostCenters = costCenters.filter((c) => {
    if (!selectedAccount) return true;
    if (selectedAccount.type === 'OPEX_DIRECT') {
      return c.type === 'DIRECT';
    }
    return c.type === 'INDIRECT';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !amount) return;
    
    // Validar que si es costo directo, tenga lote
    if (selectedAccount?.type === 'OPEX_DIRECT' && !costCenterId) {
      alert('Los costos directos deben asignarse a un Lote (Centro de Costo Directo).');
      return;
    }

    await addTransaction({
      date: new Date(date).toISOString(),
      description,
      accountId,
      costCenterId: costCenterId || null,
      amount: Number(amount),
      type,
    });

    setIsModalOpen(false);
    setDescription('');
    setAmount('');
  };

  const getAccountName = (id: string) => chartOfAccounts.find((a) => a.id === id)?.name || 'N/A';
  const getCostCenterName = (id?: string | null) => {
    if (!id) return 'General (Sin asignar)';
    return costCenters.find((c) => c.id === id)?.name || 'N/A';
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gastos y Compras (OPEX)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra y gestiona los costos operativos directos e indirectos.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Gasto</span>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center space-x-3 text-slate-500 mb-2">
            <Receipt className="h-5 w-5" />
            <h3 className="font-medium">Total Gastos</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Cuenta
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Centro de Costo
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Monto
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>{new Date(expense.date).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {expense.description}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                    {getAccountName(expense.accountId)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {getCostCenterName(expense.costCenterId)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-slate-800">
                  {formatCurrency(expense.amount)}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No hay gastos registrados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Registrar Nuevo Gasto</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Fecha</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Descripción</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Combustible Tractor John Deere"
                  className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Cuenta Contable</label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                >
                  <option value="">Seleccione una cuenta...</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Centro de Costo</label>
                <select
                  required={selectedAccount?.type === 'OPEX_DIRECT'}
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                >
                  {selectedAccount?.type === 'OPEX_DIRECT' ? (
                    <option value="">Seleccione el Lote de destino (Obligatorio)...</option>
                  ) : (
                    <option value="">General (Sin asignar)</option>
                  )}
                  {filteredCostCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type === 'DIRECT' ? 'Lote' : 'Estructura'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Monto Total (USD)</label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full rounded-lg border-slate-300 pl-7 pr-12 focus:border-green-500 focus:ring-green-500 sm:text-sm"
                    placeholder="0.00"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-slate-500 sm:text-sm">USD</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
