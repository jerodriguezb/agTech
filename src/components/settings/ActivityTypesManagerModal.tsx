import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Activity as ActivityIcon } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import type { FarmActivityType } from '../../types';

interface ActivityTypesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PREDEFINED_COLORS = [
  '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B', '#EAB308', '#84CC16', '#14B8A6'
];

export default function ActivityTypesManagerModal({ isOpen, onClose }: ActivityTypesManagerModalProps) {
  const { activityTypes, addActivityType, updateActivityType, deleteActivityType } = useAgriStore();
  const [editingItem, setEditingItem] = useState<FarmActivityType | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('Activity'); // Default generic icon

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateActivityType(editingItem.id, { name, color, icon });
      } else {
        await addActivityType({ name, color, icon });
      }
      resetForm();
    } catch (err) {
      console.error('Error saving activity type:', err);
      alert('Error al guardar el tipo de actividad.');
    }
  };

  const handleEdit = (item: FarmActivityType) => {
    setEditingItem(item);
    setName(item.name);
    setColor(item.color);
    setIcon(item.icon);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este tipo de actividad? Las tareas anteriores la perderán.')) {
      await deleteActivityType(id);
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setName('');
    setColor('#10B981');
    setIcon('Activity');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <ActivityIcon className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-800">Tipos de Actividad</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* List */}
          <div className="w-full sm:w-1/2 border-r border-gray-100 overflow-y-auto p-4 space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Tipos Registrados</h3>
            {activityTypes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No hay tipos registrados.</p>
            ) : (
              activityTypes.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium text-sm text-gray-800">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(item)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Form */}
          <div className="w-full sm:w-1/2 p-6 bg-gray-50/50 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              {editingItem ? 'Editar Tipo' : 'Nuevo Tipo'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Nombre de Tarea</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Siembra, Riego, Cosecha..."
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">Color Representativo</label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                {editingItem && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  {editingItem ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
