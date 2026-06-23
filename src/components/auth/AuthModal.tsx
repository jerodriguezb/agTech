import { useState } from 'react';
import { X, Lock, Mail, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import { cn } from '../../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const translateAuthError = (message: string): string => {
  if (!message) return 'Ocurrió un error inesperado.';
  
  if (message.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (message === 'Anonymous sign-ins are disabled') {
    return 'Los accesos anónimos están desactivados en Supabase. Registrate con correo.';
  }
  if (message.includes('already registered')) {
    return 'El correo electrónico ya está registrado.';
  }
  if (message.includes('Password should be')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (message.includes('rate limit') || message.includes('Too many requests')) {
    return 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.';
  }
  return message;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = useAgriStore((s) => s.signIn);
  const signUp = useAgriStore((s) => s.signUp);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor completá todos los campos.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'login') {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
      } else {
        const { error: err } = await signUp(email, password);
        if (err) throw err;
        setError('¡Registro exitoso! Ya podés ingresar.');
        setActiveTab('login');
        setPassword('');
        setLoading(false);
        return;
      }
      onClose();
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      {/* Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300">
        
        {/* Header Gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-6 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-300" />
            <h2 className="text-xl font-bold tracking-tight">Conectar con Backend</h2>
          </div>
          <p className="mt-1 text-xs text-emerald-100/90">
            Inicia sesión o regístrate para sincronizar tu establecimiento con Supabase
          </p>
        </div>

        {/* Auth Body */}
        <div className="p-6">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 mb-5">
            <button
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={cn(
                'flex-1 pb-3 text-sm font-semibold transition-all duration-200 border-b-2 outline-none',
                activeTab === 'login'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              )}
            >
              Ingresar
            </button>
            <button
              onClick={() => {
                setActiveTab('signup');
                setError(null);
              }}
              className={cn(
                'flex-1 pb-3 text-sm font-semibold transition-all duration-200 border-b-2 outline-none',
                activeTab === 'signup'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              )}
            >
              Registrarse
            </button>
          </div>

          {/* Errors/Success Feedback */}
          {error && (
            <div
              className={cn(
                'mb-4 flex items-start gap-2.5 rounded-lg p-3 text-xs',
                error.includes('exitoso')
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
              )}
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@agtech.com"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {activeTab === 'login' ? 'Ingresando...' : 'Creando cuenta...'}
                </>
              ) : activeTab === 'login' ? (
                'Iniciar Sesión'
              ) : (
                'Crear Cuenta'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
