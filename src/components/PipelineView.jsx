import { useEffect, useState } from 'react';
import { AppDataProvider } from '../contexts/AppDataContext.jsx';

const BASE = import.meta.env.BASE_URL || '';

function PipelineViewInner() {
  const [pipeline, setPipeline] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draggedConversation, setDraggedConversation] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'assigned_to_me'

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
    const interval = setInterval(loadPipeline, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, [filter]);

  async function changeConversationStatus(conversationId, newStatusId, oldStatusId) {
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

    // Actualización optimista
    setPipeline((prev) => {
      const newPipeline = prev.map((column) => {
        // Quitar de columna origen
        if (column.status.id === fromStatusId) {
          return {
            ...column,
            conversations: column.conversations.filter((c) => c.id !== draggedConversation.id),
            count: column.count - 1,
          };
        }
        // Agregar a columna destino
        if (column.status.id === toStatusId) {
          return {
            ...column,
            conversations: [draggedConversation, ...column.conversations],
            count: column.count + 1,
          };
        }
        return column;
      });
      return newPipeline;
    });

    // Actualizar en servidor
    changeConversationStatus(draggedConversation.id, toStatusId, fromStatusId);

    setDraggedConversation(null);
  }

  function openConversation(conversationId) {
    window.location.href = `${BASE}/mensajes?conversation_id=${conversationId}`.replace(/\/\//g, '/');
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Pipeline de Conversaciones</h2>
          <p className="text-sm text-slate-400">
            Vista tipo CRM - Arrastra conversaciones entre estados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
          >
            <option value="all">Todas las conversaciones</option>
            <option value="assigned_to_me">Asignadas a mí</option>
          </select>

          <button
            onClick={loadPipeline}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
            <div className="text-xs text-slate-400">Total</div>
            <div className="text-2xl font-bold text-slate-100">{metrics.total}</div>
          </div>
          {metrics.by_status.slice(0, 3).map((s, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <div className="text-xs text-slate-400">{s.status_name}</div>
              <div className="text-2xl font-bold text-slate-100">{s.count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline Columns */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Cargando pipeline...</div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-min flex-nowrap">
            {pipeline.map((column) => (
              <div
                key={column.status.id}
                className="flex flex-col w-80 flex-shrink-0"
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
                  <span className="font-semibold text-slate-100">{column.status.name}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                  {column.count}
                </span>
              </div>

              {/* Column Body with scroll */}
              <div
                className={`p-2 space-y-2 rounded-b-lg border border-t-0 transition-colors overflow-y-auto ${
                  dragOverColumn === column.status.id
                    ? 'bg-emerald-950/30 border-emerald-600'
                    : 'bg-slate-900/40 border-slate-700'
                }`}
                style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '200px' }}
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
                      onClick={() => openConversation(conv.id)}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 cursor-move transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-100 truncate">
                            {conv.wa_profile_name || conv.wa_user}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{conv.wa_user}</div>
                        </div>
                        {!conv.dentro_ventana_24h && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300"
                            title="Fuera de ventana 24h"
                          >
                            ⏰
                          </span>
                        )}
                      </div>

                      {conv.ultimo_msg && (
                        <div className="text-xs text-slate-400 line-clamp-2 mb-2">
                          {conv.ultimo_msg}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        {conv.assigned_to_name ? (
                          <span className="text-slate-500">👤 {conv.assigned_to_name}</span>
                        ) : (
                          <span className="text-slate-600">Sin asignar</span>
                        )}
                        <span className="text-slate-500">
                          {formatTimestamp(conv.ultimo_msg_entrante_ts)}
                        </span>
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
