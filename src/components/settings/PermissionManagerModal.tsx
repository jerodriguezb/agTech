import React, { useState } from 'react';
import { X, UserPlus, Trash2, Shield, Mail, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAgriStore } from '../../store/useAgriStore';
import type { UserRole } from '../../types';

interface PermissionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PermissionManagerModal({ isOpen, onClose }: PermissionManagerModalProps) {
  const user = useAgriStore((s) => s.user);
  const userRole = useAgriStore((s) => s.userRole);
  const farmUsers = useAgriStore((s) => s.farmUsers);
  const addFarmUser = useAgriStore((s) => s.addFarmUser);
  const updateFarmUser = useAgriStore((s) => s.updateFarmUser);
  const deleteFarmUser = useAgriStore((s) => s.deleteFarmUser);

  // Estados locales para el formulario de invitación
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('operator');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rol descriptivo para la UI
  const roleLabels: Record<UserRole, string> = {
    owner: 'Administrador / Gerente',
    manager: 'Encargado de Campo / Capataz',
    accountant: 'Administrativo / Contador',
    agronomist: 'Técnico / Agrónomo',
    operator: 'Operario / Tractorista',
  };

  const roleColors: Record<UserRole, string> = {
    owner: 'bg-emerald-50 text-emerald-700 border border-emerald-250',
    manager: 'bg-blue-50 text-blue-700 border border-blue-200',
    accountant: 'bg-purple-50 text-purple-700 border border-purple-200',
    agronomist: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    operator: 'bg-gray-50 text-gray-700 border border-gray-200',
  };

  if (!isOpen) return null;

  // El rol actual del usuario conectado debe ser 'owner' (Propietario) para gestionar permisos
  const hasAccess = userRole === 'owner';

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAccess) return;

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    // Validar si el email ya existe en la lista
    if (farmUsers.some((u) => u.email.toLowerCase() === email)) {
      setErrorMsg(`El usuario con email ${email} ya posee permisos asignados.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await addFarmUser(email, roleInput);
      setSuccessMsg(`¡Invitación enviada con éxito a ${email}!`);
      setEmailInput('');
      setRoleInput('operator');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al agregar el miembro.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    if (!hasAccess) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      await updateFarmUser(id, newRole);
      setSuccessMsg('Rol actualizado correctamente.');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar el rol.');
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!hasAccess) return;
    
    // Evitar que el usuario se elimine a sí mismo
    if (user && user.email && email.toLowerCase() === user.email.toLowerCase()) {
      alert('No puedes revocar tus propios permisos para evitar bloquear tu acceso al establecimiento.');
      return;
    }

    if (confirm(`¿Estás seguro de revocar los permisos de acceso para ${email}?`)) {
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        await deleteFarmUser(id);
        setSuccessMsg(`Acceso revocado para ${email}.`);
        setTimeout(() => setSuccessMsg(null), 2500);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al eliminar el miembro.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh] animate-bounce-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <Shield className="h-4.5 w-4.5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Administrador de Permisos</h2>
              <p className="text-xs text-gray-500">Asigna roles y gestiona accesos de usuarios al establecimiento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerta de acceso denegado si no es owner */}
        {!hasAccess ? (
          <div className="p-6 text-center space-y-3 flex-1 overflow-y-auto">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-gray-800">Acceso Restringido</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Solo los usuarios con perfil de **Administrador / Gerente (Propietario)** tienen autorización para ver o modificar los permisos del establecimiento.
            </p>
            <div className="pt-4">
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
              >
                Entendido / Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            
            {/* Listado de Miembros y Roles (Izquierda) */}
            <div className="w-full md:w-3/5 border-r border-gray-100 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Miembros del Establecimiento</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  {farmUsers.length} miembro(s)
                </span>
              </div>

              {/* Feedback rápido */}
              {successMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 p-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-2 text-xs text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Contenedor de la lista */}
              <div className="space-y-3">
                {farmUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No hay miembros registrados.</p>
                ) : (
                  farmUsers.map((item) => {
                    const isSelf = user && user.email && item.email.toLowerCase() === user.email.toLowerCase();
                    const statusText = item.userId ? 'Activo' : 'Pendiente';
                    const statusColor = item.userId 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800 animate-pulse';

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-shadow gap-3"
                      >
                        <div className="space-y-1 truncate flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-xs text-gray-800 truncate" title={item.email}>
                              {item.email}
                            </p>
                            {isSelf && (
                              <span className="text-[9px] font-bold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                Vos
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-bold uppercase text-[9px] ${statusColor}`}>
                              {statusText}
                            </span>
                            <span className="text-gray-400">—</span>
                            <span className="text-gray-400">Asignado el {new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Modificador de Rol y Borrado */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isSelf ? (
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${roleColors[item.role]}`}>
                              {roleLabels[item.role]}
                            </span>
                          ) : (
                            <select
                              value={item.role}
                              onChange={(e) => handleRoleChange(item.id, e.target.value as UserRole)}
                              disabled={loading}
                              className="rounded-lg border border-gray-200 py-1.5 px-2.5 text-xs text-gray-700 focus:border-emerald-500 bg-white shadow-sm outline-none"
                            >
                              {Object.entries(roleLabels).map(([code, label]) => (
                                <option key={code} value={code}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          )}

                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteUser(item.id, item.email)}
                              disabled={loading}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                              title="Revocar permisos"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Formulario de Nueva Invitación (Derecha) */}
            <div className="w-full md:w-2/5 p-6 bg-gray-50/50 overflow-y-auto flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-150">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  Nueva Invitación
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Ingresa el correo electrónico del miembro del campo para otorgarle acceso al sistema bajo el rol correspondiente.
                </p>

                <form onSubmit={handleAddUser} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Email del Usuario</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Ej: capataz@campo.com"
                        disabled={loading}
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-xs text-gray-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Rol a Asignar</label>
                    <select
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value as UserRole)}
                      disabled={loading}
                      className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-xs text-gray-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white shadow-sm"
                    >
                      {Object.entries(roleLabels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Detalle informativo del rol seleccionado */}
                  <div className="rounded-xl border border-gray-150 bg-white p-3.5 text-xs text-gray-500 shadow-sm leading-relaxed space-y-1">
                    <p className="font-bold text-gray-700 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Permisos del {roleLabels[roleInput]}:
                    </p>
                    <p className="text-[11px]">
                      {roleInput === 'owner' && 'Control total absoluto (CRUD) de finanzas, inventario, labores de campo y edición de directivas de agroCopilot AI.'}
                      {roleInput === 'manager' && 'Supervisión del terreno. Puede crear, modificar y cerrar órdenes de labores de campo y consumos, sin acceso a prompts de IA ni finanzas.'}
                      {roleInput === 'accountant' && 'Acceso total a la información financiera, pagos y liquidación de granos. No puede modificar labores de campo ni configuración de la IA.'}
                      {roleInput === 'agronomist' && 'Visualización e ingreso de recomendaciones agronómicas, NDVI e insumos. Sin acceso a facturación o ajustes de prompts de IA.'}
                      {roleInput === 'operator' && 'Registro básico de avances operativos, horas de máquina o consumo de gasoil. Interfaz de carga rápida y simplificada.'}
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || !emailInput.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Invitando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Agregar Miembro
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Botón de cierre en pantallas chicas */}
              <div className="pt-6 md:pt-0 shrink-0">
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cerrar Panel
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
