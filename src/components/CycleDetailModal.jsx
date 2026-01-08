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
    <>
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" style={{ colorScheme: 'light' }}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-auto pipeline-scroll">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                🔍 Detalle del Ciclo #{data?.cycle?.cycle_number || '...'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {data?.cycle?.wa_profile_name} → {data?.cycle?.wa_user}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-600 dark:text-slate-400">
              Cargando detalle del ciclo...
            </div>
          ) : (
            <>
              {/* Cycle Summary */}
              {data?.cycle && (
                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-50 via-blue-50 to-blue-50 border border-purple-200 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-blue-900/20 dark:border-purple-700/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Duración Total</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {data.cycle.duration_formatted}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Total Mensajes</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {data.cycle.total_messages}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Cambios de Estado</div>
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {data.total_state_changes}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Atendido por</div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-300">
                        {data.cycle.assigned_to_name || 'No asignado'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>⏱ {formatDate(data.cycle.started_at)}</span>
                    <span>→</span>
                    <span>{formatDate(data.cycle.completed_at)}</span>
                  </div>
                </div>
              )}

              {/* Custom Cycle Data */}
              {data?.cycle?.cycle_data && Object.keys(data.cycle.cycle_data).length > 0 && (
                <div className="mb-6 p-4 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-3">
                    📑 Información del Ciclo
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(data.cycle.cycle_data).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-slate-600 dark:text-slate-500">
                          {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                        </span>
                        <span className="ml-2 text-slate-800 dark:text-slate-200 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotations Section */}
              {data?.quotations && data.quotations.length > 0 && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/50">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                    <span>📄</span>
                    <span>Cotizaciones Asociadas ({data.quotations.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {data.quotations.map((quot) => (
                      <div 
                        key={quot.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200 dark:bg-slate-800/50 dark:border-amber-700/30"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {quot.numero_cotizacion}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            👤 {quot.usuario_nombre || 'Usuario'} • {formatDate(quot.created_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            ${Number(quot.monto).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">MXN</div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-amber-200 dark:border-amber-700/30">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Total:</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          ${data.quotations.reduce((sum, q) => sum + Number(q.monto), 0).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* State Timeline */}
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <span>🕑</span>
                  <span>Línea de Tiempo - Estados Intermedios</span>
                </h4>

                {data?.state_timeline && data.state_timeline.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-500">
                    No se encontraron cambios de estado en este ciclo
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[20px] top-4 bottom-4 w-0.5 bg-slate-300 dark:bg-slate-700"></div>

                    <div className="space-y-4">
                      {data?.state_timeline.map((state) => (
                        <div key={state.id} className="relative pl-12">
                          {/* Timeline dot */}
                          <div
                            className="absolute left-[13px] top-3 w-[15px] h-[15px] rounded-full border-[3px] border-white dark:border-slate-900"
                            style={{ backgroundColor: state.new_status_color }}
                          ></div>

                          {/* State card */}
                          <div
                            className="p-4 rounded-lg border transition-all hover:shadow-lg"
                            style={{
                              backgroundColor: `${state.new_status_color}12`,
                              borderColor: `${state.new_status_color}40`
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{state.new_status_icon || '🔖'}</span>
                                <div>
                                  <div
                                    className="font-semibold text-lg"
                                    style={{ color: state.new_status_color }}
                                  >
                                    {state.new_status_name}
                                  </div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {formatDate(state.created_at)}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                  ⏱ {state.duration_formatted}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-500">
                                  📥 {state.message_count} mensajes
                                </div>
                              </div>
                            </div>

                            {/* State change info */}
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/30">
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
                                    <span className="text-slate-600 dark:text-slate-500">→</span>
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
                                <div className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                                  👤 Cambiado por: <span className="text-slate-800 dark:text-slate-400 font-medium">{state.changed_by_name}</span>
                                </div>
                              )}

                              {state.change_reason && (
                                <div className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                                  📝 Razón: <span className="text-slate-800 dark:text-slate-400 italic">{state.change_reason}</span>
                                </div>
                              )}

                              {/* Custom field data */}
                              {state.field_data && Object.keys(state.field_data).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/30">
                                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Datos personalizados:</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(state.field_data).map(([key, value]) => (
                                      <div key={key} className="text-xs">
                                        <span className="text-slate-600 dark:text-slate-500">
                                          {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                                        </span>
                                        <span className="ml-1 text-slate-800 dark:text-slate-300 font-medium">{value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Messages in this state */}
                              {state.messages && state.messages.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/30">
                                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Conversación en este estado:</div>
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 pipeline-scroll">
                                    {state.messages.map((msg) => (
                                      <div
                                        key={msg.id}
                                        className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}
                                      >
                                        <div
                                          className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                                            msg.from_me
                                              ? 'bg-blue-100 border border-blue-200 text-slate-900 dark:bg-blue-600/30 dark:border-blue-500/50 dark:text-slate-200'
                                              : 'bg-slate-100 border border-slate-200 text-slate-900 dark:bg-slate-700/50 dark:border-slate-600/60 dark:text-slate-200'
                                          }`}
                                        >
                                          {msg.from_me && msg.usuario_nombre && (
                                            <div className="text-[10px] text-blue-600 dark:text-blue-300 mb-1">
                                              👤 {msg.usuario_nombre}
                                            </div>
                                          )}
                                          {msg.tipo === 'text' && (
                                            <div className="whitespace-pre-wrap break-words">
                                              {msg.cuerpo}
                                            </div>
                                          )}
                                          {msg.tipo === 'image' && (
                                            <div className="flex items-center gap-1">
                                              <span>🖼️</span>
                                              <span className="text-slate-600 dark:text-slate-300">Imagen</span>
                                            </div>
                                          )}
                                          {msg.tipo === 'document' && (
                                            <div className="flex items-center gap-1">
                                              <span>📄</span>
                                              <span className="text-slate-600 dark:text-slate-300">Documento</span>
                                            </div>
                                          )}
                                          {msg.tipo === 'audio' && (
                                            <div className="flex items-center gap-1">
                                              <span>🔊</span>
                                              <span className="text-slate-600 dark:text-slate-300">Audio</span>
                                            </div>
                                          )}
                                          {msg.tipo === 'video' && (
                                            <div className="flex items-center gap-1">
                                              <span>🎞️</span>
                                              <span className="text-slate-600 dark:text-slate-300">Video</span>
                                            </div>
                                          )}
                                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                            {formatTime(msg.creado_en)}
                                          </div>
                                        </div>
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
                        <div className="absolute left-[13px] top-3 w-[15px] h-[15px] rounded-full border-[3px] border-white dark:border-slate-900 bg-emerald-500"></div>
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/50">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">✓</span>
                            <div>
                              <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                Ciclo Completado
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
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
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
    <style>{`
      .pipeline-scroll {
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 #e2e8f0;
      }
      .dark .pipeline-scroll {
        scrollbar-color: #475569 #0f172a;
      }
      .pipeline-scroll::-webkit-scrollbar {
        width: 10px;
      }
      .pipeline-scroll::-webkit-scrollbar-track {
        background: #e2e8f0;
      }
      .pipeline-scroll::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 9999px;
        border: 2px solid #e2e8f0;
      }
      .pipeline-scroll::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      .dark .pipeline-scroll::-webkit-scrollbar-track {
        background: #0f172a;
      }
      .dark .pipeline-scroll::-webkit-scrollbar-thumb {
        background: #475569;
        border: 2px solid #0f172a;
      }
      .dark .pipeline-scroll::-webkit-scrollbar-thumb:hover {
        background: #64748b;
      }
    `}</style>
    </>
  );
}
