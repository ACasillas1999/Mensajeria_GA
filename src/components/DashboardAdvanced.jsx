import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

const icons = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </>
  ),
  activity: <path d="M3 12h4l2 6 4-12 2 6h4" />,
  pie: (
    <>
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M12 3v9h9" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-7 7-9-9Z" />
      <path d="M7 7h.01" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M5 4h2v2a2 2 0 0 1-2-2Z" />
      <path d="M17 4h2a2 2 0 0 1-2 2V4Z" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bar: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16v-6" />
      <path d="M12 16V5" />
      <path d="M17 16v-4" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      <path d="M8 10h8" />
      <path d="M8 6h8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8v2" />
      <path d="M16 12h-2" />
      <path d="M12 16v-2" />
      <path d="M8 12h2" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </>
  )
};

function Icon({ name, className = '' }) {
  const icon = icons[name] || icons.activity;

  return (
    <svg
      className={`w-5 h-5 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

export default function DashboardAdvanced() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview'); // overview, agents, performance

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
        <div className="text-slate-400">Cargando estadisticas...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10">
        <div className="text-sm font-medium text-slate-300">Periodo:</div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setDateRange('7')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === '7'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Ultimos 7 dias
          </button>
          <button
            onClick={() => setDateRange('30')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === '30'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Ultimos 30 dias
          </button>
          <button
            onClick={() => setDateRange('90')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dateRange === '90'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Ultimos 90 dias
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto md:ml-4">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm w-full sm:w-auto"
            />
            <span className="text-slate-500">a</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm w-full sm:w-auto"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-700 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedTab('overview')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'overview'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setSelectedTab('agents')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'agents'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Agentes
        </button>
        <button
          onClick={() => setSelectedTab('performance')}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === 'performance'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Rendimiento
        </button>
      </div>

      {selectedTab === 'overview' && (
        <OverviewTab stats={stats} analytics={analytics} />
      )}

      {selectedTab === 'agents' && (
        <AgentsTab analytics={analytics} />
      )}

      {selectedTab === 'performance' && (
        <PerformanceTab analytics={analytics} />
      )}
    </div>
  );
}

function OverviewTab({ stats, analytics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Tiempo prom. respuesta"
          value={analytics?.response_times?.[0]?.avg_response_time_formatted || 'N/A'}
          subtitle="Agente mas rapido"
          icon="clock"
          color="blue"
        />
        <MetricCard
          title="Ciclos completados"
          value={analytics?.cycle_stats?.total_cycles || 0}
          subtitle={`Promedio: ${analytics?.cycle_stats?.avg_messages_per_cycle || 0} msgs`}
          icon="repeat"
          color="purple"
        />
        <MetricCard
          title="Satisfaccion"
          value={analytics?.satisfaction?.satisfaction_rate ? `${analytics.satisfaction.satisfaction_rate}%` : 'N/A'}
          subtitle={`${analytics?.satisfaction?.positive_reactions || 0} reacciones positivas`}
          icon="smile"
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-4 items-stretch">
        {analytics?.hourly_activity && (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2 shrink-0">
              <Icon name="activity" className="text-emerald-400" />
              <span>Actividad por hora del dia (ultimos 7 dias)</span>
            </h3>
            <div className="flex-1 flex items-end">
              <HourlyActivityChart data={analytics.hourly_activity} />
            </div>
          </div>
        )}

        {stats?.statuses && (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2 shrink-0">
              <Icon name="pie" className="text-emerald-400" />
              <span>Distribucion por estado</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto pr-1">
              {stats.statuses.map(status => (
                <div
                  key={status.id}
                  className="p-3 rounded-lg border border-slate-700 bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <Icon name="tag" className="text-current" style={{ color: status.color }} />
                    <span
                      className="font-semibold"
                      style={{ color: status.color }}
                    >
                      {status.name}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-200">{status.total}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Mis: {status.mine || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {analytics?.top_conversations && analytics.top_conversations.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Icon name="trophy" className="text-emerald-400" />
            <span>Top 5 conversaciones activas (ultimos 30 dias)</span>
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

function AgentsTab({ analytics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {analytics?.workload && analytics.workload.length > 0 && (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Icon name="users" className="text-emerald-400" />
              <span>Carga de trabajo actual</span>
            </h3>
            <WorkloadChart data={analytics.workload} />
          </div>
        )}

        {analytics?.agent_performance && analytics.agent_performance.length > 0 && (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10 xl:col-span-1">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Icon name="bar" className="text-emerald-400" />
              <span>Rendimiento por agente (ultimos 30 dias)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400">Agente</th>
                    <th className="text-right py-3 px-4 text-slate-400">Tiempo 1ra resp.</th>
                    <th className="text-right py-3 px-4 text-slate-400">Conversaciones</th>
                    <th className="text-right py-3 px-4 text-slate-400">Resueltas</th>
                    <th className="text-right py-3 px-4 text-slate-400">Mensajes</th>
                    <th className="text-right py-3 px-4 text-slate-400">Ciclos</th>
                    <th className="text-right py-3 px-4 text-slate-400">Tasa resolucion</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.agent_performance.map(agent => {
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
    </div>
  );
}

function PerformanceTab({ analytics }) {
  return (
    <div className="space-y-6">
      {analytics?.response_times && analytics.response_times.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Icon name="clock" className="text-emerald-400" />
            <span>Tiempo de primera respuesta (ultimos 30 dias)</span>
          </h3>
          <div className="space-y-3">
            {analytics.response_times.map(agent => (
              <div key={agent.agent_id} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-slate-300">
                  {agent.agent_name}
                </div>
                <div className="flex-1">
                  <ResponseTimeBar
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

      {analytics?.cycle_stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Ciclos completados"
            value={analytics.cycle_stats.total_cycles}
            subtitle="Ultimos 30 dias"
            icon="repeat"
            color="purple"
          />
          <MetricCard
            title="Duracion promedio"
            value={analytics.cycle_stats.avg_duration_formatted}
            subtitle={`Min: ${formatSeconds(analytics.cycle_stats.min_duration_seconds)}`}
            icon="clock"
            color="blue"
          />
          <MetricCard
            title="Mensajes por ciclo"
            value={analytics.cycle_stats.avg_messages_per_cycle}
            subtitle="Promedio"
            icon="message"
            color="emerald"
          />
        </div>
      )}

      {analytics?.daily_activity && analytics.daily_activity.length > 0 && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Icon name="calendar" className="text-emerald-400" />
            <span>Actividad diaria (ultimos 7 dias)</span>
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

function MetricCard({ title, value, subtitle, icon, color = 'slate' }) {
  const colors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    slate: 'text-slate-300'
  };

  return (
    <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Icon name={icon} className={`${colors[color]} opacity-90`} />
          <span>{title}</span>
        </div>
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
    <div className="overflow-x-auto w-full">
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
              <div className="relative w-full h-32 bg-slate-900 rounded">
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
      <div
        className="absolute h-full bg-blue-900/30 rounded-full"
        style={{
          left: `${minPercent}%`,
          width: `${Math.max(maxPercent - minPercent, 2)}%`
        }}
      />
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
