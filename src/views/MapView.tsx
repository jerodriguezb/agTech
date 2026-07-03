import { useState, useMemo, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { PathOptions, Layer } from 'leaflet';
import type { Feature, Geometry } from 'geojson';
import { Wheat, Leaf, Layers } from 'lucide-react';

import { useAgriStore } from '../store/useAgriStore';
import type { Crop } from '../types';
import {
  cn,
  ndviToColor,
  formatHectares,
  formatDate,
} from '../lib/utils';
import PaddockHistoryModal from '../components/paddock/PaddockHistoryModal';

// Helper to extract Leaflet LatLng points from GeoJSON Geometry
function getPointsFromGeometry(geom: any): [number, number][] {
  if (!geom) return [];
  const points: [number, number][] = [];
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates || [];
    rings.forEach((ring: any) => {
      ring.forEach((pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          points.push([pt[1], pt[0]]); // GeoJSON is [lng, lat] -> Leaflet is [lat, lng]
        }
      });
    });
  } else if (geom.type === 'MultiPolygon') {
    const polygons = geom.coordinates || [];
    polygons.forEach((poly: any) => {
      poly.forEach((ring: any) => {
        ring.forEach((pt: any) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            points.push([pt[1], pt[0]]);
          }
        });
      });
    });
  }
  return points;
}

