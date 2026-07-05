import { useState, useRef, useEffect, useCallback } from 'react';
import { X, SendHorizontal, Leaf, Camera, Mic, Paperclip, Check, Trash2, Settings } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn, formatCurrency, formatNumber } from '../../lib/utils';
import { processWithGemini, isGeminiConfigured, parseInvoiceImage } from '../../lib/geminiEngine';
import type { PendingActivity, ParsedInvoice } from '../../types';
import AISettingsModal from '../settings/AISettingsModal';
import { supabase } from '../../lib/supabaseClient';

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-gray-400"
          style={{
            animation: 'copilot-bounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Timestamp Formatter ──────────────────────────────────────────────────────

function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ─── Invoice Card Subcomponent ────────────────────────────────────────────────

function InvoiceCard({ 
  pendingAction, 
  msgId, 
  onConfirm, 
  onCancel 
}: { 
  pendingAction: PendingActivity; 
  msgId: string; 
  onConfirm: (id: string, action: PendingActivity, accountId: string, costCenterId: string | null) => void; 
  onCancel: (id: string) => void; 
}) {
  const chartOfAccounts = useAgriStore((s) => s.chartOfAccounts);
  const costCenters = useAgriStore((s) => s.costCenters);
  
  const expenseAccounts = chartOfAccounts.filter((a) => a.type.startsWith('OPEX_'));
  const [accountId, setAccountId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');

  const selectedAccount = chartOfAccounts.find((a) => a.id === accountId);
  const filteredCostCenters = costCenters.filter((c) => {
    if (!selectedAccount) return true;
    if (selectedAccount.type === 'OPEX_DIRECT') return c.type === 'DIRECT';
    return c.type === 'INDIRECT';
  });

  // Limpiar centro de costo si cambia la cuenta
  useEffect(() => {
    setCostCenterId('');
  }, [accountId]);

  const handleConfirm = () => {
    if (!accountId) {
      alert("Seleccioná una Cuenta Contable.");
      return;
    }
    if (selectedAccount?.type === 'OPEX_DIRECT' && !costCenterId) {
      alert("Para costos directos debés seleccionar un Lote (Centro de Costo).");
      return;
    }
    onConfirm(msgId, pendingAction, accountId, costCenterId || null);
  };

  const parsed = pendingAction.parsedInvoice;
  if (!parsed) return null;

  return (
    <div className="mb-3 rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-xs text-emerald-900 shadow-sm">
      <p className="font-bold border-b border-emerald-200 pb-1 mb-2 text-emerald-800">Detalle de la Compra</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 mb-2">
        <span className="text-emerald-700">Proveedor:</span> <span className="font-semibold text-emerald-950">{parsed.provider}</span>
        <span className="text-emerald-700">Fecha:</span> <span className="font-semibold text-emerald-950">{new Date(parsed.date).toLocaleDateString()}</span>
        <span className="text-emerald-700">Total:</span> <span className="font-semibold text-emerald-950">{formatCurrency(parsed.totalAmount)}</span>
      </div>
      
      {/* Asignación Contable */}
      <div className="mt-3 space-y-2 border-t border-emerald-200/60 pt-2">
        <div>
          <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">Cuenta Contable</label>
          <select 
            value={accountId} 
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded border-emerald-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:ring-emerald-500"
          >
            <option value="">Seleccione cuenta...</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">Centro de Costo / Lote</label>
          <select 
            value={costCenterId} 
            onChange={(e) => setCostCenterId(e.target.value)}
            disabled={!accountId}
            className="w-full rounded border-emerald-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:ring-emerald-500 disabled:opacity-60"
          >
            {selectedAccount?.type === 'OPEX_DIRECT' ? (
              <option value="">Seleccione Lote (Obligatorio)</option>
            ) : (
              <option value="">General (Sin asignar)</option>
            )}
            {filteredCostCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {parsed.items.length > 0 && (
        <div className="mt-2 pt-2 border-t border-emerald-200/60">
          <p className="text-emerald-700 mb-1 font-medium">Ítems identificados:</p>
          <ul className="space-y-1">
            {parsed.items.map((item, idx) => (
              <li key={idx} className="flex justify-between border-b border-emerald-200/30 pb-1 last:border-0 last:pb-0">
                <span className="truncate pr-2 w-[70%]">{item.originalName}</span>
                <span className="font-semibold text-emerald-950">{item.quantity} un.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-emerald-200">
        <button
          onClick={handleConfirm}
          className="flex-1 flex justify-center items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-1.5 px-3 text-xs font-medium transition-colors shadow-sm"
        >
          <Check className="h-3 w-3" />
          Aprobar
        </button>
        <button
          onClick={() => onCancel(msgId)}
          className="flex-1 flex justify-center items-center gap-1 bg-white hover:bg-gray-50 text-gray-700 rounded-md py-1.5 px-3 text-xs font-medium transition-colors border border-emerald-200 shadow-sm"
        >
          <Trash2 className="h-3 w-3" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppCopilot() {
  const isCopilotOpen = useAgriStore((s) => s.isCopilotOpen);
  const chatMessages = useAgriStore((s) => s.chatMessages);
  const paddocks = useAgriStore((s) => s.paddocks);
  const crops = useAgriStore((s) => s.crops);
  const inventory = useAgriStore((s) => s.inventory);
  const toggleCopilot = useAgriStore((s) => s.toggleCopilot);
  const addChatMessage = useAgriStore((s) => s.addChatMessage);
  const addActivity = useAgriStore((s) => s.addActivity);
  const addTransaction = useAgriStore((s) => s.addTransaction);
  const updatePaddockNDVI = useAgriStore((s) => s.updatePaddockNDVI);
  const user = useAgriStore((s) => s.user);
  const setAuthModalOpen = useAgriStore((s) => s.setAuthModalOpen);
  const setPartialAction = useAgriStore((s) => s.setPartialAction);

  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isCopilotOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isCopilotOpen]);

  // Handle confirmation of a pending activity
  const confirmPendingAction = useCallback(async (messageId: string, action: PendingActivity, explicitAccountId?: string, explicitCostCenterId?: string | null) => {
    if (!user) {
      addChatMessage({ 
        role: 'assistant', 
        content: '⚠️ Debes iniciar sesión en el sistema para registrar operaciones. Por favor, ingresa a tu cuenta y vuelve a confirmar la actividad.',
        showLoginButton: true
      });
      setAuthModalOpen(true);
      return;
    }

    // Optimistically update message to remove pending action
    const messages = useAgriStore.getState().chatMessages;
    useAgriStore.setState({
      chatMessages: messages.map(m => m.id === messageId ? { ...m, pendingAction: undefined } : m)
    });

    setPartialAction(null);
    const responsibleName = user.user_metadata?.full_name || user.email || 'Usuario';

    if (action.type === 'NDVI_UPDATE') {
      if (action.paddockId && action.ndviValue !== undefined) {
        try {
          await updatePaddockNDVI(action.paddockId, action.ndviValue);
          addChatMessage({ role: 'assistant', content: `✅ NDVI actualizado exitosamente por **${responsibleName}**.` });
        } catch (error: any) {
          addChatMessage({ role: 'assistant', content: `❌ **Error al actualizar NDVI:** ${error?.message || JSON.stringify(error)}` });
        }
      }
    } else if (action.type === 'INVOICE_CONFIRMATION') {
      try {
        const parsed = action.parsedInvoice;
        if (!parsed) throw new Error('No se encontraron datos de la factura escaneada.');
        
        await addTransaction({
          date: new Date(parsed.date).toISOString(),
          description: parsed.provider,
          accountId: explicitAccountId || '', // Requiere la cuenta pasada desde la InvoiceCard
          costCenterId: explicitCostCenterId || null,
          amount: parsed.totalAmount,
          type: 'EXPENSE',
          receiptUrl: parsed.receiptUrl,
          items: parsed.items.map(item => ({
            id: Math.random().toString(36).substring(2),
            transactionId: '',
            inventoryItemId: item.inventoryItemId,
            description: item.originalName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          }))
        });
        
        addChatMessage({ role: 'assistant', content: `✅ Factura de **${parsed.provider}** aprobada. Compra registrada exitosamente y el stock físico del Pañol fue actualizado.` });
      } catch (error: any) {
        addChatMessage({ role: 'assistant', content: `❌ **Error al registrar factura:** ${error?.message || JSON.stringify(error)}` });
      }
    } else {
      try {
        const state = useAgriStore.getState();
        const matchedType = state.activityTypes.find(
          (t) => t.name.toLowerCase() === action.type.toLowerCase()
        );

        const activityPayload = {
          type: matchedType ? matchedType.name : action.type,
          activityTypeId: matchedType ? matchedType.id : undefined,
          farmId: state.currentFarmId,
          paddockId: action.paddockId || null,
          date: action.date.includes('T') ? action.date : `${action.date}T${new Date().toISOString().split('T')[1]}`,
          responsible: responsibleName,
          inputsConsumed: action.inputsConsumed,
          notes: action.notes,
          rainfallMm: action.rainfallMm,
          appliedArea: action.appliedArea
        };

        await addActivity(activityPayload);
        addChatMessage({ role: 'assistant', content: `✅ ${action.type} registrada exitosamente. Responsable: **${responsibleName}**.` });
      } catch (error: any) {
        const errorMsg = error?.message || error?.details || JSON.stringify(error);
        addChatMessage({ role: 'assistant', content: `❌ **Error al guardar en la base de datos:** ${errorMsg}` });
      }
    }
  }, [addActivity, updatePaddockNDVI, addTransaction, addChatMessage, user, setAuthModalOpen, setPartialAction]);

  const cancelPendingAction = useCallback((messageId: string) => {
    const messages = useAgriStore.getState().chatMessages;
    useAgriStore.setState({
      chatMessages: messages.map(m => m.id === messageId ? { ...m, pendingAction: undefined } : m)
    });
    setPartialAction(null);
    addChatMessage({ role: 'assistant', content: 'Acción cancelada.' });
  }, [addChatMessage, setPartialAction]);

  // ── NLP Engine & File Upload ────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    addChatMessage({ role: 'user', content: `[📷 Archivo adjunto: ${file.name}]` });
    setIsProcessing(true);
    addChatMessage({
      role: 'assistant',
      content: 'Escaneando comprobante con IA... 🤖',
      isProcessing: true,
    });

    try {
      let receiptUrl: string | null = null;
      if (supabase) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
        if (!uploadError) {
          const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
          receiptUrl = data.publicUrl;
        }
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          const currentState = useAgriStore.getState();
          const parsed = await parseInvoiceImage(base64String, file.type, currentState.inventory);
          
          parsed.receiptUrl = receiptUrl;

          const messagesAfterProcess = useAgriStore.getState().chatMessages;
          useAgriStore.setState({ chatMessages: messagesAfterProcess.filter((m) => !(m.isProcessing === true)) });

          addChatMessage({
            role: 'assistant',
            content: `¡Listo! Escaneé la factura de **${parsed.provider}**. \nPor favor, seleccioná la cuenta contable y confirmá el registro.`,
            pendingAction: {
              type: 'INVOICE_CONFIRMATION',
              date: new Date().toISOString(),
              notes: '',
              inputsConsumed: [],
              parsedInvoice: parsed,
            }
          });
        } catch (err: any) {
          const msgs = useAgriStore.getState().chatMessages;
          useAgriStore.setState({ chatMessages: msgs.filter((m) => !(m.isProcessing === true)) });
          addChatMessage({ role: 'assistant', content: `❌ Error al analizar la imagen: ${err.message}` });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsProcessing(false);
    }
  };

  const processInput = useCallback(
    async (input: string) => {
      const currentState = useAgriStore.getState();
      const currentChatHistory = currentState.chatMessages;

      const isConfirmWord = /^(sí|si|sipi|dale|ok|okis|correcto|confirmar|perfecto|se|obvio|claro|mandale|de una)$/i.test(input.trim());
      if (isConfirmWord) {
        const lastMsg = [...currentChatHistory].reverse().find(m => m.role === 'assistant');
        // Solo confirmamos automáticamente si no es invoice (porque invoice necesita selectores ahora)
        if (lastMsg && lastMsg.pendingAction && lastMsg.pendingAction.type !== 'INVOICE_CONFIRMATION') {
          addChatMessage({ role: 'user', content: input });
          await confirmPendingAction(lastMsg.id, lastMsg.pendingAction);
          return;
        }
      }

      addChatMessage({ role: 'user', content: input });
      addChatMessage({
        role: 'assistant',
        content: isGeminiConfigured ? 'agroCopilot está pensando... 🤖' : 'Procesando...',
        isProcessing: true,
      });
      setIsProcessing(true);

      try {
        const inventory = currentState.inventory;
        const currentPartialAction = currentState.partialAction;

        const result = await processWithGemini(
          input,
          currentChatHistory,
          paddocks,
          inventory,
          crops,
          currentPartialAction
        );

        const messagesAfterProcess = useAgriStore.getState().chatMessages;
        const filtered = messagesAfterProcess.filter((m) => !(m.isProcessing === true));
        useAgriStore.setState({ chatMessages: filtered });

        if (result.message === 'INVENTORY_REQUEST') {
          const belowMin = inventory.filter((item) => item.currentStock < item.minimumStock);
          let statusText = '📦 **Estado del Inventario:**\n\n';
          inventory.forEach((item) => {
            const isCritical = item.currentStock < item.minimumStock;
            const indicator = isCritical ? '🔴' : '🟢';
            statusText += `${indicator} ${item.name}: ${formatNumber(item.currentStock)} ${item.unit}`;
            if (isCritical) {
              statusText += ` ⚠️ (mín: ${formatNumber(item.minimumStock)})`;
            }
            statusText += '\n';
          });
          if (belowMin.length > 0) {
            statusText += `\n⚠️ ${belowMin.length} item(s) por debajo del stock mínimo.`;
          } else {
            statusText += '\n✅ Todos los insumos están por encima del stock mínimo.';
          }
          const totalValue = inventory.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0);
          statusText += `\n\n💰 Valor total: ${formatCurrency(totalValue)}`;
          
          addChatMessage({ role: 'assistant', content: statusText });
          setPartialAction(null);
        } else {
          addChatMessage({ 
            role: 'assistant', 
            content: result.message,
            pendingAction: result.pendingAction
          });
          setPartialAction(result.nextPartialAction !== undefined ? result.nextPartialAction : null);
        }
      } catch (error) {
        console.error('[agroCopilot] Error en processInput:', error);
        const messagesAfterError = useAgriStore.getState().chatMessages;
        const filtered = messagesAfterError.filter((m) => !(m.isProcessing === true));
        useAgriStore.setState({ chatMessages: filtered });
        addChatMessage({
          role: 'assistant',
          content: '❌ Hubo un error al procesar tu mensaje. Por favor, intentá de nuevo.',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [addChatMessage, paddocks, crops, setPartialAction, confirmPendingAction]
  );

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isProcessing) return;
    setInputValue('');
    processInput(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isCopilotOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[49] bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={toggleCopilot}
      />

      <style>{`
        @keyframes copilot-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @keyframes copilot-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div
        className="fixed right-0 top-0 z-[50] flex h-full w-96 flex-col bg-gray-100 shadow-2xl md:w-[420px]"
        style={{ animation: 'copilot-slide-in 0.3s ease-out' }}
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              agroCopilot AI
              {isGeminiConfigured && (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200 border border-emerald-400/40 shadow-sm animate-pulse">
                  Gemini Activo 🤖
                </span>
              )}
            </h2>
            <p className="text-xs text-emerald-100">
              Asistente Agrícola Inteligente
            </p>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            title="Ajustes de agroCopilot AI"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={toggleCopilot}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        >
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="flex flex-col gap-3">
              {chatMessages.map((msg) => {
                if (msg.role === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="rounded-lg bg-white/80 px-3 py-1 text-center text-xs text-gray-500 shadow-sm">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      isUser ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'relative max-w-[85%] px-3.5 py-2.5 shadow-sm',
                        isUser
                          ? 'rounded-2xl rounded-br-sm bg-emerald-500 text-white'
                          : 'rounded-2xl rounded-bl-sm bg-white text-gray-800'
                      )}
                    >
                      {msg.isProcessing ? (
                        <TypingDots />
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content}
                          </p>
                          {msg.showLoginButton && (
                            <button
                              onClick={() => setAuthModalOpen(true)}
                              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-xs font-semibold shadow transition-colors"
                            >
                              Conectar / Iniciar Sesión
                            </button>
                          )}
                        </>
                      )}

                      <p
                        className={cn(
                          'mt-1 text-right text-[10px]',
                          isUser ? 'text-emerald-100' : 'text-gray-400'
                        )}
                      >
                        {formatMessageTime(msg.timestamp)}
                      </p>
                      
                      {msg.pendingAction && !isUser && (
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          
                          {/* ─── Tarjeta Resumen de Factura OCR con Dropdowns ─── */}
                          {msg.pendingAction.type === 'INVOICE_CONFIRMATION' ? (
                            <InvoiceCard 
                              pendingAction={msg.pendingAction} 
                              msgId={msg.id} 
                              onConfirm={confirmPendingAction} 
                              onCancel={cancelPendingAction} 
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => confirmPendingAction(msg.id, msg.pendingAction!)}
                                className="flex-1 flex justify-center items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-1.5 px-3 text-xs font-medium transition-colors shadow-sm"
                              >
                                <Check className="h-3 w-3" />
                                Sí, confirmar
                              </button>
                              <button
                                onClick={() => cancelPendingAction(msg.id)}
                                className="flex-1 flex justify-center items-center gap-1 bg-white hover:bg-gray-50 text-gray-700 rounded-md py-1.5 px-3 text-xs font-medium transition-colors border border-gray-300 shadow-sm"
                              >
                                <Trash2 className="h-3 w-3" />
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Input Area ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,.pdf" 
                onChange={handleFileChange}
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-emerald-500 transition-colors shrink-0"
                title="Adjuntar Imagen / Factura"
                disabled={isProcessing}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí un mensaje..."
                disabled={isProcessing}
                className={cn(
                  'flex-1 min-w-0 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200',
                  'focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100',
                  isProcessing && 'cursor-not-allowed opacity-60'
                )}
              />
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isProcessing}
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200',
                  inputValue.trim() && !isProcessing
                    ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600 active:scale-95'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                )}
              >
                {inputValue.trim() ? (
                  <SendHorizontal className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AISettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
