import { useEffect, useState } from 'react';
import StatusFieldsConfig from './StatusFieldsConfig.jsx';

const BASE = import.meta.env.BASE_URL || '';

export default function ConversationStatusesAdmin() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalStatus, setModalStatus] = useState(null);
  const [configuringFieldsFor, setConfiguringFieldsFor] = useState(null);

  async function loadStatuses() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/conversation-statuses`.replace(/\/\//g, '/'), {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data.ok) {
        setStatuses(data.items || []);
      } else {
        alert(data.error || 'Error cargando estados');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red cargando estados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatuses();
  }, []);

  function openNewStatus() {
    setModalStatus({
      id: null,
      name: '',
      color: '#64748b',
      icon: '📋',
      description: '',
      display_order: statuses.length,
      is_active: true,
      is_default: false,
      is_final: false,
      auto_reset_to_status_id: null,
    });
  }

  function openEditStatus(status) {
    setModalStatus({ ...status });
  }

  function closeModal() {
    setModalStatus(null);
  }

  async function saveStatus(e) {
    e.preventDefault();
    if (!modalStatus) return;

    const payload = {
      name: modalStatus.name.trim(),
      color: modalStatus.color,
      icon: modalStatus.icon,
      description: modalStatus.description,
      display_order: Number(modalStatus.display_order) || 0,
      is_active: modalStatus.is_active === true || modalStatus.is_active === 1,
      is_default: modalStatus.is_default === true || modalStatus.is_default === 1,
      is_final: modalStatus.is_final === true || modalStatus.is_final === 1,
      auto_reset_to_status_id: modalStatus.auto_reset_to_status_id || null,
    };

    try {
      const url = `${BASE}/api/admin/conversation-statuses${
        modalStatus.id ? `?id=${modalStatus.id}` : ''
      }`.replace(/\/\//g, '/');

      const res = await fetch(url, {
        method: modalStatus.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || 'No se pudo guardar');
        return;
      }

      closeModal();
      loadStatuses();
    } catch (e) {
      console.error(e);
      alert('Error de red guardando estado');
    }
  }

  async function deleteStatus(status) {
    if (!confirm(`¿Eliminar el estado "${status.name}"?\n\nSolo se puede eliminar si no tiene conversaciones asignadas.`)) {
      return;
    }

    try {
      const res = await fetch(
        `${BASE}/api/admin/conversation-statuses?id=${status.id}`.replace(/\/\//g, '/'),
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      );

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || 'No se pudo eliminar');
        return;
      }

      loadStatuses();
    } catch (e) {
      console.error(e);
      alert('Error de red eliminando estado');
    }
  }

  async function toggleActive(status) {
    try {
      const res = await fetch(
        `${BASE}/api/admin/conversation-statuses?id=${status.id}`.replace(/\/\//g, '/'),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ is_active: !status.is_active }),
        }
      );

      const data = await res.json();
      if (data.ok) loadStatuses();
      else alert(data.error || 'No se pudo actualizar');
    } catch (e) {
      console.error(e);
      alert('Error de red');
    }
  }

  const sortedStatuses = [...statuses].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Estados de Conversación</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Personaliza los estados del flujo de trabajo (Pipeline/CRM)
          </p>
        </div>
        <button
          onClick={openNewStatus}
          className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition"
        >
          + Nuevo Estado
        </button>
      </div>

      {/* Lista de estados */}
      {loading ? (
        <div className="p-8 text-center text-slate-600 dark:text-slate-400">Cargando estados...</div>
      ) : statuses.length === 0 ? (
        <div className="p-8 text-center text-slate-600 dark:text-slate-400">
          No hay estados configurados. Crea uno para empezar.
        </div>
      ) : (
        <div className="grid gap-2">
          {sortedStatuses.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-lg border transition ${
                s.is_active
                  ? 'bg-white dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/80'
                  : 'bg-slate-100 dark:bg-slate-900/30 border-slate-300 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</span>
                      {s.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-sky-900/60 border border-sky-600 text-sky-200">
                          Por defecto
                        </span>
                      )}
                      {!s.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-400">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{s.description}</p>
                    )}
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: s.color }}
                  title={`Color: ${s.color}`}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`px-3 py-1 rounded text-xs border transition ${
                      s.is_active
                        ? 'bg-emerald-100 dark:bg-emerald-600/30 border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-100 hover:bg-emerald-200 dark:hover:bg-emerald-600/50'
                        : 'bg-slate-200 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                    title={s.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {s.is_active ? 'Activo' : 'Inactivo'}
                  </button>

                  <button
                    onClick={() => setConfiguringFieldsFor(s)}
                    className="px-3 py-1 rounded text-xs bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-400 dark:border-amber-700"
                    title="Configurar campos personalizados que se solicitan al cambiar a este estado"
                  >
                    ⚙️ Campos
                    {(() => {
                      // required_fields puede venir como array (ya parseado) o como string JSON
                      const fields = s.required_fields
                        ? (Array.isArray(s.required_fields)
                            ? s.required_fields
                            : (typeof s.required_fields === 'string' ? JSON.parse(s.required_fields) : []))
                        : [];
                      return fields.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">
                          {fields.length}
                        </span>
                      );
                    })()}
                  </button>

                  <button
                    onClick={() => openEditStatus(s)}
                    className="px-3 py-1 rounded text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-400 dark:border-slate-700"
                  >
                    Editar
                  </button>

                  {!s.is_default && (
                    <button
                      onClick={() => deleteStatus(s)}
                      className="px-3 py-1 rounded text-xs bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {modalStatus && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {modalStatus.id ? 'Editar Estado' : 'Nuevo Estado'}
            </h3>

            <form onSubmit={saveStatus} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={modalStatus.name}
                  onChange={(e) => setModalStatus({ ...modalStatus, name: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100"
                  placeholder="Ej: Cotizado, En proceso, Cerrado"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Icono</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={modalStatus.icon}
                      onChange={(e) => setModalStatus({ ...modalStatus, icon: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100 text-center text-2xl"
                      placeholder="📋"
                      maxLength={2}
                    />
                    <div className="grid grid-cols-8 gap-1 p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                      {['📋', '💰', '📞', '✅', '❌', '⏳', '🎯', '📊', '🔔', '💬', '📝', '🚀', '⭐', '🔥', '💡', '📦'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setModalStatus({ ...modalStatus, icon: emoji })}
                          className="text-2xl p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                          title={`Usar ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Color</label>
                  <input
                    type="color"
                    value={modalStatus.color}
                    onChange={(e) => setModalStatus({ ...modalStatus, color: e.target.value })}
                    className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                <textarea
                  value={modalStatus.description}
                  onChange={(e) => setModalStatus({ ...modalStatus, description: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100 resize-none"
                  rows={2}
                  placeholder="Descripción opcional del estado"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Orden de visualización</label>
                <input
                  type="number"
                  value={modalStatus.display_order}
                  onChange={(e) =>
                    setModalStatus({ ...modalStatus, display_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100"
                  min="0"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalStatus.is_active}
                      onChange={(e) =>
                        setModalStatus({ ...modalStatus, is_active: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Estado activo</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalStatus.is_default}
                      onChange={(e) =>
                        setModalStatus({ ...modalStatus, is_default: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Estado por defecto</span>
                  </label>
                </div>

                {/* Configuración de ciclos */}
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20 border border-purple-400 dark:border-purple-700/50">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={modalStatus.is_final}
                      onChange={(e) =>
                        setModalStatus({ ...modalStatus, is_final: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-purple-800 dark:text-purple-300 font-medium">
                      🔄 Estado final (completa ciclo)
                    </span>
                  </label>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 ml-6">
                    Cuando el cliente esté en este estado y envíe un mensaje, se guardará el ciclo y se reseteará automáticamente
                  </p>

                  {modalStatus.is_final && (
                    <div className="ml-6">
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                        Estado al que resetear:
                      </label>
                      <select
                        value={modalStatus.auto_reset_to_status_id || ''}
                        onChange={(e) =>
                          setModalStatus({
                            ...modalStatus,
                            auto_reset_to_status_id: e.target.value ? Number(e.target.value) : null
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Auto (primer estado activo) --</option>
                        {statuses
                          .filter(s => s.is_active && s.id !== modalStatus.id)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.icon} {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
                >
                  {modalStatus.id ? 'Guardar cambios' : 'Crear estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configurar Campos */}
      {configuringFieldsFor && (
        <StatusFieldsConfig
          status={configuringFieldsFor}
          onClose={() => setConfiguringFieldsFor(null)}
          onSave={() => {
            loadStatuses();
            setConfiguringFieldsFor(null);
          }}
        />
      )}
    </div>
  );
}
