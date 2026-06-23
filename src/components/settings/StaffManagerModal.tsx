import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Users } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import type { StaffMember } from '../../types';

interface StaffManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StaffManagerModal({ isOpen, onClose }: StaffManagerModalProps) {
  const { staff, addStaff, updateStaff, deleteStaff } = useAgriStore();
  const [editingItem, setEditingItem] = useState<StaffMember | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('Operario');
  const [phone, setPhone] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateStaff(editingItem.id, { firstName, lastName, role, phone });
      } else {
        await addStaff({ firstName, lastName, role, phone });
      }
      resetForm();
    } catch (err) {
      console.error('Error saving staff:', err);
      alert('Error al guardar el operario.');
    }
  };

  const handleEdit = (item: StaffMember) => {
    setEditingItem(item);
    setFirstName(item.firstName);
    setLastName(item.lastName);
    setRole(item.role);
    setPhone(item.phone || '');
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este operario?')) {
      await deleteStaff(id);
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFirstName('');
    setLastName('');
    setRole('Operario');
    setPhone('');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">Gestionar Personal</h2>
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
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Plantilla Actual</h3>
            {staff.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No hay operarios registrados.</p>
            ) : (
              staff.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm hover:border-emerald-100 transition-all">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{item.firstName} {item.lastName}</p>
                    <p className="text-xs text-gray-500">{item.role}</p>
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
              {editingItem ? 'Editar Operario' : 'Nuevo Operario'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Apellido</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Rol / Cargo</label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Ej. Tractorista, Encargado..."
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Teléfono (Opcional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
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
