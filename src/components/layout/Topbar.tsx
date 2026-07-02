import { useState } from 'react';
import {
  LayoutDashboard,
  Map,
  ClipboardList,
  Warehouse,
  MapPin,
  Bell,
  MessageSquare,
  Database,
  LogIn,
  LogOut,
  Sparkles,
  Loader2,
  Shield,
} from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn } from '../../lib/utils';
import type { AppView } from '../../types';

/** Maps each view to its display label and icon */
const viewMeta: Record<AppView, { label: string; icon: React.ElementType }> = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard },
  map: { label: 'Cartografía', icon: Map },
  tasks: { label: 'Tareas de Campo', icon: ClipboardList },
  inventory: { label: 'Pañol de Insumos', icon: Warehouse },
};

import PermissionManagerModal from '../settings/PermissionManagerModal';

export default function Topbar() {
  const currentView = useAgriStore((s) => s.currentView);
  const farms = useAgriStore((s) => s.farms);
  const currentFarmId = useAgriStore((s) => s.currentFarmId);
  const inventory = useAgriStore((s) => s.inventory);
  const isCopilotOpen = useAgriStore((s) => s.isCopilotOpen);
  const toggleCopilot = useAgriStore((s) => s.toggleCopilot);

  const userRole = useAgriStore((s) => s.userRole);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

  // Supabase states
  const supabaseStatus = useAgriStore((s) => s.supabaseStatus);
  const user = useAgriStore((s) => s.user);
  const isLoading = useAgriStore((s) => s.isLoading);
  const setAuthModalOpen = useAgriStore((s) => s.setAuthModalOpen);
  const signOut = useAgriStore((s) => s.signOut);

  const currentFarm = farms.find((f) => f.id === currentFarmId);
  const meta = viewMeta[currentView];
  const ViewIcon = meta.icon;

  // Count inventory items that are below minimum stock
  const lowStockCount = inventory.filter(
    (item) => item.currentStock < item.minimumStock
  ).length;

  return (
    <>
      <header
      className={cn(
        'flex items-center justify-between h-16 px-6',
        'bg-white/80 backdrop-blur-md',
        'border-b border-slate-200/80',
        'shadow-sm shadow-slate-100/50'
      )}
    >
      {/* ── Left — Breadcrumb ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg',
            'bg-slate-100 text-slate-600'
          )}
        >
          <ViewIcon className="w-4.5 h-4.5" strokeWidth={1.8} />
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400 font-medium">agroCopilot</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-semibold">{meta.label}</span>
        </div>
      </div>

      {/* ── Center — Farm Name ───────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-2">
        <MapPin className="w-4 h-4 text-emerald-600" strokeWidth={2} />
        <span className="text-sm font-semibold text-slate-700 tracking-tight">
          {isLoading ? (
            <span className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
            </span>
          ) : (
            currentFarm?.name ?? 'Sin establecimiento'
          )}
        </span>
        {currentFarm?.location && !isLoading && (
          <span className="text-xs text-slate-400 font-medium">
            — {currentFarm.location}
          </span>
        )}
      </div>

      {/* ── Right — Actions & Connection ─────────────────────────────────── */}
      <div className="flex items-center gap-4">
        
        {/* Connection Status Badge */}
        <div className="flex items-center gap-2">
          {supabaseStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Supabase</span>
            </div>
          ) : supabaseStatus === 'simulated' ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Modo Local (Simulación)</span>
              <span className="sm:hidden">Local</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desconectado</span>
            </div>
          )}
        </div>

        {/* User Account Session Controls */}
        <div className="flex items-center gap-1">
          {user ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-1 pr-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white uppercase">
                {user.is_anonymous ? 'A' : user.email?.charAt(0) || 'U'}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {user.is_anonymous ? 'Invitado Temporal' : 'Usuario'}
                </span>
                <span className="max-w-[120px] truncate text-xs font-semibold text-slate-600">
                  {user.is_anonymous ? 'Prueba Anónima' : user.email}
                </span>
              </div>
              <button
                onClick={signOut}
                title="Cerrar sesión"
                className="ml-2 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50',
                supabaseStatus === 'disconnected' && 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50'
              )}
            >
              <LogIn className="h-4 w-4" />
              <span>Conectar</span>
            </button>
          )}
        </div>

        {/* Permission Manager Trigger Button */}
        {userRole === 'owner' && (
          <button
            onClick={() => setIsPermissionsOpen(true)}
            className={cn(
              'relative flex items-center justify-center w-9 h-9 rounded-xl',
              'text-slate-500 hover:text-slate-700',
              'hover:bg-slate-100 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500/30'
            )}
            title="Administrar Permisos de Usuarios"
          >
            <Shield className="w-[18px] h-[18px] text-emerald-600" strokeWidth={2} />
          </button>
        )}

        {/* Separator */}
        <div className="w-px h-6 bg-slate-200" />

        {/* Notification Bell */}
        <button
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-xl',
            'text-slate-500 hover:text-slate-700',
            'hover:bg-slate-100 transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/30'
          )}
          aria-label={`Notificaciones — ${lowStockCount} alertas de stock bajo`}
        >
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />

          {lowStockCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5',
                'flex items-center justify-center',
                'min-w-[18px] h-[18px] px-1 rounded-full',
                'bg-red-500 text-white text-[10px] font-bold',
                'ring-2 ring-white',
                'animate-bounce-in'
              )}
            >
              {lowStockCount > 9 ? '9+' : lowStockCount}
            </span>
          )}
        </button>

        {/* Copilot Toggle */}
        <button
          onClick={toggleCopilot}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl',
            'text-sm font-medium transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/30',
            isCopilotOpen
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          )}
          aria-label={isCopilotOpen ? 'Cerrar Copiloto IA' : 'Abrir Copiloto IA'}
        >
          <MessageSquare
            className={cn(
              'w-[18px] h-[18px]',
              isCopilotOpen && 'animate-pulse-soft'
            )}
            strokeWidth={1.8}
          />
          <span className="hidden lg:inline">Copiloto IA</span>
        </button>
      </div>
    </header>

    <PermissionManagerModal
      isOpen={isPermissionsOpen}
      onClose={() => setIsPermissionsOpen(false)}
    />
  </>
  );
}
