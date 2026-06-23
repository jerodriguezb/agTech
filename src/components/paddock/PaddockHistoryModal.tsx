import { X, Calendar, Droplets, Activity as ActivityIcon } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn, formatDate } from '../../lib/utils';

interface PaddockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  paddockId: string | null;
}

const activityBadge: Record<string, string> = {
  Siembra: 'bg-emerald-100 text-emerald-700',
  Cosecha: 'bg-amber-100 text-amber-700',
  Pulverizacion: 'bg-rose-100 text-rose-700',
  Fertilizacion: 'bg-sky-100 text-sky-700',
  Riego: 'bg-blue-100 text-blue-700',
  Lluvia: 'bg-indigo-100 text-indigo-700',
};

export default function PaddockHistoryModal({
  isOpen,
  onClose,
  paddockId,
}: PaddockHistoryModalProps) {
  const paddocks = useAgriStore((s) => s.paddocks);
  const activities = useAgriStore((s) => s.activities);

  if (!isOpen || !paddockId) return null;

  const paddock = paddocks.find((p) => p.id === paddockId);
  if (!paddock) return null;

  // Filtrar actividades del lote (incluir lluvias generales que no tienen lote asignado o que caen en toda la granja, pero para simplificar, mostramos las directas)
  const paddockActivities = activities
    .filter((a) => a.paddockId === paddockId || a.type === 'Lluvia')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Ficha Histórica: {paddock.name}
              </h2>
              <p className="text-sm text-gray-500">Cronología de labores y clima</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto p-6">
            {paddockActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <Calendar className="h-10 w-10 mb-3 text-gray-300" />
                <p>No hay registros históricos para este lote.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-100 pl-6 ml-3">
                {paddockActivities.map((act) => (
                  <div key={act.id} className="mb-8 relative">
                    <span className="absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white shadow-sm border border-gray-200">
                      {act.type === 'Lluvia' ? (
                        <Droplets className="h-3 w-3 text-indigo-500" />
                      ) : (
                        <ActivityIcon className="h-3 w-3 text-emerald-500" />
                      )}
                    </span>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {formatDate(act.date)}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            activityBadge[act.type] || 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {act.type}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mt-2 space-y-1">
                        {act.type === 'Lluvia' && (
                          <p><strong>Precipitación:</strong> {act.rainfallMm} mm</p>
                        )}
                        {act.appliedArea && (
                          <p><strong>Superficie Aplicada:</strong> {act.appliedArea} ha (Parcial)</p>
                        )}
                        {act.inputsConsumed.length > 0 && (
                          <div className="mt-2 bg-white p-2 rounded border border-gray-200">
                            <strong>Insumos:</strong>
                            <ul className="list-disc pl-5 mt-1 text-xs">
                              {act.inputsConsumed.map(input => (
                                <li key={input.inventoryItemId}>
                                  {input.quantity} {input.unit}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {act.notes && (
                          <p className="mt-2 italic text-gray-500">"{act.notes}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
