import { useState, useRef, useEffect, useCallback } from 'react';
import { X, SendHorizontal, Leaf, Camera, Mic, Paperclip, Check, Trash2 } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn, formatCurrency, formatNumber } from '../../lib/utils';
import { processNaturalLanguage } from '../../lib/nlpEngine';
import type { PendingActivity } from '../../types';

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppCopilot() {
  const isCopilotOpen = useAgriStore((s) => s.isCopilotOpen);
  const chatMessages = useAgriStore((s) => s.chatMessages);
  const paddocks = useAgriStore((s) => s.paddocks);
  const toggleCopilot = useAgriStore((s) => s.toggleCopilot);
  const addChatMessage = useAgriStore((s) => s.addChatMessage);
  const addActivity = useAgriStore((s) => s.addActivity);
  const updatePaddockNDVI = useAgriStore((s) => s.updatePaddockNDVI);
  const user = useAgriStore((s) => s.user);
  const setAuthModalOpen = useAgriStore((s) => s.setAuthModalOpen);
  const partialAction = useAgriStore((s) => s.partialAction);
  const setPartialAction = useAgriStore((s) => s.setPartialAction);

  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  const confirmPendingAction = useCallback((messageId: string, action: PendingActivity) => {
    // Check if user is logged in
    if (!user) {
      addChatMessage({ 
        role: 'assistant', 
        content: '⚠️ Debes iniciar sesión en el sistema para registrar labores y cambios de NDVI. Por favor, ingresa a tu cuenta y vuelve a confirmar la actividad.',
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

    // Clear any partial action conversational states
    setPartialAction(null);

    const responsibleName = user.user_metadata?.full_name || user.email || 'Usuario';

    if (action.type === 'NDVI_UPDATE') {
      if (action.paddockId && action.ndviValue !== undefined) {
        updatePaddockNDVI(action.paddockId, action.ndviValue);
        addChatMessage({ role: 'assistant', content: `✅ NDVI actualizado exitosamente por **${responsibleName}**.` });
      }
    } else {
      addActivity({
        type: action.type,
        farmId: useAgriStore.getState().currentFarmId,
        paddockId: action.paddockId || null,
        date: action.date,
        responsible: responsibleName,
        inputsConsumed: action.inputsConsumed,
        notes: action.notes,
        rainfallMm: action.rainfallMm,
        appliedArea: action.appliedArea
      });
      addChatMessage({ role: 'assistant', content: `✅ ${action.type} registrada exitosamente. Responsable: **${responsibleName}**.` });
    }
  }, [addActivity, updatePaddockNDVI, addChatMessage, user, setAuthModalOpen, setPartialAction]);

  const cancelPendingAction = useCallback((messageId: string) => {
    const messages = useAgriStore.getState().chatMessages;
    useAgriStore.setState({
      chatMessages: messages.map(m => m.id === messageId ? { ...m, pendingAction: undefined } : m)
    });
    setPartialAction(null);
    addChatMessage({ role: 'assistant', content: 'Acción cancelada.' });
  }, [addChatMessage, setPartialAction]);

  // ── NLP Engine ────────────────────────────────────────────────────────

  const processInput = useCallback(
    (input: string) => {
      // 1. Add user message
      addChatMessage({ role: 'user', content: input });

      // 2. Add processing placeholder
      addChatMessage({
        role: 'assistant',
        content: 'El asistente está procesando...',
        isProcessing: true,
      });
      setIsProcessing(true);

      // 3. Simulate network delay (1000-1500ms)
      const delay = 1000 + Math.random() * 500;

      setTimeout(() => {
        const currentMessages = useAgriStore.getState().chatMessages;
        const filtered = currentMessages.filter((m) => !(m.isProcessing === true));
        useAgriStore.setState({ chatMessages: filtered });

        const inventory = useAgriStore.getState().inventory;
        const result = processNaturalLanguage(input, paddocks, inventory, partialAction);

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
        
        setIsProcessing(false);
      }, delay);
    },
    [addChatMessage, paddocks, partialAction, setPartialAction]
  );

  // ── Submit Handler ────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────

  if (!isCopilotOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[49] bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={toggleCopilot}
      />

      {/* Inline keyframes for bouncing dots */}
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

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-[50] flex h-full w-96 flex-col bg-gray-100 shadow-2xl md:w-[420px]"
        style={{ animation: 'copilot-slide-in 0.3s ease-out' }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">agroCopilot AI</h2>
            <p className="text-xs text-emerald-100">
              Asistente Agrícola Inteligente
            </p>
          </div>
          <button
            onClick={toggleCopilot}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── WhatsApp-style background pattern ───────────────────────── */}
        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        >
          {/* ── Messages Area ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="flex flex-col gap-3">
              {chatMessages.map((msg) => {
                // System messages
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
                      {/* Message content */}
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

                      {/* Timestamp */}
                      <p
                        className={cn(
                          'mt-1 text-right text-[10px]',
                          isUser ? 'text-emerald-100' : 'text-gray-400'
                        )}
                      >
                        {formatMessageTime(msg.timestamp)}
                      </p>
                      
                      {/* State Machine Confirmation Buttons */}
                      {msg.pendingAction && !isUser && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => confirmPendingAction(msg.id, msg.pendingAction!)}
                            className="flex-1 flex justify-center items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-1.5 px-3 text-xs font-medium transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            Sí, confirmar
                          </button>
                          <button
                            onClick={() => cancelPendingAction(msg.id)}
                            className="flex-1 flex justify-center items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md py-1.5 px-3 text-xs font-medium transition-colors border border-gray-300"
                          >
                            <Trash2 className="h-3 w-3" />
                            Cancelar
                          </button>
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
              <button 
                type="button" 
                className="text-gray-400 hover:text-emerald-500 transition-colors"
                title="Adjuntar Imagen / Foto"
              >
                <Camera className="h-5 w-5" />
              </button>
              <button 
                type="button" 
                className="text-gray-400 hover:text-emerald-500 transition-colors"
                title="Adjuntar Archivo"
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
                  'flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200',
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
    </>
  );
}
