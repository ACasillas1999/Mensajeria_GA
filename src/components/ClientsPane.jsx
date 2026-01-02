import { useEffect, useState, lazy, Suspense } from "react";

const BASE = import.meta.env.BASE_URL || '';
const QuickChatModal = lazy(() => import('./QuickChatModal.jsx'));

export default function ClientsPane() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("all"); // 'all', 'recent', 'favorites'
  const [sortBy, setSortBy] = useState("recent"); // 'recent', 'name', 'messages'
  const [stats, setStats] = useState({ total: 0, recent: 0, favorites: 0 });
  const [quickViewId, setQuickViewId] = useState(null);

  async function load(search = "") {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/conversations?search=${encodeURIComponent(search)}&limit=200`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) {
        const allItems = j.items || [];
        setItems(allItems);

        // Calcular estadísticas
        const now = Math.floor(Date.now() / 1000);
        const dayAgo = now - 86400;
        setStats({
          total: allItems.length,
          recent: allItems.filter(c => Number(c.last_at || 0) > dayAgo).length,
          favorites: allItems.filter(c => c.is_favorite).length,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(""); }, []);

  // Filtrar según la vista
  const filtered = items.filter(c => {
    if (view === 'recent') {
      const now = Math.floor(Date.now() / 1000);
      const dayAgo = now - 86400;
      return Number(c.last_at || 0) > dayAgo;
    }
    if (view === 'favorites') {
      return c.is_favorite === true || c.is_favorite === 1;
    }
    return true; // 'all'
  });

  // Ordenar
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      return (a.title || a.wa_user).localeCompare(b.title || b.wa_user);
    }
    if (sortBy === 'messages') {
      // Aquí podrías ordenar por cantidad de mensajes si tienes ese dato
      return 0;
    }
    // 'recent' por defecto
    return Number(b.last_at || 0) - Number(a.last_at || 0);
  });

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(Number(ts) * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-100">Clientes</h2>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(q)}
              placeholder="Buscar por nombre o número..."
              className="w-64 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400 transition"
            />
            <button
              onClick={() => load(q)}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 transition font-medium"
            >
              🔍 Buscar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
            <div className="text-xs text-slate-400">Total clientes</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{stats.total}</div>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
            <div className="text-xs text-slate-400">Activos hoy</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.recent}</div>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
            <div className="text-xs text-slate-400">Favoritos</div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.favorites}</div>
          </div>
        </div>

        {/* Tabs and Sort */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setView('all')}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                view === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setView('recent')}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                view === 'recent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Recientes
            </button>
            <button
              onClick={() => setView('favorites')}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                view === 'favorites'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              ⭐ Favoritos
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg outline-none focus:border-emerald-400"
          >
            <option value="recent">Más recientes</option>
            <option value="name">Por nombre</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-12 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
          <div className="mt-2">Cargando clientes...</div>
        </div>
      )}

      {/* Grid de clientes */}
      {!loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sorted.map(c => {
            const isRecent = Number(c.last_at || 0) > (Math.floor(Date.now() / 1000) - 86400);
            const isFavorite = c.is_favorite === true || c.is_favorite === 1;

            return (
              <div
                key={c.id}
                className="group relative p-4 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-900/80 hover:border-slate-700 transition-all"
              >
                {/* Badges */}
                <div className="absolute top-2 right-2 flex gap-1">
                  {isFavorite && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-700/50">
                      ⭐
                    </span>
                  )}
                  {isRecent && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">
                      Activo
                    </span>
                  )}
                </div>

                {/* Avatar y nombre */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-700/50 flex items-center justify-center text-emerald-300 font-bold text-lg flex-shrink-0">
                    {String((c.title || c.wa_user || 'C')[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="font-semibold text-slate-100 truncate">
                      {c.title || `Cliente ${c.id}`}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{c.wa_user}</div>
                  </div>
                </div>

                {/* Último mensaje */}
                {c.last_text && (
                  <div className="mb-3 p-2 rounded bg-slate-900/60 border border-slate-800">
                    <div className="text-xs text-slate-400 line-clamp-2">
                      {c.last_text}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span>{formatTimestamp(c.last_at)}</span>
                  {c.status_name && (
                    <span
                      className="px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `${c.status_color || '#64748b'}20`,
                        borderColor: c.status_color || '#64748b',
                        color: c.status_color || '#64748b'
                      }}
                    >
                      {c.status_icon} {c.status_name}
                    </span>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setQuickViewId(c.id)}
                    className="flex-1 px-3 py-2 text-center rounded-lg bg-sky-600/10 border border-sky-600/30 text-sky-300 hover:bg-sky-600/20 transition-all font-medium text-sm"
                  >
                    👁️ Vista rápida
                  </button>
                  <a
                    href={`${BASE}/mensajes?conversation_id=${c.id}`.replace(/\/\//g, '/')}
                    data-astro-prefetch="tap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 text-center rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/20 transition-all font-medium text-sm"
                  >
                    🔗 Abrir
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div className="p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <div className="text-slate-400">No se encontraron clientes</div>
          <div className="text-sm text-slate-500 mt-2">Intenta con otro término de búsqueda</div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewId && (
        <Suspense fallback={null}>
          <QuickChatModal
            conversationId={quickViewId}
            onClose={() => setQuickViewId(null)}
            onOpenFull={() => {
              window.open(`${BASE}/mensajes?conversation_id=${quickViewId}`.replace(/\/\//g, '/'), '_blank');
              setQuickViewId(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
