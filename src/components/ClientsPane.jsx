import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || '';

export default function ClientsPane() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(search = "") {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/conversations?search=${encodeURIComponent(search)}&limit=100`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(""); }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Clientes</h2>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(q)}
            placeholder="Buscar nombre, número o ID"
            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <button onClick={()=>load(q)} className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">Buscar</button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-400">Cargando…</div>}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {items.map(c => (
          <div key={c.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-900/60 transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-700 flex items-center justify-center text-emerald-300 font-semibold">
                {String((c.title || 'C')[0] || 'C').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{c.title || `Cliente ${c.id}`}</div>
                <div className="text-xs text-slate-400 truncate">{c.wa_user}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400 line-clamp-2">{c.last_text || '—'}</div>
            <div className="mt-3 flex gap-2">
              <a href={`/mensajes?conversation_id=${c.id}`} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm">Abrir chat</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

