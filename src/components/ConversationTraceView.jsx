import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL || '';

/**
 * Vista completa de trazabilidad de conversación estilo "Ticket"
 * Muestra todo el historial de estados, asignaciones, ciclos y métricas
 */
export default function ConversationTraceView({ conversationId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline'); // timeline, metrics, cycles

  useEffect(() => {
    loadTrace();
  }, [conversationId]);

  async function loadTrace() {
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/conversation-trace?conversation_id=${conversationId}`.replace(/\/\//g, '/'),
        { credentials: 'same-origin' }
      );
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        alert(json.error || 'Error cargando trazabilidad');
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
      minute: '2-digit',
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
          <div className="text-center text-slate-400">
            Cargando trazabilidad...
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { conversation, statusHistory, assignmentHistory, cycles, events, comments, metrics } = data;

  // Combinar todos los eventos en un timeline unificado
  const timelineItems = [
    ...statusHistory.map(item => ({
      type: 'status_change',
      ts: item.ts,
      date: item.changed_at,
      ...item
    })),
    ...assignmentHistory.map(item => ({
      type: 'assignment',
      ts: item.ts,
      date: item.creado_en,
      ...item
    })),
    ...comments.map(item => ({
      type: 'comment',
      ts: item.ts,
      date: item.creado_en,
      ...item
    })),
    ...events.filter(e => !['asignacion', 'reasignacion'].includes(e.tipo)).map(item => ({
      type: 'event',
      ts: item.ts,
      date: item.creado_en,
      ...item
    })),
  ].sort((a, b) => a.ts - b.ts);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                🎫 Trazabilidad de Conversación
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                {conversation.wa_profile_name || conversation.wa_user}
                <span className="mx-2">•</span>
                <span className="text-slate-400">
                  ID: {conversation.id}
                </span>
                <span className="mx-2">•</span>
                <span className="text-slate-400">
                  Creado: {formatDate(conversation.creado_en)}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-3xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Estado actual */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Estado actual:</span>
              <div
                className="px-3 py-1 rounded-lg font-medium border text-sm"
                style={{
                  backgroundColor: `${conversation.current_status_color}20`,
                  borderColor: conversation.current_status_color,
                  color: conversation.current_status_color,
                }}
              >
                {conversation.current_status_icon} {conversation.current_status_name}
              </div>
            </div>
            <div className="text-sm text-slate-400">
              Tiempo en estado: <span className="text-slate-200 font-medium">{metrics.currentStateDurationFormatted}</span>
            </div>
            {conversation.assigned_to_name && (
              <div className="text-sm text-slate-400">
                Asignado a: <span className="text-slate-200 font-medium">👤 {conversation.assigned_to_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700 px-6 bg-slate-900/50">
          <div className="flex gap-1">
            {[
              { id: 'timeline', label: '📋 Timeline', icon: '📋' },
              { id: 'metrics', label: '📊 Métricas', icon: '📊' },
              { id: 'cycles', label: '🔄 Ciclos', icon: '🔄' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === tab.id
                    ? 'text-purple-300 border-purple-500'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'timeline' && (
            <TimelineTab timelineItems={timelineItems} formatDateTime={formatDateTime} />
          )}
          {activeTab === 'metrics' && (
            <MetricsTab metrics={metrics} conversation={conversation} />
          )}
          {activeTab === 'cycles' && (
            <CyclesTab cycles={cycles} formatDate={formatDate} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-6 py-4 bg-slate-900/50">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              Tiempo de vida total: <span className="text-slate-200 font-medium">{metrics.totalLifetimeFormatted}</span>
              <span className="mx-2">•</span>
              {metrics.totalStatusChanges} cambios de estado
              <span className="mx-2">•</span>
              {cycles.length} ciclos completados
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tab de Timeline - Muestra todos los eventos cronológicamente
 */
function TimelineTab({ timelineItems, formatDateTime }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">
        Historial Completo ({timelineItems.length} eventos)
      </h3>

      {timelineItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No hay eventos registrados
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />

          <div className="space-y-4">
            {timelineItems.map((item, index) => (
              <TimelineItem
                key={`${item.type}-${item.id || index}`}
                item={item}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Componente individual de timeline
 */
function TimelineItem({ item, formatDateTime }) {
  const getItemConfig = () => {
    switch (item.type) {
      case 'status_change':
        return {
          icon: '🔄',
          color: item.new_status_color || '#64748b',
          title: 'Cambio de estado',
          content: (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {item.old_status_name && (
                  <>
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: `${item.old_status_color}20`,
                        color: item.old_status_color,
                      }}
                    >
                      {item.old_status_icon} {item.old_status_name}
                    </span>
                    <span className="text-slate-600">→</span>
                  </>
                )}
                <span
                  className="px-2 py-1 rounded text-xs font-medium border"
                  style={{
                    backgroundColor: `${item.new_status_color}30`,
                    borderColor: item.new_status_color,
                    color: item.new_status_color,
                  }}
                >
                  {item.new_status_icon} {item.new_status_name}
                </span>
              </div>
              {item.changed_by_name && (
                <div className="text-xs text-slate-500">
                  Por: {item.changed_by_name}
                </div>
              )}
              {item.duration_in_previous_state_seconds > 0 && (
                <div className="text-xs text-slate-500">
                  Duración en estado anterior: {formatDuration(item.duration_in_previous_state_seconds)}
                </div>
              )}
              {item.field_data && Object.keys(item.field_data).length > 0 && (
                <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs">
                  <div className="text-slate-400 mb-1">Datos adicionales:</div>
                  {Object.entries(item.field_data).map(([key, value]) => (
                    <div key={key} className="text-slate-300">
                      <span className="text-slate-500">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        };
      case 'assignment':
        return {
          icon: '👤',
          color: '#0ea5e9',
          title: item.texto || 'Asignación',
          content: item.usuario_nombre && (
            <div className="text-xs text-slate-500">
              Por: {item.usuario_nombre}
            </div>
          ),
        };
      case 'comment':
        return {
          icon: '💬',
          color: '#8b5cf6',
          title: 'Comentario interno',
          content: (
            <div className="space-y-1">
              <div className="text-sm text-slate-300">{item.comentario}</div>
              <div className="text-xs text-slate-500">
                Por: {item.usuario_nombre}
              </div>
            </div>
          ),
        };
      case 'event':
        return {
          icon: '📌',
          color: '#64748b',
          title: item.tipo || 'Evento',
          content: (
            <div className="space-y-1">
              {item.texto && <div className="text-sm text-slate-300">{item.texto}</div>}
              {item.usuario_nombre && (
                <div className="text-xs text-slate-500">
                  Por: {item.usuario_nombre}
                </div>
              )}
            </div>
          ),
        };
      default:
        return {
          icon: '•',
          color: '#64748b',
          title: 'Evento',
          content: null,
        };
    }
  };

  const config = getItemConfig();

  return (
    <div className="flex gap-4 relative">
      {/* Icon */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 bg-slate-900 z-10"
        style={{ borderColor: config.color }}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="font-medium text-slate-200">{config.title}</div>
          <div className="text-xs text-slate-500 whitespace-nowrap">
            {formatDateTime(item.date)}
          </div>
        </div>
        {config.content && (
          <div className="text-slate-400">
            {config.content}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tab de Métricas - Muestra KPIs y estadísticas
 */
function MetricsTab({ metrics, conversation }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-200">
        Métricas de Rendimiento
      </h3>

      {/* KPIs generales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Tiempo total</div>
          <div className="text-2xl font-bold text-emerald-400">
            {metrics.totalLifetimeFormatted}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Estado actual</div>
          <div className="text-2xl font-bold text-blue-400">
            {metrics.currentStateDurationFormatted}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Cambios de estado</div>
          <div className="text-2xl font-bold text-purple-400">
            {metrics.totalStatusChanges}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Ciclos completados</div>
          <div className="text-2xl font-bold text-amber-400">
            {metrics.cycles.total}
          </div>
        </div>
      </div>

      {/* Tiempo por estado */}
      <div>
        <h4 className="font-semibold text-slate-300 mb-3">Tiempo por Estado</h4>
        <div className="space-y-2">
          {metrics.statusMetrics.map(status => (
            <div
              key={status.statusId}
              className="p-3 rounded-lg bg-slate-800/30 border border-slate-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{
                    backgroundColor: `${status.statusColor}20`,
                    color: status.statusColor,
                  }}
                >
                  {status.statusName}
                </div>
                <div className="text-sm font-medium text-slate-200">
                  {formatDuration(status.totalSeconds)}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div>
                  Promedio: <span className="text-slate-300">{formatDuration(status.averageSeconds)}</span>
                </div>
                <div>
                  Veces: <span className="text-slate-300">{status.count}</span>
                </div>
                <div>
                  {status.percentage.toFixed(1)}% del tiempo total
                </div>
              </div>
              {/* Barra de progreso */}
              <div className="mt-2 h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(status.percentage, 100)}%`,
                    backgroundColor: status.statusColor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Métricas de ciclos */}
      {metrics.cycles.total > 0 && (
        <div>
          <h4 className="font-semibold text-slate-300 mb-3">Métricas de Ciclos</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-700/50">
              <div className="text-xs text-purple-300">Duración promedio</div>
              <div className="text-lg font-bold text-purple-200">
                {metrics.cycles.avgDurationFormatted}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-700/50">
              <div className="text-xs text-purple-300">Mensajes promedio</div>
              <div className="text-lg font-bold text-purple-200">
                {metrics.cycles.avgMessages}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-700/50">
              <div className="text-xs text-purple-300">Total ciclos</div>
              <div className="text-lg font-bold text-purple-200">
                {metrics.cycles.total}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tab de Ciclos - Muestra historial de ciclos
 */
function CyclesTab({ cycles, formatDate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-200">
        Historial de Ciclos ({cycles.length})
      </h3>

      {cycles.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No hay ciclos completados aún
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <div
              key={cycle.id}
              className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <div className="font-semibold text-slate-100">
                      Ciclo #{cycle.cycle_number}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDate(cycle.started_at)} → {formatDate(cycle.completed_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-emerald-400">
                    {formatDuration(cycle.duration_seconds)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {cycle.total_messages} mensajes
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs mb-3">
                {cycle.initial_status_name && (
                  <>
                    <div
                      className="px-2 py-1 rounded"
                      style={{
                        backgroundColor: `${cycle.initial_status_color}20`,
                        color: cycle.initial_status_color,
                      }}
                    >
                      {cycle.initial_status_icon} {cycle.initial_status_name}
                    </div>
                    <span className="text-slate-600">→</span>
                  </>
                )}
                {cycle.final_status_name && (
                  <div
                    className="px-2 py-1 rounded font-medium border"
                    style={{
                      backgroundColor: `${cycle.final_status_color}30`,
                      borderColor: cycle.final_status_color,
                      color: cycle.final_status_color,
                    }}
                  >
                    {cycle.final_status_icon} {cycle.final_status_name}
                  </div>
                )}
              </div>

              {cycle.assigned_to_name && (
                <div className="text-xs text-slate-500 mb-2">
                  👤 Atendido por: {cycle.assigned_to_name}
                </div>
              )}

              {cycle.cycle_data && Object.keys(cycle.cycle_data).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-2">Información del ciclo:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(cycle.cycle_data).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="text-slate-500">
                          {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                        </span>
                        <span className="ml-1 text-slate-300 font-medium">{String(value)}</span>
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
  );
}

/**
 * Formatear duración
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}
