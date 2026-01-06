import { useEffect, useState, lazy, Suspense } from 'react';

const BASE = import.meta.env.BASE_URL || '';
const QuickChatModal = lazy(() => import('./QuickChatModal.jsx'));

export default function AgentAudit() {
  const [data, setData] = useState({ agents: [], activeChats: [] });
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [viewMode, setViewMode] = useState('overview'); // overview | agent-detail
  const [quickViewId, setQuickViewId] = useState(null);

  async function load() {
    try {
      const r = await fetch(`${BASE}/api/admin/agent-metrics`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) {
        setData({ agents: j.agents || [], activeChats: j.activeChats || [] });
      }
    } catch (err) {
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // refresh cada 10s
    return () => clearInterval(interval);
  }, []);

  function formatTimestamp(ts) {
    if (!ts) return 'Nunca';
    const date = new Date(ts * 1000);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return date.toLocaleDateString();
  }

  const activeAgents = data.agents.filter(a => a.ultima_actividad_ts && (Date.now() / 1000 - a.ultima_actividad_ts) < 300); // activos en últimos 5min

  if (loading) {
    return <div className="p-4 text-slate-400">Cargando...</div>;
  }

  if (viewMode === 'agent-detail' && selectedAgent) {
    const agent = data.agents.find(a => a.id === selectedAgent);
    const agentChats = data.activeChats.filter(c => c.asignado_a === selectedAgent);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setViewMode('overview'); setSelectedAgent(null); }}
            className="px-3 py-2 rounded border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <- Volver
          </button>
          <div>
            <h2 className="text-xl font-semibold">{agent?.nombre}</h2>
            <p className="text-sm text-slate-400">{agent?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total conversaciones</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{agent?.total_conversaciones || 0}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Mensajes hoy</div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{agent?.mensajes_hoy || 0}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Mensajes semana</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{agent?.mensajes_semana || 0}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">Última actividad</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatTimestamp(agent?.ultima_actividad_ts)}</div>
          </div>
        </div>

        {/* Chats activos del agente */}
        <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-300 dark:border-slate-800 font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span>Conversaciones activas</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">{agentChats.length}</span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[60vh] overflow-y-auto thin-scroll">
            {agentChats.length === 0 && (
              <div className="p-4 text-sm text-slate-500 dark:text-slate-400 text-center">Sin conversaciones activas</div>
            )}
            {agentChats.map(chat => (
              <div key={chat.conversacion_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{chat.wa_profile_name || chat.wa_user}</div>
                  <div className="flex items-center gap-2">
                    {chat.activo_ahora === 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-700">
                        En vivo
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                      {chat.estado}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{chat.ultimo_msg || '-'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">{formatTimestamp(chat.ultimo_ts)}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewId(chat.conversacion_id);
                    }}
                    className="flex-1 text-xs px-2 py-1 rounded border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition dark:border-sky-700 dark:bg-sky-600/20 dark:text-sky-300 dark:hover:bg-sky-600/30"
                  >
                    Vista rápida
                  </button>
                  <a
                    href={`${BASE}/mensajes?conversation_id=${chat.conversacion_id}`.replace(/\/\//g, '/')}
                    data-astro-prefetch="tap"
                    className="flex-1 text-xs px-2 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-center dark:border-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-300 dark:hover:bg-emerald-600/30"
                  >
                    Ver chat
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista general
  return (
    <div className="space-y-4">
      {/* Header con stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-4 shadow-sm">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Agentes totales</div>
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{data.agents.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-4 shadow-sm">
          <div className="text-xs text-sky-700 dark:text-sky-400 mb-1">Activos ahora</div>
          <div className="text-3xl font-bold text-sky-700 dark:text-sky-300">{activeAgents.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-4 shadow-sm">
          <div className="text-xs text-purple-700 dark:text-purple-400 mb-1">Chats activos</div>
          <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{data.activeChats.filter(c => c.activo_ahora === 1).length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-4 shadow-sm">
          <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">Total conversaciones</div>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
            {data.agents.reduce((sum, a) => sum + (a.total_conversaciones || 0), 0)}
          </div>
        </div>
      </div>

      {/* Tabla de agentes */}
      <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-300 dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100">Agentes</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-300 dark:bg-slate-900/60 dark:border-slate-800">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Agente</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Sucursal</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Estado</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Conversaciones</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Msgs Hoy</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Msgs Semana</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Última actividad</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.agents.map(agent => {
                const isActive = agent.ultima_actividad_ts && (Date.now() / 1000 - agent.ultima_actividad_ts) < 300;
                const agentActiveChats = data.activeChats.filter(c => c.asignado_a === agent.id && c.activo_ahora === 1);

                return (
                  <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs text-slate-700 dark:text-slate-100">
                          {agent.nombre[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{agent.nombre}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{agent.sucursal || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-300 animate-pulse"></span>
                          En línea
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-500"></span>
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-semibold">{agent.total_conversaciones || 0}</div>
                      <div className="text-xs text-slate-500">
                        {agent.conversaciones_abiertas || 0} abiertas
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">{agent.mensajes_hoy || 0}</td>
                    <td className="px-4 py-3 text-center text-sm">{agent.mensajes_semana || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatTimestamp(agent.ultima_actividad_ts)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setSelectedAgent(agent.id); setViewMode('agent-detail'); }}
                        className="text-xs px-3 py-1 rounded border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chats activos en tiempo real */}
      <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-300 dark:border-slate-800 font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <span>Chats activos en este momento</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-700">
            {data.activeChats.filter(c => c.activo_ahora === 1).length} en vivo
          </span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[400px] overflow-y-auto thin-scroll">
          {data.activeChats.filter(c => c.activo_ahora === 1).length === 0 && (
            <div className="p-4 text-sm text-slate-500 dark:text-slate-400 text-center">No hay conversaciones activas en este momento</div>
          )}
          {data.activeChats.filter(c => c.activo_ahora === 1).map(chat => (
            <div key={chat.conversacion_id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate text-slate-900 dark:text-slate-100">{chat.wa_profile_name || chat.wa_user}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 shrink-0 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                    {chat.estado}
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{chat.ultimo_msg || '-'}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-sky-600 dark:text-sky-400 mb-1">👤 {chat.agente_nombre || 'Sin asignar'}</div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewId(chat.conversacion_id);
                    }}
                    className="text-xs px-2 py-1 rounded border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition dark:border-sky-700 dark:bg-sky-600/20 dark:text-sky-300 dark:hover:bg-sky-600/30"
                  >
                    Vista
                  </button>
                  <a
                    href={`${BASE}/mensajes?conversation_id=${chat.conversacion_id}`.replace(/\/\//g, '/')}
                    data-astro-prefetch="tap"
                    className="text-xs px-2 py-1 rounded border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 inline-block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Espiar →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
