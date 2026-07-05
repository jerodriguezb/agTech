import {
  Leaf,
  LayoutDashboard,
  Map,
  ClipboardList,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn } from '../../lib/utils';
import type { AppView } from '../../types';

/** Navigation item descriptor */
interface NavItem {
  id: AppView;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Cartografía', icon: Map },
  { id: 'tasks', label: 'Tareas de Campo', icon: ClipboardList },
  { id: 'inventory', label: 'Pañol de Insumos', icon: Warehouse },
  { id: 'expenses', label: 'Finanzas', icon: Wallet },
];

export default function Sidebar() {
  const currentView = useAgriStore((s) => s.currentView);
  const setCurrentView = useAgriStore((s) => s.setCurrentView);
  const isSidebarCollapsed = useAgriStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useAgriStore((s) => s.toggleSidebar);
  const farms = useAgriStore((s) => s.farms);
  const currentFarmId = useAgriStore((s) => s.currentFarmId);

  const currentFarm = farms.find((f) => f.id === currentFarmId);

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950',
        'border-r border-slate-800/60 shadow-2xl shadow-slate-950/50',
        'transition-all duration-300 ease-in-out select-none',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* ── Logo / Branding ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0">
        <div
          className={cn(
            'flex items-center justify-center rounded-lg',
            'bg-gradient-to-br from-pampas-500 to-pampas-700',
            'shadow-lg shadow-pampas-500/25',
            'transition-all duration-300',
            isSidebarCollapsed ? 'w-10 h-10' : 'w-9 h-9'
          )}
        >
          <Leaf className="w-5 h-5 text-white" strokeWidth={2.2} />
        </div>

        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          )}
        >
          <h1 className="text-base font-bold text-white tracking-tight whitespace-nowrap">
            agroCopilot
            <span className="text-pampas-400">.ag</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase whitespace-nowrap">
            Smart Farm Ops
          </p>
        </div>
      </div>

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="mx-4 border-t border-slate-800/70" />

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto dark-scrollbar">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              title={isSidebarCollapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 w-full rounded-xl',
                'px-3 py-2.5 text-sm font-medium',
                'transition-all duration-200 ease-out',
                isActive
                  ? 'bg-pampas-600/15 text-pampas-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-pampas-500 shadow-lg shadow-pampas-500/40" />
              )}

              <Icon
                className={cn(
                  'shrink-0 w-5 h-5 transition-colors duration-200',
                  isActive
                    ? 'text-pampas-400'
                    : 'text-slate-500 group-hover:text-slate-300'
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />

              <span
                className={cn(
                  'whitespace-nowrap overflow-hidden transition-all duration-300',
                  isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                )}
              >
                {item.label}
              </span>

              {/* Hover tooltip when collapsed */}
              {isSidebarCollapsed && (
                <span
                  className={cn(
                    'absolute left-full ml-3 px-2.5 py-1 rounded-md text-xs font-medium',
                    'bg-slate-800 text-white shadow-xl border border-slate-700',
                    'opacity-0 group-hover:opacity-100 pointer-events-none',
                    'transition-opacity duration-200 whitespace-nowrap z-50'
                  )}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="mx-4 border-t border-slate-800/70" />

      {/* ── Footer — User & Farm ─────────────────────────────────────────── */}
      <div className="px-3 py-3 shrink-0">
        <div
          className={cn(
            'flex items-center gap-3 px-2 py-2 rounded-xl',
            'transition-all duration-300'
          )}
        >
          {/* Avatar placeholder */}
          <div
            className={cn(
              'shrink-0 flex items-center justify-center rounded-full',
              'w-9 h-9 bg-gradient-to-br from-tierra-400 to-tierra-600',
              'text-white text-xs font-bold shadow-md'
            )}
          >
            LP
          </div>

          <div
            className={cn(
              'overflow-hidden transition-all duration-300 min-w-0',
              isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            <p className="text-sm font-semibold text-slate-200 truncate">
              {currentFarm?.owner ?? 'Administrador'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {currentFarm?.name ?? 'Sin establecimiento'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Collapse Toggle ──────────────────────────────────────────────── */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-20 z-10',
          'flex items-center justify-center w-6 h-6 rounded-full',
          'bg-slate-800 border border-slate-700 text-slate-400',
          'hover:bg-slate-700 hover:text-white hover:border-slate-600',
          'transition-all duration-200 shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-pampas-500/50'
        )}
        aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
      >
        {isSidebarCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
