import { useEffect } from 'react';
import { useAgriStore } from './store/useAgriStore';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import WhatsAppCopilot from './components/simulator/WhatsAppCopilot';
import DashboardView from './views/DashboardView';
import MapView from './views/MapView';
import FieldTasksView from './views/FieldTasksView';
import InventoryView from './views/InventoryView';
import { ExpensesView } from './views/ExpensesView';
import AuthModal from './components/auth/AuthModal';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

function App() {
  const currentView = useAgriStore((s) => s.currentView);
  const isSidebarCollapsed = useAgriStore((s) => s.isSidebarCollapsed);
  const isAuthModalOpen = useAgriStore((s) => s.isAuthModalOpen);
  const setAuthModalOpen = useAgriStore((s) => s.setAuthModalOpen);

  // Inicialización y escucha de estado de sesión de Supabase
  useEffect(() => {
    const store = useAgriStore.getState();

    if (isSupabaseConfigured && supabase) {
      // 1. Obtener la sesión activa al montar el componente
      supabase.auth.getSession().then(({ data: { session } }) => {
        store.setUser(session?.user ?? null);
        store.loadInitialData();
      });

      // 2. Escuchar cambios de sesión futuros (login, logout, token refresh)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        store.setUser(session?.user ?? null);
        store.loadInitialData();
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Fallback a modo simulación local
      store.loadInitialData();
    }
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'map':
        return <MapView />;
      case 'tasks':
        return <FieldTasksView />;
      case 'inventory':
        return <InventoryView />;
      case 'expenses':
        return <ExpensesView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className="flex flex-1 flex-col transition-all duration-300"
        style={{
          marginLeft: isSidebarCollapsed ? '5rem' : '16rem',
        }}
      >
        {/* Top Bar */}
        <Topbar />

        {/* View Container */}
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>

      {/* WhatsApp AI Copilot Overlay */}
      <WhatsAppCopilot />

      {/* Auth Modal Overlay */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

export default App;
