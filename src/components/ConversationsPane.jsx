import { useEffect, useState, useCallback } from "react";
import { useRealtimeChat } from "../hooks/useRealtimeChat.js";

const BASE = import.meta.env.BASE_URL || '';
const SEEN_KEY = "mensajeria_seen_v1";

// Formato de tiempo relativo estilo WhatsApp
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  // Más de una semana: mostrar fecha
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}

export default function ConversationsPane({ onSelect, currentId = null }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(""); // '', NUEVA, ABIERTA, RESUELTA
  const [view, setView] = useState("active"); // 'active', 'favorites', 'archived'
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState({});

  async function load(search = "", st = estado) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search,
        limit: String(50),
      });
      if (st) qs.set('estado', st);
      const r = await fetch(`${BASE}/api/conversations?${qs.toString()}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  // cargar mapa de vistos desde localStorage (por navegador)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SEEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const norm = {};
        for (const [k, v] of Object.entries(parsed)) {
          const id = Number(k);
          if (!Number.isNaN(id)) norm[id] = Number(v) || 0;
        }
        setSeen(norm);
      }
    } catch {}
  }, []);

  // marcar como leída la conversación actualmente abierta
  useEffect(() => {
    if (!currentId) return;
    setSeen(prev => {
      const next = { ...prev, [currentId]: Math.floor(Date.now() / 1000) };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  }, [currentId]);

  const isUnread = (c) => {
    const lastAt = Number(c.last_at || 0);
    const seenAt = seen[c.id] || 0;
    return lastAt > seenAt;
  };

  // refresco silencioso para el polling (no toca `loading`)
  async function refresh(search = q, st = estado) {
    try {
      const qs = new URLSearchParams({
        search,
        limit: String(50),
      });
      if (st) qs.set('estado', st);
      const r = await fetch(`${BASE}/api/conversations?${qs.toString()}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } catch {
      // ignorar errores puntuales
    }
  }

  // Carga inicial y cuando cambia el filtro de estado
  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  // SSE: Recibir actualizaciones de conversaciones en tiempo real
  const handleRealtimeConversations = useCallback((updated) => {
    if (!Array.isArray(updated)) return;
    setItems((prev) => {
      const map = new Map(prev.map(c => [c.id, c]));
      for (const conv of updated) {
        if (map.has(conv.id)) {
          // Actualizar existente
          map.set(conv.id, {
            ...map.get(conv.id),
            last_text: conv.ultimo_msg,
            last_at: conv.ultimo_ts,
            estado: conv.estado,
            title: conv.wa_profile_name || conv.wa_user,
            asignado_a: conv.asignado_a,
            asignado_nombre: conv.asignado_nombre,
          });
        } else {
          // Nueva conversación
          map.set(conv.id, {
            id: conv.id,
            wa_user: conv.wa_user,
            title: conv.wa_profile_name || conv.wa_user,
            estado: conv.estado,
            last_text: conv.ultimo_msg,
            last_at: conv.ultimo_ts,
            asignado_a: conv.asignado_a,
            asignado_nombre: conv.asignado_nombre,
          });
        }
      }
      return Array.from(map.values());
    });
  }, []);

  // Conectar SSE para lista de conversaciones
  useRealtimeChat({
    onConversations: handleRealtimeConversations,
    enabled: true,
  });

  // Fallback: Polling cada 10s como respaldo si SSE falla
  useEffect(() => {
    const id = setInterval(() => {
      // reutiliza el último texto de búsqueda y estado seleccionados
      refresh();
    }, 10000); // cada 10 segundos (reducido porque SSE es el principal)
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado]);

  // Filtrar según la vista seleccionada
  const filtered = items.filter(c => {
    if (view === 'archived') {
      return c.is_archived === true || c.is_archived === 1;
    } else if (view === 'favorites') {
      return c.is_favorite === true || c.is_favorite === 1;
    } else {
      // Vista 'active': excluir archivados
      return !(c.is_archived === true || c.is_archived === 1);
    }
  });

  // Ordenar: favoritos primero, luego no leídos, luego por fecha
  const sorted = [...filtered].sort((a, b) => {
    // 1. Favoritos primero (solo en vista active)
    if (view === 'active') {
      const fa = a.is_favorite === true || a.is_favorite === 1;
      const fb = b.is_favorite === true || b.is_favorite === 1;
      if (fa !== fb) return fa ? -1 : 1;
    }

    // 2. No leídos antes que leídos
    const ua = isUnread(a);
    const ub = isUnread(b);
    if (ua !== ub) return ua ? -1 : 1;

    // 3. Por fecha (más reciente primero)
    return Number(b.last_at || 0) - Number(a.last_at || 0);
  });

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header con filtros */}
      <div className="px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium">Conversaciones</span>
          <select value={estado} onChange={(e)=>setEstado(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs">
            <option value="">Todas</option>
            <option value="NUEVA">Nuevas</option>
            <option value="ABIERTA">Abiertas</option>
            <option value="RESUELTA">Resueltas</option>
          </select>
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={(e)=> e.key==="Enter" && load(q)}
            placeholder="Buscar..."
            className="ml-auto bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs outline-none focus:border-emerald-400"
          />
          <button onClick={()=>load(q)} className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700">🔎</button>
        </div>

        {/* Pestañas de vista */}
        <div className="flex gap-1">
          <button
            onClick={() => setView('active')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              view === 'active'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/60'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            💬 Activos
          </button>
          <button
            onClick={() => setView('favorites')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              view === 'favorites'
                ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/60'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            ⭐ Favoritos
          </button>
          <button
            onClick={() => setView('archived')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              view === 'archived'
                ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            📦 Archivados
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto thin-scroll">
        {loading && <div className="p-3 text-sm text-slate-400">Cargando…</div>}
        {!loading && sorted.length === 0 && <div className="p-3 text-sm text-slate-400">Sin resultados</div>}

        {sorted.map((c) => {
          const unread = isUnread(c);
          const baseClasses = "w-full text-left px-4 py-3 border-b flex items-start gap-3";
          const visual = unread
            ? "bg-slate-900/80 border-emerald-500/60"
            : "hover:bg-slate-800/70 border-slate-800";
          return (
          <button
            key={c.id}
            onClick={() => onSelect?.(c)}
            className={`${baseClasses} ${visual}`}
          >
            <div className="w-9 h-9 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs">
              {String((c.title || 'C')[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {/* Fila superior: Nombre + Timestamp */}
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {(c.is_favorite === true || c.is_favorite === 1) && (
                    <span className="text-yellow-400 text-xs shrink-0">⭐</span>
                  )}
                  <div className={`font-medium leading-tight truncate ${unread ? "text-emerald-200 font-semibold" : ""}`}>
                    {c.title || `Chat ${c.id}`}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 shrink-0">
                  {formatRelativeTime(c.last_at)}
                </div>
              </div>

              {/* Fila intermedia: Último mensaje */}
              <div className="flex items-center gap-2 mb-1">
                <div className={`text-xs truncate flex-1 ${unread ? "text-slate-300 font-medium" : "text-slate-400"}`}>
                  {c.last_text || '-'}
                </div>
                {unread && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                )}
              </div>

              {/* Fila inferior: Badges (estado + agente) */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700/80 text-emerald-300 bg-emerald-900/20">
                  {c.estado || '-'}
                </span>
                {c.asignado_nombre && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-700/80 text-sky-400 bg-sky-900/20 flex items-center gap-1">
                    <span>👤</span>
                    <span>{c.asignado_nombre}</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        )})}
      </div>
    </div>
  );
}
