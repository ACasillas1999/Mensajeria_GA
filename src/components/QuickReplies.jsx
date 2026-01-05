import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || '';

export default function QuickReplies({ onSelect, onClose }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", contenido: "", categoria: "", atajo: "" });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/quick-replies?search=${encodeURIComponent(search)}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSearch(e) {
    e?.preventDefault?.();
    load();
  }

  async function handleSelect(item) {
    // Incrementar contador de uso
    try {
      await fetch(`${BASE}/api/quick-replies/${item.id}`.replace(/\/\//g, '/'), { method: 'POST' });
    } catch {}
    onSelect?.(item.contenido);
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const r = await fetch(`${BASE}/api/quick-replies`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.ok) {
        setShowForm(false);
        setForm({ titulo: "", contenido: "", categoria: "", atajo: "" });
        load();
      } else {
        alert(j.error || 'Error al crear');
      }
    } catch {
      alert('Error de red');
    }
  }

  // Agrupar por categoría
  const grouped = items.reduce((acc, item) => {
    const cat = item.categoria || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Respuestas Rápidas</h2>
          <form onSubmit={handleSearch} className="ml-auto flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-emerald-400"
            />
            <button type="submit" className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm">
              Buscar
            </button>
          </form>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
          >
            + Nueva
          </button>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-slate-800">
            ✕
          </button>
        </div>

        {/* Form crear */}
        {showForm && (
          <form onSubmit={handleCreate} className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.titulo}
                onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título *"
                required
                className="px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
              />
              <div className="flex gap-2">
                <input
                  value={form.categoria}
                  onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))}
                  placeholder="Categoría"
                  className="flex-1 px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                />
                <input
                  value={form.atajo}
                  onChange={(e) => setForm(f => ({ ...f, atajo: e.target.value }))}
                  placeholder="Atajo (/hola)"
                  className="w-28 px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                />
              </div>
            </div>
            <textarea
              value={form.contenido}
              onChange={(e) => setForm(f => ({ ...f, contenido: e.target.value }))}
              placeholder="Contenido del mensaje *"
              required
              rows={3}
              className="w-full px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
              >
                Guardar
              </button>
            </div>
          </form>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && <div className="text-sm text-slate-600 dark:text-slate-400">Cargando...</div>}

          {!loading && items.length === 0 && (
            <div className="text-center text-slate-600 dark:text-slate-400 py-8">
              No hay respuestas rápidas. ¡Crea una nueva!
            </div>
          )}

          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">{cat}</div>
              <div className="space-y-2">
                {catItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800/70 hover:border-emerald-700/50 transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-200 group-hover:text-emerald-300">
                        {item.titulo}
                      </span>
                      {item.atajo && (
                        <code className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                          {item.atajo}
                        </code>
                      )}
                      <span className="ml-auto text-xs text-slate-500">
                        {item.uso_count || 0} usos
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {item.contenido}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="p-3 border-t border-slate-800 text-xs text-slate-500">
          Tip: Escribe el atajo (ej: /hola) en el chat y presiona Tab para insertar la respuesta
        </div>
      </div>
    </div>
  );
}
