import { useEffect, useMemo, useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function UnrecognizedMessagesAnalytics() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('all'); // all | pending | resolved
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('q', search.trim());
    if (resolvedFilter === 'pending') p.set('resolved', '0');
    if (resolvedFilter === 'resolved') p.set('resolved', '1');
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return p.toString();
  }, [search, resolvedFilter, from, to, page, pageSize]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(
        `${BASE}/api/admin/unrecognized-messages?${queryString}`.replace(/\/\//g, '/')
      );
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Error al cargar');
      setItems(j.items || []);
      setStats(j.stats || null);
      setTop(j.top || []);
      setTotal(j.pagination?.total || 0);
    } catch (e) {
      setError(e.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const markResolved = async (id, resolved) => {
    try {
      const r = await fetch(
        `${BASE}/api/admin/unrecognized-messages`.replace(/\/\//g, '/'),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, resolved }),
        }
      );
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Error al actualizar');
      await load();
    } catch (e) {
      alert(e.message || 'Error al actualizar');
    }
  };

  const createRuleFromMessage = (messageText) => {
    if (!messageText) return;
    try {
      const encoded = encodeURIComponent(messageText);
      const target = `${BASE}/admin/auto-respuestas?fromMessage=${encoded}`.replace(
        /\/\//g,
        '/'
      );
      window.location.href = target;
    } catch (e) {
      console.error('Error navegando a auto-respuestas:', e);
    }
  };

  const StatCard = ({ label, value, accent }) => (
    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accent}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-slate-400 mb-1">
            Buscar texto del mensaje
          </label>
          <input
            type="text"
            className="w-full px-2 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-100"
            placeholder="Ej: quiero jugar, promociones..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Estado</label>
          <select
            className="px-2 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-100"
            value={resolvedFilter}
            onChange={(e) => {
              setPage(1);
              setResolvedFilter(e.target.value);
            }}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="resolved">Resueltos</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Desde</label>
          <input
            type="date"
            className="px-2 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-100"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Hasta</label>
          <input
            type="date"
            className="px-2 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-100"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setResolvedFilter('all');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Total mensajes no reconocidos"
            value={stats.total ?? 0}
            accent="text-amber-300"
          />
          <StatCard
            label="Pendientes por revisar"
            value={stats.pending_count ?? 0}
            accent="text-red-300"
          />
          <StatCard
            label="Marcados como resueltos"
            value={stats.resolved_count ?? 0}
            accent="text-emerald-300"
          />
        </div>
      )}

      {top?.length > 0 && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70">
          <div className="text-xs text-slate-400 mb-2">
            Top frases que el bot no entiende (para crear nuevas reglas)
          </div>
          <div className="space-y-1 max-h-40 overflow-auto pr-1">
            {top.map((t, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 text-xs text-slate-300"
              >
                <div className="flex-1">
                  <span className="text-slate-500 mr-1">#{idx + 1}</span>
                  <span>{t.text_snippet}</span>
                </div>
                <div className="text-amber-300 font-semibold min-w-[2.5rem] text-right">
                  {t.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <div className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Mensajes no reconocidos ({total || 0}){' '}
            {loading && <span className="text-slate-500 ml-1">Cargando...</span>}
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800 w-32">
                  Fecha
                </th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">
                  Mensaje
                </th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800 w-40">
                  Sugerencia
                </th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800 w-28">
                  Estado
                </th>
                <th className="px-3 py-2 text-right font-medium border-b border-slate-800 w-32">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-xs text-slate-500"
                  >
                    No hay mensajes que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {items.map((m) => {
                const created = m.created_at
                  ? new Date(m.created_at)
                  : null;
                const createdStr = created
                  ? created.toLocaleString()
                  : '';
                const status =
                  m.resolved ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                      Resuelto
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300">
                      Pendiente
                    </span>
                  );
                const score =
                  m.closest_match_score != null
                    ? Number(m.closest_match_score).toFixed(3)
                    : null;
                return (
                  <tr key={m.id} className="border-b border-slate-800/60">
                    <td className="px-3 py-2 align-top text-slate-400 whitespace-nowrap">
                      {createdStr}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-slate-100 whitespace-pre-wrap break-words">
                        {m.message_text}
                      </div>
                      {m.conversacion_numero && (
                        <div className="mt-1 text-[10px] text-slate-500">
                          Conversación: {m.conversacion_numero}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {m.closest_match_name ? (
                        <div className="text-slate-200">
                          {m.closest_match_name}
                          {score && (
                            <span className="ml-1 text-[10px] text-slate-500">
                              (score {score})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          Sin sugerencia
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">{status}</td>
                    <td className="px-3 py-2 align-top text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => markResolved(m.id, !m.resolved)}
                        className="px-2 py-0.5 rounded-md border border-slate-700 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        {m.resolved ? 'Marcar pendiente' : 'Marcar resuelto'}
                      </button>
                      <button
                        type="button"
                        onClick={() => createRuleFromMessage(m.message_text)}
                        className="px-2 py-0.5 rounded-md border border-emerald-600 text-[11px] text-emerald-300 hover:bg-emerald-700/40"
                      >
                        Crear regla
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
            <div>
              Página {page} de {totalPages} ({total} registros)
            </div>
            <div className="space-x-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded-md border border-slate-700 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded-md border border-slate-700 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
