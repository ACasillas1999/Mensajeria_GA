import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL || '';

/**
 * Modal para mostrar el detalle completo de un ciclo específico
 * Muestra todos los estados intermedios por los que pasó la conversación
 */
export default function CycleDetailModal({ cycleId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadCycleDetail();
  }, [cycleId]);

  async function loadCycleDetail() {
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/cycle-detail?cycle_id=${cycleId}`.replace(/\/\//g, '/'),
        { credentials: 'same-origin' }
      );
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        alert(json.error || 'Error cargando detalle del ciclo');
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert('Error de red');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                🔍 Detalle del Ciclo #{data?.cycle?.cycle_number || '...'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {data?.cycle?.wa_profile_name} • {data?.cycle?.wa_user}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              Cargando detalle del ciclo...
            </div>
          ) : (
            <>
              {/* Cycle Summary */}
              {data?.cycle && (
                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-slate-400">Duración Total</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {data.cycle.duration_formatted}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Total Mensajes</div>
                      <div className="text-lg font-bold text-blue-400">
                        {data.cycle.total_messages}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Cambios de Estado</div>
                      <div className="text-lg font-bold text-purple-400">
                        {data.total_state_changes}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Atendido por</div>
                      <div className="text-sm font-medium text-slate-300">
                        {data.cycle.assigned_to_name || 'No asignado'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>📅 {formatDate(data.cycle.started_at)}</span>
                    <span>→</span>
                    <span>{formatDate(data.cycle.completed_at)}</span>
                  </div>
                </div>
              )}

              {/* Custom Cycle Data */}
              {data?.cycle?.cycle_data && Object.keys(data.cycle.cycle_data).length > 0 && (
                <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">
                    📋 Información del Ciclo
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(data.cycle.cycle_data).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-slate-500">
                          {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                        </span>
                        <span className="ml-2 text-slate-200 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* State Timeline */}
              <div>
                <h4 className="font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <span>📊</span>
                  <span>Línea de Tiempo - Estados Intermedios</span>
                </h4>

                {data?.state_timeline && data.state_timeline.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No se encontraron cambios de estado en este ciclo
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[20px] top-4 bottom-4 w-0.5 bg-slate-700"></div>

                    <div className="space-y-4">
                      {data?.state_timeline.map((state, index) => (
                        <div key={state.id} className="relative pl-12">
                          {/* Timeline dot */}
                          <div
                            className="absolute left-[13px] top-3 w-[15px] h-[15px] rounded-full border-[3px] border-slate-900"
                            style={{ backgroundColor: state.new_status_color }}
                          ></div>

                          {/* State card */}
                          <div
                            className="p-4 rounded-lg border transition-all hover:shadow-lg"
                            style={{
                              backgroundColor: `${state.new_status_color}10`,
                              borderColor: `${state.new_status_color}40`
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{state.new_status_icon || '📍'}</span>
                                <div>
                                  <div
                                    className="font-semibold text-lg"
                                    style={{ color: state.new_status_color }}
                                  >
                                    {state.new_status_name}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {formatDate(state.created_at)}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-medium text-emerald-400">
                                  ⏱️ {state.duration_formatted}
                                </div>
                                <div className="text-xs text-slate-500">
                                  💬 {state.message_count} mensajes
                                </div>
                              </div>
                            </div>

                            {/* State change info */}
                            <div className="mt-2 pt-2 border-t border-slate-700/30">
                              <div className="flex items-center gap-2 text-xs mb-1">
                                {state.old_status_name && (
                                  <>
                                    <span
                                      className="px-2 py-1 rounded"
                                      style={{
                                        backgroundColor: `${state.old_status_color}20`,
                                        color: state.old_status_color
                                      }}
                                    >
                                      {state.old_status_icon} {state.old_status_name}
                                    </span>
                                    <span className="text-slate-600">→</span>
                                  </>
                                )}
                                <span
                                  className="px-2 py-1 rounded font-medium"
                                  style={{
                                    backgroundColor: `${state.new_status_color}30`,
                                    color: state.new_status_color
                                  }}
                                >
                                  {state.new_status_icon} {state.new_status_name}
                                </span>
                              </div>

                              {state.changed_by_name && (
                                <div className="text-xs text-slate-500 mt-1">
                                  👤 Cambiado por: <span className="text-slate-400 font-medium">{state.changed_by_name}</span>
                                </div>
                              )}

                              {state.change_reason && (
                                <div className="text-xs text-slate-500 mt-1">
                                  📝 Razón: <span className="text-slate-400 italic">{state.change_reason}</span>
                                </div>
                              )}

                              {/* Custom field data */}
                              {state.field_data && Object.keys(state.field_data).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-700/30">
                                  <div className="text-xs text-slate-400 mb-1">Datos personalizados:</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(state.field_data).map(([key, value]) => (
                                      <div key={key} className="text-xs">
                                        <span className="text-slate-500">
                                          {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                                        </span>
                                        <span className="ml-1 text-slate-300 font-medium">{value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Final completion marker */}
                      <div className="relative pl-12">
                        <div className="absolute left-[13px] top-3 w-[15px] h-[15px] rounded-full border-[3px] border-slate-900 bg-emerald-500"></div>
                        <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/50">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">✅</span>
                            <div>
                              <div className="text-sm font-semibold text-emerald-400">
                                Ciclo Completado
                              </div>
                              <div className="text-xs text-slate-400">
                                {formatDate(data?.cycle?.completed_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
