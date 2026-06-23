import { useState } from 'react';
import {
  ClipboardList,
  Sprout,
  Wheat,
  Droplets,
  FlaskConical,
  CloudRain,
  User,
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Plus,
  Trash2,
  X,
  Settings,
  Activity as ActivityIcon,
  Tractor,
  Waves,
  Beaker,
  Loader2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { useAgriStore } from '../store/useAgriStore';
import { cn, formatDateTime } from '../lib/utils';
import StaffManagerModal from '../components/settings/StaffManagerModal';
import ActivityTypesManagerModal from '../components/settings/ActivityTypesManagerModal';
import type { Activity } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────

export const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case 'Sprout': return Sprout;
    case 'Wheat': return Wheat;
    case 'Droplets': return Droplets;
    case 'FlaskConical': return FlaskConical;
    case 'Beaker': return Beaker;
    case 'CloudRain': return CloudRain;
    case 'Tractor': return Tractor;
    case 'Waves': return Waves;
    default: return ActivityIcon;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldTasksView() {
  const activities = useAgriStore((s) => s.activities);
  const paddocks = useAgriStore((s) => s.paddocks);
  const inventory = useAgriStore((s) => s.inventory);
  const staff = useAgriStore((s) => s.staff);
  const activityTypes = useAgriStore((s) => s.activityTypes);
  const currentFarmId = useAgriStore((s) => s.currentFarmId);
  const deleteActivity = useAgriStore((s) => s.deleteActivity);

  const [activeFilter, setActiveFilter] = useState<string | 'Todas'>('Todas');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Modals for CRUD
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);

  // Form states for manual activity registration
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activityTypeId, setActivityTypeId] = useState<string>('');
  const [paddockId, setPaddockId] = useState<string>('');
  const [date, setDate] = useState<string>(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .substring(0, 16)
  );
  const [staffId, setStaffId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [rainfallMm, setRainfallMm] = useState<string>('');
  const [selectedInputs, setSelectedInputs] = useState<
    Array<{ inventoryItemId: string; quantity: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lookup helpers
  const paddockMap = new Map(paddocks.map((p) => [p.id, p]));
  const inventoryMap = new Map(inventory.map((i) => [i.id, i]));

  const normalizeString = (str?: string) => {
    if (!str) return '';
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  // Filter and sort activities
  const filteredActivities = activities
    .filter((a) => {
      if (activeFilter === 'Todas') return true;
      if (a.activityTypeId === activeFilter) return true;
      const targetType = activityTypes.find((t) => t.id === activeFilter);
      if (targetType) {
        return normalizeString(a.type) === normalizeString(targetType.name);
      }
      return false;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const toggleExpanded = (activityId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const handleAddInput = () => {
    const firstItem = inventory[0]?.id || '';
    setSelectedInputs([...selectedInputs, { inventoryItemId: firstItem, quantity: 1 }]);
  };

  const handleRemoveInput = (idx: number) => {
    setSelectedInputs(selectedInputs.filter((_, i) => i !== idx));
  };

  const handleDeleteActivity = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta actividad? El stock de insumos consumido será restaurado automáticamente.')) {
      try {
        await deleteActivity(id);
      } catch (err) {
        console.error('Error al eliminar la actividad:', err);
        alert('Ocurrió un error al eliminar la actividad.');
      }
    }
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    
    const typeObj = activityTypes.find((t) => t.name === activity.type || t.id === activity.activityTypeId);
    const staffObj = staff.find((s) => `${s.firstName} ${s.lastName}`.trim() === activity.responsible || s.id === activity.staffId);
    
    setActivityTypeId(activity.activityTypeId || typeObj?.id || '');
    setPaddockId(activity.paddockId || '');
    
    const localDate = new Date(new Date(activity.date).getTime() - new Date(activity.date).getTimezoneOffset() * 60000)
      .toISOString()
      .substring(0, 16);
    setDate(localDate);
    
    setStaffId(activity.staffId || staffObj?.id || '');
    setNotes(activity.notes || '');
    setRainfallMm(activity.rainfallMm?.toString() || '');
    setSelectedInputs(
      activity.inputsConsumed.map((i) => ({
        inventoryItemId: i.inventoryItemId,
        quantity: i.quantity,
      }))
    );
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenRegisterModal = () => {
    setEditingActivity(null);
    setActivityTypeId('');
    setPaddockId('');
    setDate(
      new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .substring(0, 16)
    );
    setStaffId('');
    setNotes('');
    setRainfallMm('');
    setSelectedInputs([]);
    setError(null);
    setIsModalOpen(true);
  };

  const handleInputChange = (
    idx: number,
    field: 'inventoryItemId' | 'quantity',
    value: any
  ) => {
    setSelectedInputs(
      selectedInputs.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validar stock de insumos
      for (const input of selectedInputs) {
        const invItem = inventory.find((i) => i.id === input.inventoryItemId);
        if (!invItem) {
          throw new Error('Insumo no encontrado en el pañol.');
        }

        // Si estamos editando, sumar el stock previamente consumido por esta actividad
        let previousQuantity = 0;
        if (editingActivity) {
          const prevInput = editingActivity.inputsConsumed.find((i) => i.inventoryItemId === input.inventoryItemId);
          if (prevInput) {
            previousQuantity = prevInput.quantity;
          }
        }

        const adjustedStock = invItem.currentStock + previousQuantity;
        if (Number(input.quantity) > adjustedStock) {
          throw new Error(`No hay suficiente stock de ${invItem.name}. Stock disponible: ${adjustedStock} ${invItem.unit}.`);
        }
      }

      const inputs = selectedInputs.map((input) => {
        const invItem = inventory.find((i) => i.id === input.inventoryItemId);
        return {
          inventoryItemId: input.inventoryItemId,
          quantity: Number(input.quantity),
          unit: invItem?.unit || 'unidades',
        };
      });

      const selectedType = activityTypes.find(t => t.id === activityTypeId);
      const selectedStaff = staff.find(s => s.id === staffId);

      const activityData = {
        farmId: currentFarmId,
        paddockId: paddockId || null,
        activityTypeId: activityTypeId || null,
        type: selectedType ? selectedType.name : '',
        date: new Date(date).toISOString(),
        staffId: staffId || null,
        responsible: selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName}`.trim() : '',
        notes,
        rainfallMm: (selectedType?.name === 'Lluvia') && rainfallMm ? Number(rainfallMm) : undefined,
        inputsConsumed: inputs,
      };

      if (editingActivity) {
        const updateActivity = useAgriStore.getState().updateActivity;
        await updateActivity(editingActivity.id, activityData);
      } else {
        const addActivity = useAgriStore.getState().addActivity;
        await addActivity(activityData);
      }

      // Reset Form and close modal
      setIsModalOpen(false);
      setEditingActivity(null);
      setActivityTypeId('');
      setPaddockId('');
      setDate(
        new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .substring(0, 16)
      );
      setStaffId('');
      setNotes('');
      setRainfallMm('');
      setSelectedInputs([]);
    } catch (err: any) {
      console.error('Error al guardar actividad:', err);
      setError(err.message || 'Error al guardar la actividad en la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <ClipboardList className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Tareas de Campo
            </h1>
            <p className="text-sm text-gray-500">
              {activities.length} actividades registradas
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenRegisterModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Registrar Actividad
        </button>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveFilter('Todas')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
            activeFilter === 'Todas'
              ? 'bg-gray-900 text-white shadow-md'
              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300'
          )}
        >
          Todas
          <span
            className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              activeFilter === 'Todas'
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {activities.length}
          </span>
        </button>

        {activityTypes.map((typeObj) => {
          const Icon = getIconComponent(typeObj.icon);
          const count = activities.filter((a) => 
            a.activityTypeId === typeObj.id || 
            normalizeString(a.type) === normalizeString(typeObj.name)
          ).length;

          return (
            <button
              key={typeObj.id}
              onClick={() => setActiveFilter(typeObj.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                activeFilter === typeObj.id
                  ? 'shadow-md ring-1'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300'
              )}
              style={activeFilter === typeObj.id ? { backgroundColor: `${typeObj.color}15`, color: typeObj.color, boxShadow: `0 0 0 1px ${typeObj.color}40` } : {}}
            >
              <Icon className="h-3.5 w-3.5" />
              {typeObj.name}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    activeFilter === typeObj.id
                      ? 'bg-white/50'
                      : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      {filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16">
          <ClipboardList className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-400">
            No hay actividades para el filtro seleccionado
          </p>
        </div>
      ) : (
        <div className="relative ml-4">
          {/* Vertical timeline line */}
          <div className="absolute left-3.5 top-0 h-full w-0.5 bg-gradient-to-b from-gray-200 via-gray-200 to-transparent" />

          <div className="space-y-4">
            {filteredActivities.map((activity, index) => {
              const Icon = getIconComponent(activity.icon);
              const color = activity.color || '#10B981';
              const paddock = activity.paddockId
                ? paddockMap.get(activity.paddockId)
                : null;
              const isExpanded = expandedCards.has(activity.id);
              const hasInputs = activity.inputsConsumed.length > 0;
              const isLast = index === filteredActivities.length - 1;

              return (
                <div key={activity.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white"
                      style={{ backgroundColor: color }}
                    >
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>

                  {/* Activity card */}
                  <div
                    className={cn(
                      'flex-1 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md',
                      isLast ? 'mb-0' : ''
                    )}
                  >
                    {/* Card header */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{ backgroundColor: `${color}15`, color: color }}
                        >
                          <Icon className="h-3 w-3" />
                          {activity.type}
                        </span>
                        {activity.type === 'Lluvia' && activity.rainfallMm && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-bold text-white">
                            <CloudRain className="h-3 w-3" />
                            {activity.rainfallMm} mm
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <time className="text-xs font-medium text-gray-400">
                          {formatDateTime(activity.date)}
                        </time>
                        <button
                          onClick={() => handleEditActivity(activity)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          title="Editar actividad"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Eliminar actividad"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Location & responsible */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {paddock ? paddock.name : 'General (todo el campo)'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        {activity.responsible}
                      </span>
                    </div>

                    {/* Notes */}
                    {activity.notes && (
                      <p className="mt-3 text-sm leading-relaxed text-gray-600">
                        {activity.notes}
                      </p>
                    )}

                    {/* Collapsible inputs section */}
                    {hasInputs && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleExpanded(activity.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                        >
                          <Package className="h-3.5 w-3.5" />
                          Insumos utilizados ({activity.inputsConsumed.length})
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 text-left">
                                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Insumo
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Cantidad
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {activity.inputsConsumed.map((input, i) => {
                                  const item = inventoryMap.get(
                                    input.inventoryItemId
                                  );
                                  return (
                                    <tr key={i}>
                                      <td className="px-3 py-2 font-medium text-gray-700">
                                        {item
                                          ? item.name
                                          : input.inventoryItemId}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600">
                                        {input.quantity.toLocaleString('es-AR')}{' '}
                                        {input.unit}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal Overlay ────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl transition-all duration-300 flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-300" />
                <h2 className="text-lg font-bold tracking-tight">
                  {editingActivity ? 'Editar Actividad' : 'Registrar Actividad'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 flex-1">
              {/* Error Alert */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-100 mb-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo de Actividad */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Tipo de Actividad
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsTypesModalOpen(true)}
                      className="text-gray-400 hover:text-emerald-600 p-0.5 rounded-md hover:bg-emerald-50 transition-colors"
                      title="Administrar Tipos de Actividad"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <select
                    value={activityTypeId}
                    disabled={loading}
                    onChange={(e) => {
                      setActivityTypeId(e.target.value);
                    }}
                    required
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                  >
                    <option value="" disabled>Seleccione un tipo</option>
                    {activityTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Fecha y Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={date}
                    disabled={loading}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 py-2 px-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                  />
                </div>

                {/* Lote */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Lote
                  </label>
                  <select
                    value={paddockId}
                    disabled={loading}
                    onChange={(e) => setPaddockId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                  >
                    <option value="">General (todo el campo)</option>
                    {paddocks.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.area} ha)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Responsable */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Responsable
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsStaffModalOpen(true)}
                      className="text-gray-400 hover:text-emerald-600 p-0.5 rounded-md hover:bg-emerald-50 transition-colors"
                      title="Administrar Personal"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <select
                    value={staffId}
                    disabled={loading}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                  >
                    <option value="" disabled>Seleccione operario</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lluvia mm */}
              {activityTypes.find(t => t.id === activityTypeId)?.name === 'Lluvia' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Precipitación (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={rainfallMm}
                    disabled={loading}
                    onChange={(e) => setRainfallMm(e.target.value)}
                    required
                    placeholder="Milímetros de lluvia"
                    className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                  />
                </div>
              )}

              {/* Insumos Consumidos */}
              {activityTypes.find(t => t.id === activityTypeId)?.name !== 'Lluvia' && (
                <div className="space-y-2.5 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Insumos Utilizados
                    </label>
                    <button
                      type="button"
                      onClick={handleAddInput}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar Insumo
                    </button>
                  </div>

                  {selectedInputs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No se han seleccionado insumos para esta tarea.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedInputs.map((input, idx) => {
                        const invItem = inventory.find((i) => i.id === input.inventoryItemId);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={input.inventoryItemId}
                              disabled={loading}
                              onChange={(e) =>
                                handleInputChange(idx, 'inventoryItemId', e.target.value)
                              }
                              className="flex-1 rounded-xl border border-gray-200 py-2 px-2.5 text-xs text-gray-800 outline-none focus:border-emerald-500 disabled:opacity-50"
                            >
                              {inventory.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} (Stock: {item.currentStock} {item.unit})
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1.5 w-32 shrink-0">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={input.quantity}
                                disabled={loading}
                                onChange={(e) =>
                                  handleInputChange(idx, 'quantity', e.target.value)
                                }
                                required
                                className="w-full rounded-xl border border-gray-200 py-2 px-2.5 text-xs text-gray-800 text-right outline-none focus:border-emerald-500 disabled:opacity-50"
                              />
                              <span className="text-xs text-gray-500 w-12 truncate">
                                {invItem?.unit || ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveInput(idx)}
                              disabled={loading}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Notas / Observaciones
                </label>
                <textarea
                  value={notes}
                  disabled={loading}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles sobre el lote, clima, dosis, operario..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 py-2 px-3 text-sm text-gray-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={loading}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Guardando...' : editingActivity ? 'Guardar Cambios' : 'Registrar Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modals */}
      <StaffManagerModal 
        isOpen={isStaffModalOpen} 
        onClose={() => setIsStaffModalOpen(false)} 
      />
      
      <ActivityTypesManagerModal 
        isOpen={isTypesModalOpen} 
        onClose={() => setIsTypesModalOpen(false)} 
      />
    </div>
  );
}
