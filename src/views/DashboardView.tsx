import React, { useMemo, useState } from 'react';
import { useAgriStore } from '../store/useAgriStore';
import { formatCurrency } from '../lib/utils';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardView() {
  const transactions = useAgriStore(s => s.transactions);
  const chartOfAccounts = useAgriStore(s => s.chartOfAccounts);
  const costCenters = useAgriStore(s => s.costCenters);

  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'THIS_YEAR'>('ALL');

  // --- Filtrado de Transacciones ---
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      if (dateFilter === 'ALL') return true;
      const tDate = new Date(t.date);
      if (dateFilter === 'THIS_MONTH') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'THIS_YEAR') {
        return tDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [transactions, dateFilter]);

  // --- KPIs ---
  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expense += t.amount;
    });
    return { totalIncome: income, totalExpense: expense };
  }, [filteredTransactions]);

  const margin = totalIncome - totalExpense;

  // --- Datos para Gráficos ---

  // 1. Gastos por Lote (Centro de Costo Directo)
  const expensesByCostCenter = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'EXPENSE' && t.costCenterId);
    
    const grouped = expenses.reduce((acc, t) => {
      const cc = costCenters.find(c => c.id === t.costCenterId);
      if (!cc) return acc;
      
      const name = cc.name;
      acc[name] = (acc[name] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, costCenters]);

  // 2. Gastos por Cuenta Contable (Categoría)
  const expensesByAccount = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'EXPENSE');
    
    const grouped = expenses.reduce((acc, t) => {
      const account = chartOfAccounts.find(a => a.id === t.accountId);
      const name = account ? account.name : 'Sin Clasificar';
      acc[name] = (acc[name] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, chartOfAccounts]);

  // Custom Tooltip para moneda
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
          <p className="font-semibold text-slate-800 mb-1">{payload[0].name}</p>
          <p className="text-emerald-600 font-bold">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Financiero</h1>
          <p className="text-sm text-slate-500 mt-1">Análisis de rentabilidad y distribución de costos</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setDateFilter('THIS_MONTH')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              dateFilter === 'THIS_MONTH' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setDateFilter('THIS_YEAR')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              dateFilter === 'THIS_YEAR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Este Año
          </button>
          <button
            onClick={() => setDateFilter('ALL')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              dateFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold">Total Ingresos</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-16 h-16 text-red-600" />
          </div>
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold">Total Gastos (Costos)</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalExpense)}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-2xl p-5 shadow-sm border relative overflow-hidden group ${
          margin >= 0 
            ? 'from-emerald-500 to-emerald-600 border-emerald-400 text-white' 
            : 'from-red-500 to-red-600 border-red-400 text-white'
        }`}>
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <DollarSign className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Margen Bruto</h3>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(margin)}</p>
          <p className="text-xs mt-2 opacity-80">
            {margin >= 0 ? 'Rentabilidad positiva' : 'Rentabilidad negativa'}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Torta: Gastos por Lote */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-800">Distribución por Lote (CC)</h3>
          </div>
          
          {expensesByCostCenter.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCostCenter}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {expensesByCostCenter.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
              No hay gastos asignados a lotes en este período.
            </div>
          )}
        </div>

        {/* Barras: Gastos por Cuenta Contable */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-800">Gastos por Cuenta Contable</h3>
          </div>
          
          {expensesByAccount.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expensesByAccount} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(val) => `$${val/1000}k`} stroke="#94a3b8" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={90} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {expensesByAccount.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
              No hay gastos registrados en este período.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
