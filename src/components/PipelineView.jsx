import { useEffect, useState, lazy, Suspense } from 'react';
import { AppDataProvider } from '../contexts/AppDataContext.jsx';
import StatusFieldsModal from './StatusFieldsModal.jsx';
import CycleHistoryModal from './CycleHistoryModal.jsx';
import ConversationTraceView from './ConversationTraceView.jsx';

const BASE = import.meta.env.BASE_URL || '';
const QuickChatModal = lazy(() => import('./QuickChatModal.jsx'));

function PipelineViewInner() {
  const [pipeline, setPipeline] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draggedConversation, setDraggedConversation] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'assigned_to_me'
  const [statusChangeModal, setStatusChangeModal] = useState({ show: false, conversation: null, newStatusId: null, status: null });
  const [cycleHistoryModal, setCycleHistoryModal] = useState({ show: false, conversationId: null, conversationName: null });
  const [traceViewModal, setTraceViewModal] = useState({ show: false, conversationId: null });
  const [quickViewId, setQuickViewId] = useState(null);

  async function loadPipeline() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'assigned_to_me') {
        params.set('assigned_to_me', '1');
      }

      const res = await fetch(
        `${BASE}/api/pipeline?${params.toString()}`.replace(/\/\//g, '/'),
        {
          credentials: 'same-origin',
        }
      );
      const data = await res.json();
      if (data.ok) {
        setPipeline(data.pipeline || []);
        setMetrics(data.metrics || null);
      } else {
        alert(data.error || 'Error cargando pipeline');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red cargando pipeline');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipeline();
    // Auto-refresh desactivado para evitar parpadeo
    // const interval = setInterval(loadPipeline, 30000);
    // return () => clearInterval(interval);
  }, [filter]);

  async function changeConversationStatus(conversationId, newStatusId, oldStatusId, fieldData) {
    if (oldStatusId === newStatusId) return;

    try {
      const res = await fetch(`${BASE}/api/conversation-status`.replace(/\/\//g, '/'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          conversation_id: conversationId,
          status_id: newStatusId,
          reason: 'Movido desde Pipeline',
          field_data: fieldData ? JSON.stringify(fieldData) : null,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || 'No se pudo cambiar el estado');
        loadPipeline(); // Recargar para revertir cambio optimista
      }
    } catch (e) {
      console.error(e);
      alert('Error cambiando estado');
      loadPipeline();
    }
  }

  // Completar ciclo manualmente
  async function handleCompleteCycle(conversationId, conversationName) {
    const confirmed = confirm(
      `¿Completar el ciclo actual de "${conversationName}"?\n\n` +
      `Esto guardará el ciclo completado y reiniciará la conversación al estado inicial.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`${BASE}/api/complete-cycle`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          conversacion_id: conversationId,
          reason: 'Completado manualmente desde Pipeline'
        })
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'No se pudo completar el ciclo');
      } else {
        alert(`Listo. ${data.message}\n\nLa conversación se reseteó a "${data.new_status.name}"`);
        loadPipeline(); // Recargar pipeline para reflejar el cambio
      }
    } catch (e) {
      console.error(e);
      alert('Error completando ciclo');
    }
  }

  // Drag & Drop handlers
  function handleDragStart(e, conversation, fromStatusId) {
    setDraggedConversation({ ...conversation, fromStatusId });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, statusId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(statusId);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e, toStatusId) {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedConversation) return;

    const { fromStatusId } = draggedConversation;

    if (fromStatusId === toStatusId) {
      setDraggedConversation(null);
      return;
    }

    // Verificar si el nuevo estado requiere campos personalizados
    const targetColumn = pipeline.find(col => col.status.id === toStatusId);
    if (targetColumn?.status?.required_fields) {
      try {
        const fields = Array.isArray(targetColumn.status.required_fields)
          ? targetColumn.status.required_fields
          : JSON.parse(targetColumn.status.required_fields);

        if (Array.isArray(fields) && fields.length > 0) {
          // Mostrar modal para capturar campos
          setStatusChangeModal({
            show: true,
            conversation: draggedConversation,
            newStatusId: toStatusId,
            status: targetColumn.status,
          });
          setDraggedConversation(null);
          return;
        }
      } catch (err) {
        console.error('Error parsing required_fields:', err);
      }
    }

    // Si no requiere campos, proceder con el cambio
    performStatusChange(draggedConversation.id, toStatusId, fromStatusId, null);
    setDraggedConversation(null);
  }

  function performStatusChange(conversationId, toStatusId, fromStatusId, fieldData) {
    // Actualización optimista
    setPipeline((prev) => {
      const newPipeline = prev.map((column) => {
        // Quitar de columna origen
        if (column.status.id === fromStatusId) {
          return {
            ...column,
            conversations: column.conversations.filter((c) => c.id !== conversationId),
            count: column.count - 1,
          };
        }
        // Agregar a columna destino
        if (column.status.id === toStatusId) {
          const conv = pipeline
            .find(col => col.status.id === fromStatusId)
            ?.conversations.find(c => c.id === conversationId);

          if (conv) {
            return {
              ...column,
              conversations: [{ ...conv, field_data: fieldData }, ...column.conversations],
              count: column.count + 1,
            };
          }
        }
        return column;
      });
      return newPipeline;
    });

    // Actualizar en servidor
    changeConversationStatus(conversationId, toStatusId, fromStatusId, fieldData);
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(Number(ts) * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pipeline de Conversaciones</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Vista tipo CRM - Arrastra conversaciones entre estados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 w-full sm:w-auto"
          >
            <option value="all">Todas las conversaciones</option>
            <option value="assigned_to_me">Asignadas a mí</option>
          </select>

          <button
            onClick={loadPipeline}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{metrics.total}</div>
          </div>
          {metrics.by_status.slice(0, 3).map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-xs text-slate-600 dark:text-slate-400">{s.status_name}</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{s.count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline Columns */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Cargando pipeline...</div>
      ) : (
        <div className="overflow-x-auto pb-4" style={{ colorScheme: 'light' }}>
          <div className="flex gap-3 min-w-min flex-nowrap touch-pan-x">
            {pipeline.map((column) => (
              <div
                key={column.status.id}
                className="flex flex-col w-[280px] sm:w-80 flex-shrink-0"
                onDragOver={(e) => handleDragOver(e, column.status.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status.id)}
              >
                {/* Column Header */}
                <div
                  className="p-3 rounded-t-lg border-t-4 flex items-center justify-between flex-shrink-0"
                  style={{
                    borderTopColor: column.status.color,
                    backgroundColor: `${column.status.color}15`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{column.status.icon}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{column.status.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {column.count}
                  </span>
                </div>

                {/* Column Body with scroll */}
                <div
                  className={`p-2 space-y-2 rounded-b-lg border border-t-0 transition-colors overflow-y-auto ${
                    dragOverColumn === column.status.id
                      ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-600'
                      : 'bg-slate-100 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700'
                  }`}
                  style={{ maxHeight: 'calc(100vh - 340px)', minHeight: '200px', colorScheme: 'light' }}
                >
                  {column.conversations.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Sin conversaciones
                    </div>
                  ) : (
                    column.conversations.map((conv) => (
                      <div
                        key={conv.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, conv, column.status.id)}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {conv.wa_profile_name || conv.wa_user}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">{conv.wa_user}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {conv.cycle_count > 0 && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCycleHistoryModal({
                                    show: true,
                                    conversationId: conv.id,
                                    conversationName: conv.wa_profile_name || conv.wa_user
                                  });
                                }}
                                className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/50 cursor-pointer hover:bg-purple-900/60 transition-colors"
                                title={`Cliente recurrente - Ciclo #${conv.cycle_count + 1} - Click para ver historial`}
                              >
                                🔁 {conv.cycle_count + 1}
                              </span>
                            )}
                            {!conv.dentro_ventana_24h && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300"
                                title="Fuera de ventana 24h"
                              >
                                ⏱️
                              </span>
                            )}
                          </div>
                        </div>

                        {conv.ultimo_msg && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                            {conv.ultimo_msg}
                          </div>
                        )}

                        {/* Mostrar campos personalizados si existen */}
                        {conv.field_data && (() => {
                          try {
                            const fieldData = typeof conv.field_data === 'string'
                              ? JSON.parse(conv.field_data)
                              : conv.field_data;

                            return Object.keys(fieldData).length > 0 && (
                              <div className="mb-2 p-2 rounded bg-slate-100 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50">
                                <div className="text-[10px] text-slate-600 dark:text-slate-400 mb-1 font-semibold">Información:</div>
                                <div className="space-y-0.5">
                                  {Object.entries(fieldData).map(([key, value]) => (
                                    <div key={key} className="text-xs flex items-start gap-1">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                                      </span>
                                      <span className="text-emerald-700 dark:text-emerald-300 font-medium truncate">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          } catch (err) {
                            console.error('Error parsing field_data:', err);
                            return null;
                          }
                        })()}

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            {conv.assigned_to_name ? (
                              <span className="text-slate-600 dark:text-slate-500">👤 {conv.assigned_to_name}</span>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-600">Sin asignar</span>
                            )}
                            {/* Botón de trazabilidad */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTraceViewModal({ show: true, conversationId: conv.id });
                              }}
                              className="px-1.5 py-0.5 rounded bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-700/50 transition-colors"
                              title="Ver trazabilidad completa"
                            >
                              🔍
                            </button>
                            {/* Botón completar ciclo */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteCycle(conv.id, conv.wa_profile_name || conv.wa_user);
                              }}
                              className="px-1.5 py-0.5 rounded bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-700/50 transition-colors"
                              title="Completar ciclo"
                            >
                              ✔️
                            </button>
                          </div>
                          <span className="text-slate-500">
                            {formatTimestamp(conv.ultimo_msg_entrante_ts)}
                          </span>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickViewId(conv.id);
                            }}
                            className="flex-1 min-w-[140px] px-2 py-1 text-xs rounded bg-sky-600/20 border border-sky-700 text-sky-300 hover:bg-sky-600/30 transition"
                          >
                            👁️ Vista rápida
                          </button>
                          <a
                            href={`${BASE}/mensajes?conversation_id=${conv.id}`.replace(/\/\//g, '/')}
                            data-astro-prefetch="tap"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-[140px] px-2 py-1 text-xs rounded bg-emerald-600/20 border border-emerald-700 text-emerald-300 hover:bg-emerald-600/30 transition text-center"
                          >
                            ↗️ Abrir
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de campos personalizados al cambiar estado */}
      {statusChangeModal.show && (
        <StatusFieldsModal
          status={statusChangeModal.status}
          conversationName={statusChangeModal.conversation?.wa_profile_name || statusChangeModal.conversation?.wa_user}
          onClose={() => setStatusChangeModal({ show: false, conversation: null, newStatusId: null, status: null })}
          onSubmit={(fieldData) => {
            performStatusChange(
              statusChangeModal.conversation.id,
              statusChangeModal.newStatusId,
              statusChangeModal.conversation.fromStatusId,
              fieldData
            );
            setStatusChangeModal({ show: false, conversation: null, newStatusId: null, status: null });
          }}
        />
      )}

      {/* Modal de historial de ciclos */}
      {cycleHistoryModal.show && (
        <CycleHistoryModal
          conversationId={cycleHistoryModal.conversationId}
          conversationName={cycleHistoryModal.conversationName}
          onClose={() => setCycleHistoryModal({ show: false, conversationId: null, conversationName: null })}
        />
      )}

      {/* Modal de trazabilidad */}
      {traceViewModal.show && (
        <ConversationTraceView
          conversationId={traceViewModal.conversationId}
          onClose={() => setTraceViewModal({ show: false, conversationId: null })}
        />
      )}

      {/* Quick View Modal */}
      {quickViewId && (
        <Suspense fallback={null}>
          <QuickChatModal
            conversationId={quickViewId}
            onClose={() => setQuickViewId(null)}
            onOpenFull={() => {
              window.location.href = `${BASE}/mensajes?conversation_id=${quickViewId}`.replace(/\/\//g, '/');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

// Wrapper con Provider
export default function PipelineView() {
  return (
    <AppDataProvider>
      <PipelineViewInner />
    </AppDataProvider>
  );
}
