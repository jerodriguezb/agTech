import { useState } from 'react';
import { X, Map as MapIcon, Plus, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import PaddockModal from './PaddockModal';
import { formatHectares, formatDate, ndviToColor } from '../../lib/utils';
import type { Paddock } from '../../types';

interface PaddockManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaddockManagerModal({ isOpen, onClose }: PaddockManagerModalProps) {
  const paddocks = useAgriStore((s) => s.paddocks);
  const crops = useAgriStore((s) => s.crops);
  const { addPaddock, updatePaddock, deletePaddock } = useAgriStore();

  const [isPaddockModalOpen, setIsPaddockModalOpen] = useState(false);
  const [editingPaddock, setEditingPaddock] = useState<Paddock | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSavePaddock = async (data: Partial<Paddock>) => {
    if (editingPaddock) {
      await updatePaddock(editingPaddock.id, data);
    } else {
      await addPaddock(data as any);
    }
  };

  const handleEdit = (paddock: Paddock) => {
    setEditingPaddock(paddock);
    setIsPaddockModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este lote? Esta acción también puede eliminar actividades asociadas.')) {
      await deletePaddock(id);
    }
    setActiveMenuId(null);
  };

  const getCropDetails = (cropId: string | null) => {
    if (!cropId) return { name: 'Sin asignar', color: '#6B7280' };
    const crop = crops.find((c) => c.id === cropId);
    return crop ? { name: crop.name, color: crop.color } : { name: 'Desconocido', color: '#6B7280' };
  };

  return (
    <>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-0">
        <div className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                <MapIcon className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">
                  Administrador de Lotes
                </h2>
                <p className="text-sm text-gray-500">
                  {paddocks.length} lotes registrados en el establecimiento
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingPaddock(null);
                  setIsPaddockModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                Nuevo Lote
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body / List */}
          <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paddocks.map((p) => {
                const cropInfo = getCropDetails(p.cropId);
                const ndviColor = ndviToColor(p.ndvi);

                return (
                  <div
                    key={p.id}
                    className="group relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-emerald-100"
                  >
                    {/* Header Card */}
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <h3 className="text-base font-semibold leading-tight text-gray-900">
                          {p.name}
                        </h3>
                        <span className="mt-1 text-sm text-gray-500">
                          {formatHectares(p.area)}
                        </span>
                      </div>

                      {/* Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {activeMenuId === p.id && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                            <div className="py-1">
                              <button
                                onClick={() => handleEdit(p)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Edit2 className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3 border-t border-gray-50 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Cultivo</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cropInfo.color }}
                          />
                          {cropInfo.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">NDVI</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: ndviColor }}
                          />
                          {p.ndvi.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Actualizado</span>
                        <span className="text-xs font-medium text-gray-600">
                          {formatDate(p.lastUpdated)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {paddocks.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <MapIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">No hay lotes</h3>
                  <p className="mt-1 text-sm text-gray-500">Comienza creando tu primer lote usando coordenadas GeoJSON.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaddockModal
        isOpen={isPaddockModalOpen}
        onClose={() => {
          setIsPaddockModalOpen(false);
          setEditingPaddock(null);
        }}
        onSave={handleSavePaddock}
        editingPaddock={editingPaddock}
      />
    </>
  );
}
