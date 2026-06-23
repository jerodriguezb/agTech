import { useState, useEffect } from 'react';
import { X, Map as MapIcon, Wheat } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import type { Paddock } from '../../types';

interface PaddockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Paddock>, geojson?: any) => Promise<void>;
  editingPaddock?: Paddock | null;
}

export default function PaddockModal({ isOpen, onClose, onSave, editingPaddock }: PaddockModalProps) {
  const crops = useAgriStore((s) => s.crops);
  
  const [name, setName] = useState('');
  const [cropId, setCropId] = useState('');
  const [ndvi, setNdvi] = useState<number>(0.5);
  const [geojsonInput, setGeojsonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (editingPaddock) {
      setName(editingPaddock.name);
      setCropId(editingPaddock.cropId || '');
      setNdvi(editingPaddock.ndvi);
      setGeojsonInput('');
      setGeoError('');
    } else {
      setName('');
      setCropId('');
      setNdvi(0.5);
      setGeojsonInput('');
      setGeoError('');
    }
  }, [editingPaddock, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeoError('');
    setIsSubmitting(true);

    let parsedGeojson = null;

    // Validate geojson only if we are creating a new paddock
    if (!editingPaddock) {
      if (!geojsonInput.trim()) {
        setGeoError('El GeoJSON es obligatorio para crear un nuevo lote.');
        setIsSubmitting(false);
        return;
      }
      try {
        const parsed = JSON.parse(geojsonInput);
        
        // Extract geometry if the user pasted a FeatureCollection or Feature
        if (parsed.type === 'FeatureCollection' && parsed.features?.length > 0) {
          parsedGeojson = parsed.features[0].geometry;
        } else if (parsed.type === 'Feature') {
          parsedGeojson = parsed.geometry;
        } else {
          parsedGeojson = parsed;
        }

        if (!parsedGeojson || (parsedGeojson.type !== 'Polygon' && parsedGeojson.type !== 'MultiPolygon')) {
          setGeoError('El GeoJSON debe contener al menos un Polygon o MultiPolygon.');
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        setGeoError('GeoJSON inválido. Verifica el formato.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await onSave(
        {
          name,
          cropId: cropId || null,
          ndvi: Number(ndvi),
          coordinates: parsedGeojson,
        },
        parsedGeojson
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving paddock:', err);
      setGeoError(err?.message || 'Error al guardar el lote en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-0">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <MapIcon className="h-4 w-4 text-emerald-700" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editingPaddock ? 'Editar Lote' : 'Nuevo Lote'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nombre del Lote
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="Ej. Lote Norte"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Cultivo Asignado
                </label>
                <div className="relative">
                  <select
                    value={cropId}
                    onChange={(e) => setCropId(e.target.value)}
                    className="w-full appearance-none rounded-xl border-gray-300 pl-10 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  >
                    <option value="">Ninguno (Barbecho)</option>
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.variety})
                      </option>
                    ))}
                  </select>
                  <Wheat className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Índice NDVI (Opcional)
                </label>
                <input
                  type="number"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={ndvi}
                  onChange={(e) => setNdvi(parseFloat(e.target.value))}
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="0.5"
                />
                <p className="mt-1 text-[10px] text-gray-500">Valor entre -1.0 y 1.0</p>
              </div>
            </div>

            {!editingPaddock && (
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>Geometría (GeoJSON)</span>
                  <a
                    href="https://geojson.io/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    Crear en geojson.io
                  </a>
                </label>
                <textarea
                  required
                  rows={4}
                  value={geojsonInput}
                  onChange={(e) => setGeojsonInput(e.target.value)}
                  className="w-full rounded-xl border-gray-300 font-mono text-xs shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder='{"type": "Polygon", "coordinates": [[[...]]]}'
                />
                {geoError && <p className="mt-1 text-xs text-red-500">{geoError}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Pega aquí el objeto Polygon o MultiPolygon de las coordenadas de tu lote.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : editingPaddock ? 'Guardar Cambios' : 'Crear Lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
