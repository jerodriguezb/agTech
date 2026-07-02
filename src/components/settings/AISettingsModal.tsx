import React, { useState, useEffect } from 'react';
import { X, Sparkles, Lock, Unlock, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn } from '../../lib/utils';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const userRole = useAgriStore((s) => s.userRole);
  const inventory = useAgriStore((s) => s.inventory);
  const customSystemPrompt = useAgriStore((s) => s.customSystemPrompt);
  const customAliases = useAgriStore((s) => s.customAliases);
  const updateSystemPrompt = useAgriStore((s) => s.updateSystemPrompt);
  const updateAliases = useAgriStore((s) => s.updateAliases);

  // Solo Administrador / Gerente ('owner') tiene permisos de modificación
  const isAdmin = userRole === 'owner';

  // Estados locales para el formulario
  const [promptText, setPromptText] = useState('');
  const [aliasList, setAliasList] = useState<{ alias: string; targetName: string }[]>([]);
  const [isTechnicalExpanded, setIsTechnicalExpanded] = useState(false);
  const [newAliasKey, setNewAliasKey] = useState('');
  const [newAliasVal, setNewAliasVal] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prompt predeterminado en código para mostrar como placeholder/restablecer
  const defaultPrompt = `Sos agroCopilot, un asistente agrícola inteligente para gestión de campo en Argentina.
Hablás en español argentino de manera muy natural, humana, amigable e informal (usá "vos", tildes rioplatenses, "che" de vez en cuando, de forma cálida). Queremos humanizar la carga de datos del campo, haciendo que se sienta como charlar con un colega o compañero de trabajo, no como llenar un formulario robótico o frío. Usá emojis con moderación pero con buena onda.

## TU ROL
Ayudás a registrar labores de campo (Siembra, Pulverización, Fertilización, Cosecha, Riego, Lluvia), actualizar NDVI de lotes, y consultar el inventario de insumos.`;

  // Cargar datos del store cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPromptText(customSystemPrompt || defaultPrompt);
      
      // Convertir el record de alias en array para manipularlo en la UI
      const list = Object.entries(customAliases).map(([key, val]) => ({
        alias: key,
        targetName: val,
      }));
      setAliasList(list);
      setNewAliasKey('');
      setNewAliasVal(inventory[0]?.name || '');
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, customSystemPrompt, customAliases, inventory]);

  if (!isOpen) return null;

  // Añadir un alias temporal a la lista local
  const handleAddAlias = (e: React.FormEvent) => {
    e.preventDefault();
    const key = newAliasKey.trim().toLowerCase();
    if (!key) return;
    if (aliasList.some((item) => item.alias === key)) {
      setErrorMsg(`El alias "${key}" ya está registrado.`);
      return;
    }
    setAliasList([...aliasList, { alias: key, targetName: newAliasVal }]);
    setNewAliasKey('');
    setErrorMsg(null);
  };

  // Remover un alias de la lista local
  const handleRemoveAlias = (index: number) => {
    setAliasList(aliasList.filter((_, i) => i !== index));
  };

  // Restablecer valores de fábrica (default)
  const handleReset = async () => {
    if (!isAdmin) return;
    if (confirm('¿Estás seguro de restablecer el prompt y los alias por defecto? Esto borrará tus cambios guardados.')) {
      setSaveLoading(true);
      try {
        await updateSystemPrompt(null);
        
        const initialAliases = {
          'gasoil': 'Gasoil Grado 3',
          'gas-oil': 'Gasoil Grado 3',
          'combustible': 'Gasoil Grado 3',
          'diesel': 'Gasoil Grado 3',
          'glifosato': 'Glifosato 66.2%',
          'glifo': 'Glifosato 66.2%',
          '2,4-d': '2,4-D Éster 100%',
          '2.4-d': '2,4-D Éster 100%',
          '24d': '2,4-D Éster 100%',
          'urea': 'Urea Granulada 46-0-0',
          'uan': 'Fertilizante UAN 32%',
          'semilla de soja': 'Semilla Soja DM40R16',
          'semilla soja': 'Semilla Soja DM40R16',
          'semilla de maiz': 'Semilla Híbrida Maíz DK72',
          'semilla de maíz': 'Semilla Híbrida Maíz DK72',
          'semilla maiz': 'Semilla Híbrida Maíz DK72',
          'semilla maíz': 'Semilla Híbrida Maíz DK72',
        };
        await updateAliases(initialAliases);
        
        setPromptText(defaultPrompt);
        setAliasList(Object.entries(initialAliases).map(([key, val]) => ({ alias: key, targetName: val })));
        setSuccessMsg('Configuración restablecida con éxito.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setErrorMsg('Error al restablecer valores por defecto: ' + err.message);
      } finally {
        setSaveLoading(false);
      }
    }
  };

  // Guardar configuración en store / localstorage
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaveLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const finalPrompt = promptText.trim() === defaultPrompt.trim() ? null : promptText.trim();
      await updateSystemPrompt(finalPrompt);

      // Convertir el array de alias de vuelta a un Record
      const nextAliases: Record<string, string> = {};
      aliasList.forEach((item) => {
        nextAliases[item.alias] = item.targetName;
      });
      await updateAliases(nextAliases);

      setSuccessMsg('¡Configuración guardada exitosamente!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg('Error al guardar la configuración: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-bounce-in">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Configuración de agroCopilot AI</h2>
              <p className="text-xs text-emerald-100/90">Instrucciones base y diccionario de jerga</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Mensajes de feedback */}
          {successMsg && (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800">
              <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-800">
              <AlertCircle className="h-4.5 w-4.5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Banner de Estado de Permisos */}
          {isAdmin ? (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200/80 p-4 text-xs text-emerald-850">
              <Unlock className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase tracking-wide text-emerald-800 text-[10px] mb-0.5">Modo Administrador / Gerente</span>
                Tenés acceso total de edición sobre las directivas del asistente y el diccionario de jerga. Los cambios se guardarán de forma persistente en la base de datos.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-850">
              <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase tracking-wide text-amber-800 text-[10px] mb-0.5">
                  Modo {userRole === 'manager' ? 'Encargado de Campo' : userRole === 'accountant' ? 'Administrativo / Contador' : userRole === 'agronomist' ? 'Técnico / Agrónomo' : userRole === 'operator' ? 'Operario' : 'Invitado'} (Solo Lectura)
                </span>
                Tu perfil actual no posee permisos para modificar el comportamiento base del asistente de IA. Comunícate con el Propietario del establecimiento para solicitar cambios.
              </div>
            </div>
          )}

          {/* Sección 1: Instrucciones base (Prompt) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                Directivas del Sistema (Personalidad y Tono)
              </label>
              {!customSystemPrompt && (
                <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded">
                  Predeterminado
                </span>
              )}
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={!isAdmin || saveLoading}
              rows={6}
              className={cn(
                "w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100",
                (!isAdmin || saveLoading) && "bg-gray-50 text-gray-400 cursor-not-allowed"
              )}
              placeholder="Escribe las directivas que agroCopilot debe seguir..."
            />
          </div>

          {/* Sección 2: Diccionario de Alias y Jerga */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                Diccionario de Jerga y Alias
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Asocia palabras coloquiales (ej. "combustible", "glifo") con insumos del inventario para que el NLP las entienda automáticamente.
              </p>
            </div>

            {/* Formulario para añadir alias (Solo Admin) */}
            {isAdmin && (
              <form onSubmit={handleAddAlias} className="flex gap-2 items-end bg-gray-50 p-3 rounded-xl border border-gray-200/60">
                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Alias o Jerga</label>
                  <input
                    type="text"
                    value={newAliasKey}
                    onChange={(e) => setNewAliasKey(e.target.value)}
                    placeholder="Ej: gas-oil, urea, glifo"
                    disabled={saveLoading}
                    className="w-full rounded-lg border border-gray-200 py-1.5 px-3 text-xs outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-gray-400">Insumo Real</label>
                  <select
                    value={newAliasVal}
                    onChange={(e) => setNewAliasVal(e.target.value)}
                    disabled={saveLoading}
                    className="w-full rounded-lg border border-gray-200 py-1.5 px-2.5 text-xs outline-none focus:border-emerald-500 bg-white"
                  >
                    {inventory.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!newAliasKey.trim() || saveLoading}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white p-2 transition-colors flex items-center justify-center h-8.5 w-8.5 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Listado de Alias actuales */}
            <div className="rounded-xl border border-gray-200 max-h-48 overflow-y-auto divide-y divide-gray-100 bg-white">
              {aliasList.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 italic">
                  No hay sinónimos agregados. Se usará el mapeo estándar.
                </div>
              ) : (
                aliasList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50/50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5">
                        "{item.alias}"
                      </span>
                      <span className="text-gray-400">mapea a</span>
                      <span className="font-medium text-gray-700">{item.targetName}</span>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAlias(idx)}
                        disabled={saveLoading}
                        className="text-gray-400 hover:text-red-500 rounded p-1 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sección 3: Directivas Técnicas (Acordeón de Solo Lectura) */}
          <div className="border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setIsTechnicalExpanded(!isTechnicalExpanded)}
              className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span>Directivas Técnicas obligatorias (Solo Lectura)</span>
              {isTechnicalExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            
            {isTechnicalExpanded && (
              <div className="mt-2.5 rounded-xl border border-gray-150 bg-slate-900 text-slate-300 p-3 text-[11px] font-mono leading-relaxed max-h-48 overflow-y-auto">
                <span className="text-gray-500">// La IA concatena esta sección obligatoria al final del prompt para mantener la integración:</span>
                <pre className="mt-1 whitespace-pre-wrap">{`## LOTES DISPONIBLES EN EL CAMPO
- Lote Norte (280 ha)
- Lote Sur (220 ha)
...

## REGLAS DE NEGOCIO ESTRICTAS
1. Validación de Lotes.
2. Validación de Insumos.
3. Formato JSON: Respondé siempre y únicamente en formato JSON con la estructura: { message, intent, ready_to_confirm, activity }.`}</pre>
              </div>
            )}
          </div>

        </div>

        {/* Footer de Acciones */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saveLoading}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", saveLoading && "animate-spin")} />
                Restablecer predeterminado
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saveLoading}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Cerrar
            </button>
            {isAdmin && (
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saveLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {saveLoading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
