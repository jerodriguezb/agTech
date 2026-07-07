import React, { useState } from 'react';
import { useAgriStore } from '../store/useAgriStore';
import { Plus, Warehouse, TrendingUp, CheckCircle, Clock, ArrowDownToLine } from 'lucide-react';
import { SalesOrder, SalesPayment, StorageLocation, GrainStock } from '../types';

export const CommercialView: React.FC = () => {
  const { storageLocations, grainStocks, salesOrders, crops, addSalesOrder, addStorageLocation, updateGrainStock } = useAgriStore();
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isStockEntryModalOpen, setIsStockEntryModalOpen] = useState(false);

  // Stock Entry form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryCropId, setEntryCropId] = useState('');
  const [entryStorageId, setEntryStorageId] = useState('');
  const [entryKg, setEntryKg] = useState('');

  // Storage form state
  const [storageName, setStorageName] = useState('');
  const [storageType, setStorageType] = useState<'SILO' | 'BAG' | 'EXTERNAL'>('SILO');
  const [capacity, setCapacity] = useState('');

  // Sales form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cropId, setCropId] = useState('');
  const [storageLocationId, setStorageLocationId] = useState('');
  const [tonsSold, setTonsSold] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxPercentage, setTaxPercentage] = useState('7');
  const [freightDeduction, setFreightDeduction] = useState('0');

  // Subtotals
  const subtotal = Number(tonsSold) * Number(unitPrice);
  const taxAmount = (subtotal * Number(taxPercentage)) / 100;
  const netTotal = subtotal - taxAmount - Number(freightDeduction);

  const handleStorageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addStorageLocation({
      name: storageName,
      type: storageType,
      capacityTons: capacity ? Number(capacity) : undefined
    });
    setIsStorageModalOpen(false);
    setStorageName('');
    setCapacity('');
  };

  const handleStockEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryCropId || !entryStorageId || !entryKg) return;
    
    await updateGrainStock(entryStorageId, entryCropId, Number(entryKg));
    
    setIsStockEntryModalOpen(false);
    setEntryKg('');
    setEntryCropId('');
    setEntryStorageId('');
  };

  const openSalesModalForStock = (stock: GrainStock) => {
    setStorageLocationId(stock.storageLocationId);
    setCropId(stock.cropId);
    setTonsSold('');
    setUnitPrice('');
    setIsSalesModalOpen(true);
  };

  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropId || !tonsSold || !unitPrice) return;

    // Verificar stock si se seleccionó ubicación
    if (storageLocationId) {
      const stock = grainStocks.find(s => s.storageLocationId === storageLocationId && s.cropId === cropId);
      if (!stock || stock.currentTons < Number(tonsSold)) {
        alert("Stock insuficiente en el almacén seleccionado.");
        return;
      }
    }

    const orderData = {
      date: new Date(date).toISOString(),
      cropId,
      storageLocationId: storageLocationId || null,
      tonsSold: Number(tonsSold),
      unitPrice: Number(unitPrice),
      subtotal,
      taxPercentage: Number(taxPercentage),
      freightDeduction: Number(freightDeduction),
      netTotal,
    };

    await addSalesOrder(orderData, []);
    
    setIsSalesModalOpen(false);
    setTonsSold('');
    setUnitPrice('');
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(val);

  const getCropName = (id: string) => crops.find(c => c.id === id)?.name || 'N/A';
  const getStorageName = (id?: string | null) => {
    if (!id) return 'General';
    return storageLocations.find(s => s.id === id)?.name || 'N/A';
  };

  const totalTonsStock = grainStocks.reduce((sum, s) => sum + s.currentTons, 0);
  const totalSalesNet = salesOrders.reduce((sum, o) => sum + o.netTotal, 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Comercialización y Acopio</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona tu stock físico de granos, almacenes, liquidaciones de venta y cheques.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsStorageModalOpen(true)}
            className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
          >
            <Warehouse className="h-5 w-5 text-slate-500" />
            <span>Nuevo Almacén</span>
          </button>
          <button
            onClick={() => setIsStockEntryModalOpen(true)}
            className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <ArrowDownToLine className="h-5 w-5" />
            <span>Ingresar a Acopio</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center space-x-3 text-amber-600 mb-2">
            <Warehouse className="h-5 w-5" />
            <h3 className="font-medium text-amber-800">Stock Total en Acopio</h3>
          </div>
          <p className="text-3xl font-bold text-amber-700">
            {totalTonsStock.toFixed(2)} Kg
          </p>
        </div>
        <div className="rounded-2xl bg-slate-800 p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center space-x-3 text-emerald-400 mb-2">
            <TrendingUp className="h-5 w-5" />
            <h3 className="font-medium text-emerald-200">Ventas Netas Realizadas</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {formatCurrency(totalSalesNet)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Existencias (Stock) */}
        <div className="lg:col-span-1 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Existencias por Almacén</h2>
          {storageLocations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No hay almacenes creados.</p>
          ) : (
            <div className="space-y-4">
              {storageLocations.map(loc => {
                const stocksInLoc = grainStocks.filter(s => s.storageLocationId === loc.id);
                const isBag = loc.type === 'BAG';
                return (
                  <div key={loc.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-700 text-sm flex items-center gap-1">
                        {loc.name} {isBag && <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">BOLSA</span>}
                      </span>
                      <span className="text-xs text-slate-500">{loc.capacityTons ? `Cap: ${loc.capacityTons} Kg` : ''}</span>
                    </div>
                    {stocksInLoc.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Sin existencias</p>
                    ) : (
                      <ul className="space-y-1">
                        {stocksInLoc.map(stock => (
                          <li key={stock.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                            <div className="flex flex-col">
                              <span className="text-slate-600 font-medium">{getCropName(stock.cropId)}</span>
                              <span className="font-bold text-slate-800">{stock.currentTons.toFixed(2)} Kg</span>
                            </div>
                            <button
                              onClick={() => openSalesModalForStock(stock)}
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                            >
                              Liquidar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Órdenes de Venta */}
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
           <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Historial de Ventas (Liquidaciones)</h2>
           </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Cultivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Almacén</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Kg.</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Neto (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {salesOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                    {new Date(order.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {getCropName(order.cropId)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {getStorageName(order.storageLocationId)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-slate-600">
                    {order.tonsSold} Kg
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-emerald-600">
                    {formatCurrency(order.netTotal)}
                  </td>
                </tr>
              ))}
              {salesOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No hay liquidaciones registradas aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Almacén */}
      {isStorageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl my-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Nuevo Almacén / Acopio</h2>
            <form onSubmit={handleStorageSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nombre (ej: Silo Norte)</label>
                <input required type="text" value={storageName} onChange={e => setStorageName(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tipo</label>
                <select value={storageType} onChange={(e) => setStorageType(e.target.value as any)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="SILO">Silo Fijo</option>
                  <option value="BAG">Silobolsa</option>
                  <option value="EXTERNAL">Acopio Externo (Cooperativa)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Capacidad (Kg) - Opcional</label>
                <input type="number" step="0.01" value={capacity} onChange={e => setCapacity(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsStorageModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Guardar Almacén</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ingreso a Acopio */}
      {isStockEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl my-8">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Ingreso a Acopio (Estoquear)</h2>
            <p className="text-sm text-slate-500 mb-4">Registrá el ingreso de granos a un silo, bolsa o cooperativa.</p>
            <form onSubmit={handleStockEntrySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Fecha</label>
                <input required type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Cultivo</label>
                <select required value={entryCropId} onChange={e => setEntryCropId(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="">Seleccione...</option>
                  {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Almacén de Destino</label>
                <select required value={entryStorageId} onChange={e => setEntryStorageId(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="">Seleccione...</option>
                  {storageLocations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Cantidad (Kg)</label>
                <input required type="number" step="0.01" value={entryKg} onChange={e => setEntryKg(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsStockEntryModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button>
                <button type="submit" className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>Guardar Ingreso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Liquidación Venta */}
      {isSalesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl my-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Registrar Liquidación de Venta</h2>
            <p className="text-sm text-slate-500 mb-6">Esta operación descontará stock y generará un ingreso financiero.</p>
            
            <form onSubmit={handleSalesSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Cultivo</label>
                  <select disabled required value={cropId} onChange={e => setCropId(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-500">
                    <option value="">Seleccione...</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Extraer de Almacén</label>
                  <select disabled required value={storageLocationId} onChange={e => setStorageLocationId(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-500">
                    <option value="">Seleccione...</option>
                    {storageLocations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Kilogramos a Vender</label>
                  <input required type="number" step="0.01" value={tonsSold} onChange={e => setTonsSold(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Precio Unitario (USD/Kg)</label>
                  <input required type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Retenciones / Impuestos (%)</label>
                  <input required type="number" step="0.1" value={taxPercentage} onChange={e => setTaxPercentage(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Costo de Flete Total (Deducción USD)</label>
                  <input required type="number" step="0.01" value={freightDeduction} onChange={e => setFreightDeduction(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <h3 className="font-semibold text-emerald-800 mb-2">Liquidación</h3>
                <div className="flex justify-between text-sm text-emerald-700 mb-1"><span>Subtotal Bruto:</span> <span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-sm text-rose-600 mb-1"><span>Impuestos ({taxPercentage}%):</span> <span>- {formatCurrency(taxAmount)}</span></div>
                <div className="flex justify-between text-sm text-rose-600 mb-3"><span>Flete (Fijo):</span> <span>- {formatCurrency(Number(freightDeduction))}</span></div>
                <div className="flex justify-between font-bold text-lg text-emerald-900 border-t border-emerald-200 pt-2">
                  <span>Neto a Cobrar:</span> <span>{formatCurrency(netTotal)}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsSalesModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button>
                <button type="submit" className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Registrar Liquidación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
