import React, { useState, useRef } from 'react';
import { useAgriStore } from '../store/useAgriStore';
import { Plus, Receipt, Calendar, Camera, Upload, Loader2, Trash2 } from 'lucide-react';
import { TransactionType, TransactionItem } from '../types';
import { parseInvoiceImage } from '../lib/geminiEngine';
import { supabase } from '../lib/supabaseClient';

type InputMode = 'simple' | 'detailed';

export const ExpensesView: React.FC = () => {
  const { transactions, chartOfAccounts, costCenters, inventory, crops, addTransaction } = useAgriStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('simple');
  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE');

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft Invoice State
  const [invoiceItems, setInvoiceItems] = useState<TransactionItem[]>([]);

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
  const [cropId, setCropId] = useState(''); // Para ventas de cosecha

  // Limpiar centro de costo cuando cambia la cuenta para evitar inconsistencias
  React.useEffect(() => {
    setCostCenterId('');
  }, [accountId]);

  // Filtrar cuentas según tipo de transacción
  const filteredAccounts = chartOfAccounts.filter((a) => {
    if (transactionType === 'EXPENSE') return a.type.startsWith('OPEX_') || a.type === 'CAPEX';
    if (transactionType === 'INCOME') return a.type === 'REVENUE';
    return false;
  });

  const selectedAccount = chartOfAccounts.find((a) => a.id === accountId);
  const filteredCostCenters = costCenters.filter((c) => {
    if (!selectedAccount) return true;
    if (selectedAccount.type === 'OPEX_DIRECT') {
      return c.type === 'DIRECT';
    }
    return c.type === 'INDIRECT';
  });

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading receipt:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setReceiptFile(file);
      setIsScanning(true);
      setScanError(null);

      try {
        // Convert to base64 for Gemini
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          try {
            const parsed = await parseInvoiceImage(base64String, file.type, inventory);
            
            setDate(parsed.date);
            setDescription(parsed.provider);
            setAmount(parsed.totalAmount.toString());
            
            const newItems: TransactionItem[] = parsed.items.map(item => ({
              id: Math.random().toString(36).substring(2),
              transactionId: '',
              inventoryItemId: item.inventoryItemId,
              description: item.originalName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            }));
            
            setInvoiceItems(newItems);
          } catch (err: any) {
            setScanError(err.message || 'Error al escanear la factura.');
          } finally {
            setIsScanning(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        setScanError('No se pudo procesar la imagen.');
        setIsScanning(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !amount) return;
    
    if (selectedAccount?.type === 'OPEX_DIRECT' && !costCenterId) {
      alert('Los costos directos deben asignarse a un Lote (Centro de Costo Directo).');
      return;
    }

    let receiptUrl = null;
    if (inputMode === 'detailed' && receiptFile) {
      receiptUrl = await uploadReceipt(receiptFile);
    }

    let transactionItems = inputMode === 'detailed' ? invoiceItems : [];
    
    // Si es una venta de cosecha, armamos el item de venta
    if (transactionType === 'INCOME' && cropId) {
      transactionItems = [{
        id: Math.random().toString(36).substring(2),
        transactionId: '',
        cropId: cropId,
        description: 'Venta de cultivo',
        quantity: 1, // Podría expandirse para pedir toneladas en el manual
        unitPrice: Number(amount),
        subtotal: Number(amount),
      }];
    }

    await addTransaction({
      date: new Date(date).toISOString(),
      description,
      accountId,
      costCenterId: costCenterId || null,
      amount: Number(amount),
      type: transactionType,
      receiptUrl,
      items: transactionItems,
    });

    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDescription('');
    setAmount('');
    setInvoiceItems([]);
    setReceiptFile(null);
    setInputMode('simple');
    setCropId('');
  };

  const updateInvoiceItem = (id: string, field: keyof TransactionItem, value: any) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.subtotal = Number((updated.quantity * updated.unitPrice).toFixed(2));
        }
        return updated;
      }
      return item;
    }));
  };

  const removeInvoiceItem = (id: string) => {
    setInvoiceItems(prev => prev.filter(item => item.id !== id));
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
          <h1 className="text-2xl font-bold text-slate-800">Registro Financiero (Ingresos y Gastos)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra y gestiona las ventas de cosecha y los costos operativos.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-5 w-5" />
          <span>Nueva Transacción</span>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center space-x-3 text-emerald-600 mb-2">
            <Receipt className="h-5 w-5" />
            <h3 className="font-medium text-emerald-800">Total Ingresos</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-700">
            {formatCurrency(transactions.filter(t => t.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0))}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center space-x-3 text-rose-500 mb-2">
            <Receipt className="h-5 w-5" />
            <h3 className="font-medium text-rose-800">Total Gastos</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {formatCurrency(transactions.filter(t => t.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0))}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-800 p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center space-x-3 text-emerald-400 mb-2">
            <Receipt className="h-5 w-5" />
            <h3 className="font-medium text-emerald-200">Margen Bruto</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {formatCurrency(
              transactions.filter(t => t.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0) -
              transactions.filter(t => t.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0)
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Cuenta</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Centro de Costo</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>{new Date(transaction.date).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {transaction.description}
                  {transaction.receiptUrl && (
                    <a href={transaction.receiptUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 hover:underline">
                      (Ver Comprobante)
                    </a>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                    {getAccountName(transaction.accountId)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {getCostCenterName(transaction.costCenterId)}
                </td>
                <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-bold ${transaction.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No hay transacciones registradas aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl my-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Registrar Nueva Transacción</h2>
            
            {/* Tipo de Transacción */}
            <div className="flex space-x-2 mb-4 bg-slate-100 p-1 rounded-lg w-full max-w-sm">
              <button
                type="button"
                onClick={() => setTransactionType('EXPENSE')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${transactionType === 'EXPENSE' ? 'bg-rose-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Gasto / Compra
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('INCOME')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${transactionType === 'INCOME' ? 'bg-emerald-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Ingreso / Venta
              </button>
            </div>

            {/* Mode Toggle solo para Gastos */}
            {transactionType === 'EXPENSE' && (
              <div className="flex space-x-2 mb-6 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setInputMode('simple')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'simple' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Gasto Simple
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('detailed')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'detailed' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Compra Detallada (Escanear Factura)
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {inputMode === 'detailed' && transactionType === 'EXPENSE' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6">
                  <h3 className="font-medium text-emerald-800 mb-2 flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Escáner con IA (Gemini Vision)
                  </h3>
                  <p className="text-sm text-emerald-700 mb-4">
                    Sube una foto de tu factura o remito. La inteligencia artificial extraerá los ítems y los cruzará con tu Pañol automáticamente.
                  </p>
                  
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanning}
                      className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span>{isScanning ? 'Escaneando con IA...' : 'Subir Imagen o PDF'}</span>
                    </button>
                    {receiptFile && <span className="text-sm text-slate-600 font-medium">Archivo: {receiptFile.name}</span>}
                  </div>
                  {scanError && <p className="mt-2 text-sm text-red-600 font-medium">{scanError}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-slate-700">Descripción / Proveedor</label>
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
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="">Seleccione una cuenta...</option>
                    {filteredAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                {transactionType === 'INCOME' && selectedAccount?.type === 'REVENUE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Cultivo Vendido</label>
                    <select
                      value={cropId}
                      onChange={(e) => setCropId(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Seleccione cultivo (Opcional)</option>
                      {crops.map((crop) => (
                        <option key={crop.id} value={crop.id}>
                          {crop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {transactionType === 'EXPENSE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Centro de Costo / Lote</label>
                    <select
                      value={costCenterId}
                      onChange={(e) => setCostCenterId(e.target.value)}
                      disabled={!accountId}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    >
                      {selectedAccount?.type === 'OPEX_DIRECT' ? (
                        <option value="">Seleccione Lote (Obligatorio)</option>
                      ) : (
                        <option value="">General (Sin asignar)</option>
                      )}
                      {filteredCostCenters.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.name}
                        </option>
                      ))}
                    </select>
                    {selectedAccount?.type === 'OPEX_DIRECT' && (
                      <p className="mt-1 text-xs text-rose-500">
                        * Los costos directos requieren asignar un lote.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {inputMode === 'detailed' && invoiceItems.length > 0 && (
                <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Detalle de Ítems (Detectados por IA)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-2">Ítem Original (Factura)</th>
                          <th className="px-4 py-2">Match en Pañol</th>
                          <th className="px-4 py-2 w-24">Cantidad</th>
                          <th className="px-4 py-2 w-32">Precio Un.</th>
                          <th className="px-4 py-2 w-32">Subtotal</th>
                          <th className="px-4 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invoiceItems.map((item) => (
                          <tr key={item.id} className="bg-white">
                            <td className="px-4 py-2">
                              <input 
                                type="text" 
                                value={item.description || ''} 
                                onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)}
                                className="w-full border-0 bg-transparent p-0 focus:ring-0 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select 
                                value={item.inventoryItemId || ''}
                                onChange={(e) => updateInvoiceItem(item.id, 'inventoryItemId', e.target.value)}
                                className="w-full border-slate-300 rounded text-sm py-1"
                              >
                                <option value="">(No vincular al pañol)</option>
                                {inventory.map(inv => (
                                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateInvoiceItem(item.id, 'quantity', Number(e.target.value))}
                                className="w-full border-slate-300 rounded text-sm py-1"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                value={item.unitPrice} 
                                onChange={(e) => updateInvoiceItem(item.id, 'unitPrice', Number(e.target.value))}
                                className="w-full border-slate-300 rounded text-sm py-1"
                              />
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {formatCurrency(item.subtotal)}
                            </td>
                            <td className="px-4 py-2">
                              <button type="button" onClick={() => removeInvoiceItem(item.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm text-slate-500">Revisá que el match con el pañol sea correcto.</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        const sum = invoiceItems.reduce((acc, curr) => acc + curr.subtotal, 0);
                        setAmount(sum.toString());
                      }}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-800"
                    >
                      Sumar Subtotales al Total
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700">Monto Total Final (USD)</label>
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
                    className="block w-full rounded-lg border-slate-300 pl-7 pr-12 focus:border-green-500 focus:ring-green-500 sm:text-sm font-bold text-lg"
                    placeholder="0.00"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-slate-500 sm:text-sm">USD</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 shadow-sm"
                >
                  Confirmar y Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
