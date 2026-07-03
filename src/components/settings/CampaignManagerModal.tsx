import { useState, useEffect } from 'react';
import { X, Calendar, Plus, CalendarCheck, PlayCircle, Loader2 } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Campaign } from '../../types';
import { cn } from '../../lib/utils';

interface CampaignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CampaignManagerModal({ isOpen, onClose }: CampaignManagerModalProps) {
  const campaigns = useAgriStore((s) => s.campaigns);
  const currentFarmId = useAgriStore((s) => s.currentFarmId);
  const activeCampaignId = useAgriStore((s) => s.activeCampaignId);
  const setActiveCampaign = useAgriStore((s) => s.setActiveCampaign);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // New campaign form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setShowForm(false);
      setName('');
      setStartDate('');
      setEndDate('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Las campañas solo están disponibles con Supabase configurado.');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from('campaigns')
        .insert({
          farm_id: currentFarmId,
          name,
          start_date: startDate,
          end_date: endDate,
          is_active: campaigns.length === 0, // Make active if it's the first one
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state by forcing a reload or just adding to the array
      useAgriStore.setState((state) => ({
        campaigns: [...state.campaigns, {
          id: data.id,
          farmId: data.farm_id,
          name: data.name,
          startDate: data.start_date,
          endDate: data.end_date,
          isActive: data.is_active,
        }]
      }));

      if (data.is_active) {
        setActiveCampaign(data.id);
      }

      setShowForm(false);
      setName('');
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      setError(err.message || 'Error al crear la campaña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (campaignId: string) => {
    if (!isSupabaseConfigured) return;
    setIsSubmitting(true);
    try {
      // Deactivate all campaigns for this farm
      await supabase
        .from('campaigns')
        .update({ is_active: false })
        .eq('farm_id', currentFarmId);
      
      // Activate the selected one
      await supabase
        .from('campaigns')
        .update({ is_active: true })
        .eq('id', campaignId);

      // Update local state
      useAgriStore.setState((state) => ({
        campaigns: state.campaigns.map(c => ({
          ...c,
          isActive: c.id === campaignId
        })),
        activeCampaignId: campaignId
      }));

    } catch (err: any) {
      console.error('Error setting active campaign:', err);
      setError('Error al activar la campaña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-0">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-inner">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Gestor de Campañas</h2>
              <p className="text-sm text-slate-500">Administrá los ciclos productivos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
                Nueva Campaña
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleCreateCampaign} className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="mb-4 font-semibold text-slate-700">Crear Nueva Campaña</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Nombre (Ej. Gruesa 25/26)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Fecha Fin</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 flex justify-center items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <Calendar className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No hay campañas registradas</p>
                <p className="text-sm text-slate-400 mt-1">Creá una campaña para organizar los costos de tu ciclo agrícola.</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    campaign.isActive 
                      ? "border-emerald-200 bg-emerald-50/50 shadow-sm" 
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-800">{campaign.name}</h4>
                      {campaign.isActive && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Activa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {!campaign.isActive && (
                    <button
                      onClick={() => handleSetActive(campaign.id)}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Fijar Activa
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
