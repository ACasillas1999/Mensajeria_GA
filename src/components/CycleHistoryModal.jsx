import { useState, useEffect } from 'react';
import CycleDetailModal from './CycleDetailModal';

const BASE = import.meta.env.BASE_URL || '';

/**
 * Modal para mostrar el historial completo de ciclos de una conversaciÃ³n
 */
export default function CycleHistoryModal({ conversationId, conversationName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedCycleId, setSelectedCycleId] = useState(null);

  useEffect(() => {
    loadCycles();
  }, [conversationId]);

  async function loadCycles() {
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/conversation-cycles?conversation_id=${conversationId}`.replace(/\/\//g, '/'),
        { credentials: 'same-origin' }
      );
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        alert(json.error || 'Error cargando historial de ciclos');
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{ colorScheme: 'light' }}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto pipeline-scroll">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Historial de Ciclos
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {conversationName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none"
            >
              X
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-600 dark:text-slate-400">
              Cargando historial...
            </div>
          ) : (
            <>
              {/* Current Cycle Info */}
              {data?.conversation && (
                <div className="mb-6 p-4 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">
                      Ciclo Actual: #{data.conversation.cycle_count + 1}
                    </h4>
                    <div
                      className="px-3 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${data.conversation.current_status_color}30`,
                        borderColor: data.conversation.current_status_color,
                        borderWidth: '1px',
                        color: data.conversation.current_status_color
                      }}
                    >
                      {data.conversation.current_status_name}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    <div>Iniciado: {formatDate(data.conversation.current_cycle_started_at)}</div>
                    <div>DuraciÃ³n: {data.conversation.current_cycle_duration_seconds
                      ? `${Math.floor(data.conversation.current_cycle_duration_seconds / 86400)}d ${Math.floor((data.conversation.current_cycle_duration_seconds % 86400) / 3600)}h`
                      : 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* Stats */}
              {data?.stats && data.stats.total_cycles > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Ciclos Completados</div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.stats.total_cycles}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                    <div className="text-xs text-slate-600 dark:text-slate-400">DuraciÃ³n Promedio</div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{data.stats.avg_duration_formatted}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Mensajes Promedio</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.stats.avg_messages}</div>
                  </div>
                </div>
              )}

              {/* Cycles Timeline */}
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-300 mb-3">
                  Historial de Ciclos Completados
                </h4>

                {data?.cycles && data.cycles.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-500">
                    No hay ciclos completados aÃºn
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.cycles.map((cycle) => (
                      <div
                        key={cycle.id}
                        className="p-4 rounded-lg bg-slate-100 border border-slate-200 hover:border-slate-300 dark:bg-slate-800/50 dark:border-slate-700 dark:hover:border-slate-600 transition-colors cursor-pointer group"
                        onClick={() => setSelectedCycleId(cycle.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg"></span>
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span>Ciclo #{cycle.cycle_number}</span>
                                <span className="text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Ver detalle
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                {formatDate(cycle.started_at)} â†’ {formatDate(cycle.completed_at)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              {cycle.duration_formatted}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-500">
                              {cycle.total_messages} mensajes
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          {cycle.initial_status_name && (
                            <>
                              <div
                                className="px-2 py-1 rounded"
                                style={{
                                  backgroundColor: `${cycle.initial_status_color}20`,
                                  color: cycle.initial_status_color
                                }}
                              >
                                {cycle.initial_status_name}
                              </div>
                              <span className="text-slate-600 dark:text-slate-500">â†’</span>
                            </>
                          )}
                          {cycle.final_status_name && (
                            <div
                              className="px-2 py-1 rounded font-medium"
                              style={{
                                backgroundColor: `${cycle.final_status_color}30`,
                                borderColor: cycle.final_status_color,
                                borderWidth: '1px',
                                color: cycle.final_status_color
                              }}
                            >
                              {cycle.final_status_name}
                            </div>
                          )}
                        </div>

                        {cycle.assigned_to_name && (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-500">
                            Atendido por: {cycle.assigned_to_name}
                          </div>
                        )}

                        {/* Cycle Data (custom fields) */}
                        {cycle.cycle_data && Object.keys(cycle.cycle_data).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">InformaciÃ³n del ciclo:</div>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(cycle.cycle_data).map(([key, value]) => (
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
                      </div>
                    ))}
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

      {/* Cycle Detail Modal */}
      {selectedCycleId && (
        <CycleDetailModal
          cycleId={selectedCycleId}
          onClose={() => setSelectedCycleId(null)}
        />
      )}
    </div>
  );
}
