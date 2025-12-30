import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function DashboardAdvanced() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview'); // overview, agents, performance

  // Date range state
  const [dateRange, setDateRange] = useState('30'); // 7, 30, 90, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, [dateRange, customStartDate, customEndDate]);

  async function loadData() {
    setLoading(true);
    try {
      let analyticsUrl = `${BASE}/api/dashboard-analytics`.replace(/\/\//g, '/');

      // Add date range parameters
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        analyticsUrl += `?start_date=${customStartDate}&end_date=${customEndDate}`;
      } else {
        analyticsUrl += `?days=${dateRange}`;
      }

      const [statsRes, analyticsRes] = await Promise.all([
        fetch(`${BASE}/api/dashboard`.replace(/\/\//g, '/')),
        fetch(analyticsUrl)
      ]);

      const statsData = await statsRes.json();
      const analyticsData = await analyticsRes.json();

      if (statsData.ok) setStats(statsData.stats);
      if (analyticsData.ok) setAnalytics(analyticsData.analytics);
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Cargando estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70">
        <div className="text-sm font-medium text-slate-300">Período:</div>

        <div className="flex gap-2">
          <button
            onClick={() => setDateRange('7')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === '7'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Últimos 7 días
          </button>
          <button
            onClick={() => setDateRange('30')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === '30'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Últimos 30 días
          </button>
          <button
            onClick={() => setDateRange('90')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === '90'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Últimos 90 días
          </button>
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === 'custom'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Personalizado
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-4">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm"
            />
            <span className="text-slate-500">a</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setSelectedTab('overview')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'overview'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📊 Resumen General
        </button>
        <button
          onClick={() => setSelectedTab('agents')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'agents'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          👥 Rendimiento de Agentes
        </button>
        <button
          onClick={() => setSelectedTab('performance')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'performance'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚡ Análisis de Rendimiento
        </button>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <OverviewTab stats={stats} analytics={analytics} />
      )}

      {/* Agents Tab */}
      {selectedTab === 'agents' && (
        <AgentsTab analytics={analytics} />
      )}

      {/* Performance Tab */}
      {selectedTab === 'performance' && (
        <PerformanceTab analytics={analytics} />
      )}
    </div>
  );
}

// ============ OVERVIEW TAB ============
function OverviewTab({ stats, analytics }) {
  return (
    <div className="space-y-6">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Tiempo Prom. Respuesta"
          value={analytics?.response_times?.[0]?.avg_response_time_formatted || 'N/A'}
          subtitle="Del agente más rápido"
          icon="⚡"
          color="blue"
        />
        <MetricCard
          title="Ciclos Completados"
          value={analytics?.cycle_stats?.total_cycles || 0}
          subtitle={`Promedio: ${analytics?.cycle_stats?.avg_messages_per_cycle || 0} msgs`}
          icon="🔄"
          color="purple"
        />
        <MetricCard
          title="Satisfacción"
          value={analytics?.satisfaction?.satisfaction_rate ? `${analytics.satisfaction.satisfaction_rate}%` : 'N/A'}
          subtitle={`${analytics?.satisfaction?.positive_reactions || 0} reacciones positivas`}
          icon="😊"
          color="amber"
        />
      </div>

      {/* Actividad por Hora del Día */}
      {analytics?.hourly_activity && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            📈 Actividad por Hora del Día (Últimos 7 días)
          </h3>
          <HourlyActivityChart data={analytics.hourly_activity} />
        </div>
      )}

      {/* Estadísticas de Estado */}
      {stats?.statuses && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            📋 Distribución por Estado
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.statuses.map(status => (
              <div
                key={status.id}
                className="p-4 rounded-lg border border-slate-700 bg-slate-900/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{status.icon}</span>
                  <span
                    className="font-medium"
                    style={{ color: status.color }}
                  >
                    {status.name}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-200">{status.total}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Mis: {status.mine || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 Conversaciones */}
      {analytics?.top_conversations && analytics.top_conversations.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            🏆 Top 5 Conversaciones Más Activas (Últimos 30 días)
          </h3>
          <div className="space-y-2">
            {analytics.top_conversations.map((conv, idx) => (
              <div
                key={conv.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-900/30 text-emerald-400 font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-slate-200">
                      {conv.wa_profile_name || conv.wa_user}
                    </div>
                    <div className="text-xs text-slate-500">
                      Agente: {conv.assigned_agent || 'Sin asignar'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-400">
                    {conv.message_count}
                  </div>
                  <div className="text-xs text-slate-500">mensajes</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ AGENTS TAB ============
function AgentsTab({ analytics }) {
  return (
    <div className="space-y-6">
      {/* Carga de Trabajo Actual */}
      {analytics?.workload && analytics.workload.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            📊 Carga de Trabajo Actual por Agente
          </h3>
          <WorkloadChart data={analytics.workload} />
        </div>
      )}

      {/* Rendimiento por Agente */}
      {analytics?.agent_performance && analytics.agent_performance.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            🎯 Rendimiento por Agente (Últimos 30 días)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400">Agente</th>
                  <th className="text-right py-3 px-4 text-slate-400">Tiempo 1ra Resp.</th>
                  <th className="text-right py-3 px-4 text-slate-400">Conversaciones</th>
                  <th className="text-right py-3 px-4 text-slate-400">Resueltas</th>
                  <th className="text-right py-3 px-4 text-slate-400">Mensajes</th>
                  <th className="text-right py-3 px-4 text-slate-400">Ciclos</th>
                  <th className="text-right py-3 px-4 text-slate-400">Tasa Resolución</th>
                </tr>
              </thead>
              <tbody>
                {analytics.agent_performance.map(agent => {
                  // Buscar el tiempo de respuesta de este agente
                  const responseTime = analytics.response_times?.find(rt => rt.agent_id === agent.agent_id);

                  return (
                    <tr key={agent.agent_id} className="border-b border-slate-800 hover:bg-slate-900/50">
                      <td className="py-3 px-4 font-medium text-slate-200">{agent.agent_name}</td>
                      <td className="py-3 px-4 text-right text-blue-400 font-medium">
                        {responseTime?.avg_response_time_formatted || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{agent.conversations_handled}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">{agent.conversations_resolved}</td>
                      <td className="py-3 px-4 text-right text-blue-400">{agent.messages_sent}</td>
                      <td className="py-3 px-4 text-right text-purple-400">{agent.cycles_completed}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-semibold ${
                          agent.resolution_rate >= 75 ? 'text-emerald-400' :
                          agent.resolution_rate >= 50 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {agent.resolution_rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ PERFORMANCE TAB ============
function PerformanceTab({ analytics }) {
  return (
    <div className="space-y-6">
      {/* Tiempo de Respuesta por Agente */}
      {analytics?.response_times && analytics.response_times.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            ⚡ Tiempo de Primera Respuesta por Agente (Últimos 30 días)
          </h3>
          <div className="space-y-3">
            {analytics.response_times.map(agent => (
              <div key={agent.agent_id} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-slate-300">
                  {agent.agent_name}
                </div>
                <div className="flex-1">
                  <ResponseTimeBar
                    name={agent.agent_name}
                    avgTime={agent.avg_response_time_seconds}
                    minTime={agent.min_response_time_seconds}
                    maxTime={agent.max_response_time_seconds}
                    maxValue={Math.max(...analytics.response_times.map(a => a.max_response_time_seconds))}
                  />
                </div>
                <div className="w-24 text-right text-sm">
                  <div className="font-bold text-emerald-400">
                    {agent.avg_response_time_formatted}
                  </div>
                  <div className="text-xs text-slate-500">promedio</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estadísticas de Ciclos */}
      {analytics?.cycle_stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Ciclos Completados"
            value={analytics.cycle_stats.total_cycles}
            subtitle="Últimos 30 días"
            icon="🔄"
            color="purple"
          />
          <MetricCard
            title="Duración Promedio"
            value={analytics.cycle_stats.avg_duration_formatted}
            subtitle={`Min: ${formatSeconds(analytics.cycle_stats.min_duration_seconds)}`}
            icon="⏱️"
            color="blue"
          />
          <MetricCard
            title="Mensajes por Ciclo"
            value={analytics.cycle_stats.avg_messages_per_cycle}
            subtitle="Promedio"
            icon="💬"
            color="emerald"
          />
        </div>
      )}

      {/* Actividad Diaria */}
      {analytics?.daily_activity && analytics.daily_activity.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            📅 Actividad Diaria (Últimos 7 días)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400">Fecha</th>
                  <th className="text-right py-3 px-4 text-slate-400">Conversaciones</th>
                  <th className="text-right py-3 px-4 text-slate-400">Mensajes</th>
                </tr>
              </thead>
              <tbody>
                {analytics.daily_activity.map(day => (
                  <tr key={day.day} className="border-b border-slate-800">
                    <td className="py-3 px-4 text-slate-300">
                      {new Date(day.day).toLocaleDateString('es-MX', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-medium">
                      {day.conversations}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-400 font-medium">
                      {day.messages}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function MetricCard({ title, value, subtitle, icon, color = 'slate' }) {
  const colors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400'
  };

  return (
    <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70">
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm text-slate-400">{title}</div>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${colors[color]} mb-1`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500">{subtitle}</div>
      )}
    </div>
  );
}

function HourlyActivityChart({ data }) {
  const maxCount = Math.max(...data.map(d => d.message_count), 1);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 min-w-[720px] md:min-w-0"
        style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
      >
        {Array.from({ length: 24 }, (_, hour) => {
          const hourData = data.find(d => d.hour === hour);
          const count = hourData?.message_count || 0;
          const height = (count / maxCount) * 100;

          return (
            <div key={hour} className="flex flex-col items-center gap-1">
              <div className="relative w-full h-20 bg-slate-900 rounded">
                <div
                  className="absolute bottom-0 w-full bg-emerald-500 rounded transition-all"
                  style={{ height: `${height}%` }}
                  title={`${hour}:00 - ${count} mensajes`}
                />
              </div>
              <div className="text-[10px] text-slate-500">{hour}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkloadChart({ data }) {
  const maxConversations = Math.max(...data.map(d => d.active_conversations), 1);

  return (
    <div className="space-y-3">
      {data.map(agent => {
        const percentage = (agent.active_conversations / maxConversations) * 100;

        return (
          <div key={agent.agent_id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-300">{agent.agent_name}</span>
              <span className="text-sm text-slate-400">
                {agent.active_conversations} conversaciones ({agent.open_conversations} abiertas)
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-6">
              <div
                className="bg-emerald-500 h-6 rounded-full transition-all flex items-center justify-end pr-2"
                style={{ width: `${percentage}%` }}
              >
                {percentage > 20 && (
                  <span className="text-xs font-medium text-white">
                    {agent.active_conversations}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResponseTimeBar({ avgTime, minTime, maxTime, maxValue }) {
  const avgPercent = (avgTime / maxValue) * 100;
  const minPercent = (minTime / maxValue) * 100;
  const maxPercent = (maxTime / maxValue) * 100;

  return (
    <div className="relative w-full h-8 bg-slate-900 rounded-full overflow-hidden">
      {/* Rango completo (min a max) */}
      <div
        className="absolute h-full bg-blue-900/30 rounded-full"
        style={{
          left: `${minPercent}%`,
          width: `${maxPercent - minPercent}%`
        }}
      />
      {/* Promedio */}
      <div
        className="absolute h-full bg-emerald-500 rounded-full transition-all"
        style={{ width: `${avgPercent}%` }}
      />
    </div>
  );
}

function formatSeconds(seconds) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
