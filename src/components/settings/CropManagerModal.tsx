import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Loader2, Sparkles } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import type { Crop } from '../../types';
import { cn } from '../../lib/utils';

interface CropManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

export default function CropManagerModal({ isOpen, onClose }: CropManagerModalProps) {
  const crops = useAgriStore((s) => s.crops);
  const addCrop = useAgriStore((s) => s.addCrop);
  const updateCrop = useAgriStore((s) => s.updateCrop);
  const deleteCrop = useAgriStore((s) => s.deleteCrop);

  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [targetNdvi, setTargetNdvi] = useState(0.7);
  const [marketPriceUsdTon, setMarketPriceUsdTon] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingCrop(null);
    setShowForm(false);
    setName('');
    setVariety('');
    setColor(PRESET_COLORS[0]);
    setTargetNdvi(0.7);
    setMarketPriceUsdTon('');
    setError('');
    setDeleteConfirmId(null);
  };

  const handleEdit = (crop: Crop) => {
    setEditingCrop(crop);
    setName(crop.name);
    setVariety(crop.variety);
    setColor(crop.color);
    setTargetNdvi(crop.targetNdvi || 0.7);
    setMarketPriceUsdTon(crop.marketPriceUsdTon?.toString() || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError('');
    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      variety: variety.trim() || 'Genérico',
      color,
      targetNdvi,
      marketPriceUsdTon: marketPriceUsdTon ? Number(marketPriceUsdTon) : undefined,
      plantingDate: null,
      expectedHarvestDate: null,
      cycleLength: 120,
    };

    try {
      if (editingCrop) {
        await updateCrop(editingCrop.id, payload);
      } else {
        // Check duplication
        const duplicate = crops.find(c => c.name.toLowerCase() === payload.name.toLowerCase());
        if (duplicate) {
          throw new Error('Ya existe un cultivo registrado con este nombre.');
        }
        await addCrop(payload);
      }
      resetForm();
    } catch (err: any) {
      console.error('Error saving crop:', err);
      setError(err.message || 'Error al guardar el cultivo. Asegúrate de tener permisos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      await deleteCrop(id);
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error('Error deleting crop:', err);
      setError(err.message || 'Error al eliminar el cultivo. Podría estar asignado a un lote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-0">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Catálogo de Cultivos</h2>
              <p className="text-sm text-slate-500">Configurá las variedades y sus perfiles de NDVI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              {error}
            </div>
          )}

          {!showForm && (
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo Cultivo
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="mb-4 font-semibold text-slate-700">
                {editingCrop ? 'Editar Cultivo' : 'Crear Nuevo Cultivo'}
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Nombre del Cultivo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Maíz Tardío, Cebada"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Clasificación / Grupo</label>
                    <input
                      type="text"
                      placeholder="Ej. Grano, Forraje, Cobertura"
                      value={variety}
                      onChange={(e) => setVariety(e.target.value)}
                      className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                    />
                  </div>
                </div>

                {/* Color Picker presets */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Color Cartográfico (Mapa)</label>
                  <div className="flex flex-wrap gap-2.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-transform",
                          color === c ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"
                        )}
                      />
                    ))}
                    {/* Custom Hex input */}
                    <div className="flex items-center border border-slate-300 rounded-lg px-2 bg-white">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-6 h-6 border-0 p-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={color.toUpperCase()}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-20 text-xs font-mono border-0 focus:ring-0 p-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Target NDVI slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-slate-700">NDVI Objetivo esperado</label>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {(targetNdvi || 0).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={targetNdvi}
                    onChange={(e) => setTargetNdvi(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Suelo Desnudo (0.1)</span>
                    <span>Pleno Crecimiento (0.6)</span>
                    <span>Máxima Biomasa (0.9)</span>
                  </div>
                </div>

                {/* Market Price */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Precio Estimado de Venta (USD/Ton) <span className="font-normal opacity-70">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={marketPriceUsdTon}
                    onChange={(e) => setMarketPriceUsdTon(e.target.value)}
                    placeholder="Ej. 380"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCrop ? 'Guardar Cambios' : 'Registrar'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* List crops */}
          <div className="space-y-2">
            {crops.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <p className="text-slate-500 font-medium">No hay cultivos registrados</p>
              </div>
            ) : (
              crops.map((crop) => (
                <div
                  key={crop.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full shadow-inner shrink-0"
                      style={{ backgroundColor: crop.color }}
                    />
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{crop.name}</h4>
                      <p className="text-xs text-slate-500">
                        Variedad: {crop.variety} • NDVI objetivo: {crop.targetNdvi || 0.7}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {deleteConfirmId === crop.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-rose-600 font-semibold">¿Confirmás?</span>
                        <button
                          onClick={() => handleDelete(crop.id)}
                          disabled={isSubmitting}
                          className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-2 py-1 rounded"
                        >
                          Sí, borrar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-2 py-1 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(crop)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(crop.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