// Sub-component to dynamically adjust map view when bounds change
function ChangeMapView({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────
type MapMode = 'crop' | 'ndvi';

interface PaddockProperties {
  id: string;
  name: string;
  area: number;
  cropId: string | null;
  cropName: string;
  cropColor: string;
  ndvi: number;
  soilType: string;
  lastUpdated: string;
}

// ─── NDVI color-ramp for legend (Enfoque Ganadero/Pasturas) ────────────────────
const ndviRamp = [
  { min: 0.0, max: 0.2, color: '#DC2626', label: 'Suelo Desnudo' },
  { min: 0.2, max: 0.4, color: '#F97316', label: 'Baja Densidad' },
  { min: 0.4, max: 0.6, color: '#EAB308', label: 'Crecimiento Activo' },
  { min: 0.6, max: 0.8, color: '#65A30D', label: 'Buen Volumen' },
  { min: 0.8, max: 1.0, color: '#15803D', label: 'Alta Biomasa' },
];

function getNdviPastureLabel(ndvi: number) {
  if (ndvi < 0.2) return 'Suelo Desnudo';
  if (ndvi < 0.4) return 'Baja Densidad';
  if (ndvi < 0.6) return 'Crecimiento Activo';
  if (ndvi < 0.8) return 'Buen Volumen';
  return 'Alta Biomasa';
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MapView() {
  const paddocks = useAgriStore((s) => s.paddocks);
  const crops = useAgriStore((s) => s.crops);

  const [mapMode, setMapMode] = useState<MapMode>('crop');
  
  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPaddockId, setSelectedPaddockId] = useState<string | null>(null);

  // Listen to custom event from Leaflet popup
  useEffect(() => {
    const handleOpenHistory = (e: any) => {
      setSelectedPaddockId(e.detail.paddockId);
      setHistoryModalOpen(true);
    };
    window.addEventListener('openPaddockHistory', handleOpenHistory);
    return () => window.removeEventListener('openPaddockHistory', handleOpenHistory);
  }, []);

  // Build crop lookup
  const cropById = useMemo(() => {
    const map = new Map<string, Crop>();
    for (const c of crops) map.set(c.id, c);
    return map;
  }, [crops]);

  // Build GeoJSON features
  const features = useMemo<Feature<Geometry, PaddockProperties>[]>(() => {
    return paddocks.map((p) => {
      const crop = p.cropId ? cropById.get(p.cropId) : undefined;
      return {
        type: 'Feature' as const,
        geometry: p.coordinates as unknown as Geometry,
        properties: {
          id: p.id,
          name: p.name,
          area: p.area,
          cropId: p.cropId,
          cropName: crop?.name ?? 'Sin asignar',
          cropColor: crop?.color ?? '#6B7280',
          ndvi: p.ndvi,
          soilType: p.soilType ?? 'No especificado',
          lastUpdated: p.lastUpdated,
        },
      };
    });
  }, [paddocks, cropById]);

  // Calculate map bounds to auto-fit paddocks
  const mapBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    let allPoints: [number, number][] = [];
    paddocks.forEach((p) => {
      allPoints = allPoints.concat(getPointsFromGeometry(p.coordinates));
    });
    if (allPoints.length === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    allPoints.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [paddocks]);

  // Style function — depends on mapMode
  const styleFn = useCallback(
    (feature?: Feature<Geometry, PaddockProperties>): PathOptions => {
      if (!feature?.properties) {
        return { weight: 2, opacity: 0.8, fillOpacity: 0.5 };
      }
      const props = feature.properties;

      if (mapMode === 'crop') {
        return {
          fillColor: props.cropColor,
          color: '#FFFFFF',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.5,
        };
      }

      // NDVI mode
      return {
        fillColor: ndviToColor(props.ndvi),
        color: '#FFFFFF',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.6,
      };
    },
    [mapMode],
  );

  // Popup binder
  const onEachFeature = useCallback(
    (feature: Feature<Geometry, PaddockProperties>, layer: Layer) => {
      const p = feature.properties;
      const ndviColor = ndviToColor(p.ndvi);

      const html = `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:200px">
          <h3 style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1f2937">${p.name}</h3>
          <div style="display:flex;flex-direction:column;gap:5px;font-size:13px;color:#4b5563">
            <div style="display:flex;justify-content:space-between">
              <span>Superficie</span>
              <strong>${formatHectares(p.area)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span>Cultivo</span>
              <span style="display:inline-flex;align-items:center;gap:4px">
                <span style="width:8px;height:8px;border-radius:50%;background:${p.cropColor};display:inline-block"></span>
                <strong>${p.cropName}</strong>
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>NDVI</span>
              <span style="display:inline-flex;align-items:center;gap:4px">
                <span style="width:8px;height:8px;border-radius:50%;background:${ndviColor};display:inline-block"></span>
                <strong style="color:${ndviColor}">${p.ndvi.toFixed(2)}</strong>
                <span style="font-size:11px;color:#6b7280">(${getNdviPastureLabel(p.ndvi)})</span>
              </span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span>Suelo</span>
              <strong>${p.soilType}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;margin-top:4px;padding-top:6px;border-top:1px solid #e5e7eb">
              <span>Actualizado</span>
              <span>${formatDate(p.lastUpdated)}</span>
            </div>
            <button 
              onclick="window.dispatchEvent(new CustomEvent('openPaddockHistory', { detail: { paddockId: '${p.id}' } }))"
              style="margin-top:10px;width:100%;padding:6px;background-color:#10b981;color:white;border:none;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;"
            >
              Ver Ficha Histórica
            </button>
          </div>
        </div>
      `;

      layer.bindPopup(html, {
        maxWidth: 280,
        className: 'agrocopilot-popup',
      });
    },
    [],
  );

  // Unique crop list for legend
  const cropLegendItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { name: string; color: string }[] = [];
    for (const p of paddocks) {
      const crop = p.cropId ? cropById.get(p.cropId) : undefined;
      const key = crop?.id ?? '__unassigned';
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          name: crop?.name ?? 'Sin asignar',
          color: crop?.color ?? '#6B7280',
        });
      }
    }
    return items;
  }, [paddocks, cropById]);

  return (
    <div className="relative h-full min-h-[calc(100vh-4rem)]">
      {/* ─ Map ────────────────────────────────────────────────────── */}
      <MapContainer
        center={[-34.59, -60.96]}
        zoom={12}
        className="h-full min-h-[calc(100vh-4rem)] w-full"
        zoomControl={true}
      >
        {/* Auto-center map to fit paddocks */}
        <ChangeMapView bounds={mapBounds} />

        {/* Satellite base layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'
          maxZoom={19}
        />
        {/* Labels overlay */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        {/* Paddock polygons — key forces re-render when mode changes */}
        <GeoJSON
          key={mapMode}
          data={{ type: 'FeatureCollection' as const, features } as GeoJSON.FeatureCollection}
          style={styleFn}
          onEachFeature={onEachFeature}
        />
      </MapContainer>

      {/* ─ Mode Selector (top-right) ──────────────────────────────── */}
      <div
        className="absolute right-4 top-4 z-[1000] flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/80 p-2 shadow-xl backdrop-blur-xl"
      >
        <div className="mb-1 flex items-center gap-1.5 px-2 pt-1">
          <Layers className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Vista
          </span>
        </div>

        <button
          onClick={() => setMapMode('crop')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
            mapMode === 'crop'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          <Wheat className="h-4 w-4" />
          Cultivo
        </button>

        <button
          onClick={() => setMapMode('ndvi')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
            mapMode === 'ndvi'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          <Leaf className="h-4 w-4" />
          NDVI
        </button>
      </div>

      {/* ─ Legend (bottom-left) ────────────────────────────────────── */}
      <div
        className="absolute bottom-6 left-4 z-[1000] rounded-2xl border border-white/20 bg-white/80 p-4 shadow-xl backdrop-blur-xl"
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {mapMode === 'crop' ? 'Cultivos' : 'Índice NDVI'}
        </p>

        {mapMode === 'crop' ? (
          <div className="flex flex-col gap-1.5">
            {cropLegendItems.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-gray-700">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {ndviRamp.map((band) => (
              <div key={band.label} className="flex items-center gap-2 text-xs text-gray-700">
                <span
                  className="inline-block h-3 w-6 rounded-sm"
                  style={{ backgroundColor: band.color }}
                />
                <span className="w-16 font-medium">{band.label}</span>
                <span className="text-[10px] text-gray-400">
                  {band.min.toFixed(1)}–{band.max.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Modal */}
      <PaddockHistoryModal 
        isOpen={historyModalOpen} 
        onClose={() => setHistoryModalOpen(false)} 
        paddockId={selectedPaddockId} 
      />
    </div>
  );
}
