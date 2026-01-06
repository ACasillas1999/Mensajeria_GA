import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function UserSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Formularios separados
  const [profileForm, setProfileForm] = useState({
    nombre: '',
    email: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Cargar datos del usuario
  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/user/profile`.replace(/\/\//g, '/'), {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data.ok && data.user) {
        setUser(data.user);
        setProfileForm({
          nombre: data.user.nombre || '',
          email: data.user.email || '',
        });
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      showMessage('error', 'Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  }

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }

  // Actualizar perfil (nombre y email)
  async function handleProfileSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`${BASE}/api/user/profile`.replace(/\/\//g, '/'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          nombre: profileForm.nombre,
          email: profileForm.email,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        showMessage('success', 'Perfil actualizado correctamente');
        await loadUserData();
      } else {
        showMessage('error', data.error || 'Error al actualizar perfil');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      showMessage('error', 'Error de red al actualizar perfil');
    } finally {
      setSaving(false);
    }
  }

  // Cambiar contraseña
  async function handlePasswordSubmit(e) {
    e.preventDefault();

    // Validaciones
    if (!passwordForm.currentPassword) {
      showMessage('error', 'Debes ingresar tu contraseña actual');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showMessage('error', 'La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'Las contraseñas nuevas no coinciden');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${BASE}/api/user/change-password`.replace(/\/\//g, '/'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        showMessage('success', 'Contraseña cambiada correctamente');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        showMessage('error', data.error || 'Error al cambiar contraseña');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      showMessage('error', 'Error de red al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-600 dark:text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 dark:text-red-400">Error al cargar datos del usuario</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensajes de feedback */}
      {message.text && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-700 text-red-800 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Información del usuario */}
      <div className="p-6 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Información de la cuenta</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">Rol:</span>
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {user.rol === 'ADMIN' ? (
                <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 border border-purple-400 dark:border-purple-700 text-purple-800 dark:text-purple-300">
                  Administrador
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-400 dark:border-blue-700 text-blue-800 dark:text-blue-300">
                  Agente
                </span>
              )}
            </span>
          </div>
          {user.sucursal && (
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Sucursal:</span>
              <span className="font-medium text-slate-900 dark:text-slate-200">{user.sucursal}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">Estado:</span>
            <span className="font-medium text-slate-900 dark:text-slate-200">
              {user.activo ? (
                <span className="text-emerald-400">✓ Activo</span>
              ) : (
                <span className="text-red-400">✗ Inactivo</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Formulario de perfil */}
      <div className="p-6 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Datos personales</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Nombre completo</label>
            <input
              type="text"
              value={profileForm.nombre}
              onChange={(e) =>
                setProfileForm({ ...profileForm, nombre: e.target.value })
              }
              required
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="Tu nombre completo"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm({ ...profileForm, email: e.target.value })
              }
              required
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="tu@email.com"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* Formulario de cambio de contraseña */}
      <div className="p-6 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Cambiar contraseña</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
              Contraseña actual
            </label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              required
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="Tu contraseña actual"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              required
              minLength={8}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Debe tener al menos 8 caracteres
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
              Confirmar nueva contraseña
            </label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              required
              minLength={8}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="Repite la nueva contraseña"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>

      {/* Información adicional */}
      <div className="p-4 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/70 text-sm text-slate-600 dark:text-slate-400">
        <p>
          💡 <strong>Nota:</strong> Si cambias tu email, asegúrate de usar uno válido ya que
          será tu nuevo nombre de usuario para iniciar sesión.
        </p>
      </div>
    </div>
  );
}
