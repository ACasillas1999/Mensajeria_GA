import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || '';

export default function ConversationsPane({ onSelect }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(""); // '', NUEVA, ABIERTA, RESUELTA
  const [loading, setLoading] = useState(false);

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

  // Carga inicial y cuando cambia el filtro de estado
  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  // Refresco automático periódico de la bandeja (polling)
  useEffect(() => {
    const id = setInterval(() => {
      // reutiliza el último texto de búsqueda y estado seleccionados
      load(q, estado);
    }, 5000); // cada 5 segundos
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado]);

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
      <div className="h-12 px-3 flex items-center gap-2 border-b border-slate-800">
        <span className="font-medium">Conversaciones</span>
        <select value={estado} onChange={(e)=>setEstado(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
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
          className="ml-auto bg-slate-900 border border-slate-700 rounded px-3 py-1 text-sm outline-none focus:border-emerald-400"
        />
        <button onClick={()=>load(q)} className="px-2 py-1 text-sm rounded bg-slate-800 hover:bg-slate-700">OK</button>
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto thin-scroll">
        {loading && <div className="p-3 text-sm text-slate-400">Cargando…</div>}
        {!loading && items.length === 0 && <div className="p-3 text-sm text-slate-400">Sin resultados</div>}

        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect?.(c)}
            className="w-full text-left px-4 py-3 hover:bg-slate-800/70 border-b border-slate-800 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs">
              {String((c.title || 'C')[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium leading-tight truncate">{c.title || `Chat ${c.id}`}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700/80 text-emerald-300">{c.estado || '-'}</span>
              </div>
              <div className="text-xs text-slate-400 truncate">{c.last_text || '-'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

