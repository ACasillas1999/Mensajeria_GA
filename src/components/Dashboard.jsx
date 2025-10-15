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
    </div>
  );
}
