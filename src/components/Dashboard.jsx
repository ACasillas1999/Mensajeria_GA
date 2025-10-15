import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/dashboard');
        const j = await r.json();
        if (j.ok) setStats(j.stats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const Card = ({ title, value, accent }) => (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );

  if (loading) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (!stats) return <div className="text-sm text-red-400">No se pudieron cargar estadísticas</div>;

  const buildLastNDays = (n = 30) => {
    const arr = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      arr.push(iso);
    }
    return arr;
  };

  const normalizeSeries = (series, n = 30) => {
    const days = buildLastNDays(n);
    const map = new Map((series || []).map(x => [String(x.day).slice(0,10), Number(x.count) || 0]));
    const values = days.map(d => map.get(d) || 0);
    return { days, values };
  };

  const conv = normalizeSeries(stats.conv_series || [], 30);
  const msgs = normalizeSeries(stats.msg_series || [], 30);

  const Sparkline = ({ values = [], width = 400, height = 120, color = '#34d399', fill = 'rgba(52,211,153,0.15)' }) => {
    if (!values.length) return <svg width={width} height={height} />;
    const max = Math.max(...values, 1);
    const min = 0;
    const pad = 6;
    const W = width - pad * 2;
    const H = height - pad * 2;
    const step = values.length > 1 ? W / (values.length - 1) : W;
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / (max - min)) * H;
      return [x, y];
    });
    const path = points.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(' ');
    const area = `${path} L ${pad + (values.length - 1) * step},${height - pad} L ${pad},${height - pad} Z`;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkFill)" stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  };

  const Bars = ({ values = [], width = 400, height = 120, color = '#60a5fa' }) => {
    const max = Math.max(...values, 1);
    const pad = 6;
    const W = width - pad * 2;
    const H = height - pad * 2;
    const bw = values.length ? W / values.length : W;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {values.map((v, i) => {
          const h = (v / max) * H;
          const x = pad + i * bw + 1;
          const y = height - pad - h;
          const w = Math.max(1, bw - 2);
          return <rect key={i} x={x} y={y} width={w} height={h} fill={color} rx="2" />;
        })}
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 md:col-span-4"><Card title="Mis nuevas" value={stats.mine_nuevas ?? 0} accent="text-emerald-300" /></div>
      <div className="col-span-12 md:col-span-4"><Card title="Mis abiertas" value={stats.mine_abiertas ?? 0} accent="text-emerald-300" /></div>
      <div className="col-span-12 md:col-span-4"><Card title="Mis resueltas" value={stats.mine_resueltas ?? 0} accent="text-sky-300" /></div>

      <div className="col-span-12">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
          <div className="text-sm text-slate-400 mb-2">Global (todas)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Card title="Nuevas" value={stats.all_nuevas ?? 0} accent="text-emerald-300" />
            <Card title="Abiertas" value={stats.all_abiertas ?? 0} accent="text-emerald-300" />
            <Card title="Resueltas" value={stats.all_resueltas ?? 0} accent="text-sky-300" />
          </div>
        </div>
      </div>

      <div className="col-span-12 grid md:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-300">Conversaciones por día</div>
            <div className="text-xs text-slate-500">últimos 30 días</div>
          </div>
          <Sparkline values={conv.values} />
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-300">Mensajes por día</div>
            <div className="text-xs text-slate-500">últimos 30 días</div>
          </div>
          <Bars values={msgs.values} />
        </div>
      </div>

      <div className="col-span-12">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70">
          <div className="text-sm text-slate-400 mb-2">Extras</div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <Card title="Conversaciones" value={stats.total_conversaciones ?? 0} accent="text-slate-200" />
            <Card title="Sin asignar" value={stats.sin_asignar ?? 0} accent="text-amber-300" />
            <Card title="Hoy conv." value={stats.conversaciones_hoy ?? 0} accent="text-emerald-300" />
            <Card title="Mensajes" value={stats.mensajes_total ?? 0} accent="text-slate-200" />
            <Card title="Hoy msgs" value={stats.mensajes_hoy ?? 0} accent="text-emerald-300" />
            <Card title="Agentes activos" value={stats.agentes_activos ?? 0} accent="text-indigo-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
