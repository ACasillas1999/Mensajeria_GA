import { useEffect, useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || "";

export default function AssignPanel() {
  const [conv, setConv] = useState([]);
  const [agents, setAgents] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [statuses, setStatuses] = useState([]); // Estados dinamicos

  const [fltEstado, setFltEstado] = useState(""); // '' = todos
  const [fltAsignado, setFltAsignado] = useState("null"); // null = sin asignar
  const [fltSuc, setFltSuc] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fltAgent, setFltAgent] = useState(""); // filtro por agente
  const [groupByAgent, setGroupByAgent] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function loadStatuses() {
    try {
      const r = await fetch(`${BASE}/api/admin/conversation-statuses?active=1`.replace(/\/\//g, "/"));
      const j = await r.json();
      if (j.ok) setStatuses(j.items || []);
    } catch (e) {
      console.error("Error loading statuses:", e);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const asignadoParam = fltAsignado === "null" ? "null" : fltAgent ? String(fltAgent) : "any";
      const params = new URLSearchParams();
      if (fltEstado) params.set("status_id", fltEstado);
      params.set("asignado", asignadoParam);
      if (search) params.set("search", search);

      const [c, a, s] = await Promise.all([
        fetch(`${BASE}/api/admin/conversations?${params.toString()}`.replace(/\/\//g, "/")).then((r) => r.json()),
        fetch(`${BASE}/api/admin/agents?sucursal_id=${fltSuc}`.replace(/\/\//g, "/")).then((r) => r.json()),
        fetch(`${BASE}/api/admin/sucursales`.replace(/\/\//g, "/")).then((r) => r.json()),
      ]);
      if (c.ok) setConv(c.items || []);
      if (a.ok) setAgents(a.items || []);
      if (s.ok) setSucursales(s.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatuses();
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fltEstado, fltAsignado, fltSuc, search, fltAgent]);

  async function assign(conversacion_id, user_id) {
    const r = await fetch(`${BASE}/api/admin/assign`.replace(/\/\//g, "/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversacion_id, user_id }),
    });
    const j = await r.json();
    if (j.ok) load();
    else alert("No se pudo asignar");
  }

  const sinAsignar = useMemo(() => conv.filter((c) => !c.asignado_a), [conv]);
  const asignadas = useMemo(() => conv.filter((c) => !!c.asignado_a), [conv]);
  const countSin = sinAsignar.length;
  const countAsig = asignadas.length;
  const gruposAsignadas = useMemo(() => {
    if (!groupByAgent) return [];
    const map = new Map();
    for (const c of asignadas) {
      const key = Number(c.asignado_a || 0);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    const agentsById = Object.fromEntries(agents.map((a) => [a.id, a]));
    return Array.from(map.entries())
      .map(([id, items]) => ({
        id,
        agent: agentsById[id] || { id, nombre: (items[0] && (items[0].asignado_nombre || `Agente ${id}`)) },
        items,
      }))
      .sort((a, b) =>
        String((a.agent && a.agent.nombre) || "").localeCompare(String((b.agent && b.agent.nombre) || ""))
      );
  }, [asignadas, agents, groupByAgent]);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* izquierda: filtros y conversaciones */}
      <section className="col-span-12 lg:col-span-7 space-y-3">
        <div className="sticky top-14 z-10 bg-white/90 dark:bg-slate-950/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between sm:hidden">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">Filtros</span>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="text-xs px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              {filtersOpen ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <div
            className={`${
              filtersOpen ? "grid" : "hidden sm:grid"
            } grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:items-center`}
          >
            <select
              value={fltEstado}
              onChange={(e) => setFltEstado(e.target.value)}
              className="px-3 py-2 rounded bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 w-full"
            >
              <option value="">Todos los estados</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>

            <select
              value={fltAsignado}
              onChange={(e) => setFltAsignado(e.target.value)}
              className="px-3 py-2 rounded bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 w-full"
            >
              <option value="null">Sin asignar</option>
              <option value="any">Cualquiera</option>
            </select>

            <select
              value={fltAgent}
              onChange={(e) => {
                setFltAgent(e.target.value);
                if (e.target.value) setFltAsignado("any");
              }}
              className="px-3 py-2 rounded bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 w-full"
            >
              <option value="">(Todos los agentes)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                  {a.sucursal ? " - " + a.sucursal : ""}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversacion..."
              className="px-3 py-2 rounded bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 w-full col-span-1 sm:col-span-2 lg:col-span-3 outline-none focus:border-emerald-400"
            />

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="accent-emerald-500"
                checked={groupByAgent}
                onChange={(e) => setGroupByAgent(e.target.checked)}
              />{" "}
              Agrupar por agente
            </label>
            <button
              onClick={load}
              className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 w-full sm:w-auto"
            >
              Refrescar
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <span>Sin asignar</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                {countSin}
              </span>
            </div>
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 thin-scroll">
              {sinAsignar.map((c) => (
                <div key={c.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-200 dark:border-emerald-700 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-sm">
                      {String((c.wa_profile_name || c.wa_user || "C")[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.wa_profile_name || c.wa_user || `Chat ${c.id}`}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.ultimo_msg || "-"}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <select
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded px-2 py-1 w-full sm:w-auto"
                      onChange={(e) => assign(c.id, Number(e.target.value))}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Asignar a
                      </option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} ({a.sucursal || "-"})
                        </option>
                      ))}
                    </select>
                    <a
                      href={`${BASE}/mensajes?conversation_id=${c.id}`.replace(/\/\//g, "/")}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm w-full sm:w-auto text-center text-slate-800 dark:text-slate-100"
                    >
                      Ver chat
                    </a>
                  </div>
                </div>
              ))}
              {sinAsignar.length === 0 && (
                <div className="p-3 text-sm text-slate-500 dark:text-slate-400">No hay pendientes</div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <span>Asignadas</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                {countAsig}
              </span>
            </div>
            <div className="max-h-[65vh] overflow-y-auto thin-scroll">
              {!groupByAgent && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {asignadas.map((c) => (
                    <div key={c.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-600/20 border border-sky-200 dark:border-sky-700 flex items-center justify-center text-sky-700 dark:text-sky-300 text-sm">
                          {String((c.wa_profile_name || c.wa_user || "C")[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {c.wa_profile_name || c.wa_user || `Chat ${c.id}`}{" "}
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                              {c.asignado_nombre || c.asignado_a}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.ultimo_msg || "-"}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <select
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded px-2 py-1 w-full sm:w-auto"
                          onChange={(e) => assign(c.id, Number(e.target.value))}
                          value={c.asignado_a || ""}
                        >
                          <option value="">(Sin asignar)</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre} ({a.sucursal || "-"})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => assign(c.id, null)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm w-full sm:w-auto text-slate-800 dark:text-slate-100"
                        >
                          Quitar
                        </button>
                        <a
                          href={`${BASE}/mensajes?conversation_id=${c.id}`.replace(/\/\//g, "/")}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm w-full sm:w-auto text-center text-slate-800 dark:text-slate-100"
                        >
                          Ver chat
                        </a>
                      </div>
                    </div>
                  ))}
                  {asignadas.length === 0 && (
                    <div className="p-3 text-sm text-slate-500 dark:text-slate-400">Sin asignadas con este filtro</div>
                  )}
                </div>
              )}
              {groupByAgent && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {gruposAsignadas.map((gr) => (
                    <div key={gr.id}>
                      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 sticky top-0 z-10 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 grid place-items-center text-slate-600 dark:text-slate-300 text-xs">
                          {String((gr.agent?.nombre || "A")[0]).toUpperCase()}
                        </div>
                        <div className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">
                          {gr.agent?.nombre || "Sin asignar"}
                        </div>
                        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                          {gr.items.length}
                        </span>
                      </div>
                      {gr.items.map((c) => (
                        <div key={c.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-600/20 border border-sky-200 dark:border-sky-700 flex items-center justify-center text-sky-700 dark:text-sky-300 text-sm">
                              {String((c.wa_profile_name || c.wa_user || "C")[0]).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {c.wa_profile_name || c.wa_user || `Chat ${c.id}`}
                              </div>
                              <div className="text-xs text-slate-400 truncate">{c.ultimo_msg || "-"}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2 flex-wrap">
                            <select
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded px-2 py-1 w-full sm:w-auto"
                              onChange={(e) => assign(c.id, Number(e.target.value))}
                              value={c.asignado_a || ""}
                            >
                              <option value="">(Sin asignar)</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nombre} ({a.sucursal || "-"})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => assign(c.id, null)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm w-full sm:w-auto text-slate-800 dark:text-slate-100"
                            >
                              Quitar
                            </button>
                            <a
                              href={`${BASE}/mensajes?conversation_id=${c.id}`.replace(/\/\//g, "/")}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm w-full sm:w-auto text-center text-slate-800 dark:text-slate-100"
                            >
                              Ver chat
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* derecha: filtro sucursal y agentes */}
      <aside className="col-span-12 lg:col-span-5 space-y-3">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="flex gap-2 items-center">
            <select
              value={fltSuc}
              onChange={(e) => setFltSuc(e.target.value)}
              className="px-3 py-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 w-full sm:w-auto"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">{agents.length} agentes</div>
          </div>
          <div className="mt-3 grid md:grid-cols-2 gap-2">
            {agents.map((a) => (
              <div key={a.id} className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-sm">
                    {String((a.nombre || "A")[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.nombre}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{a.email}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{a.sucursal || "-"}</div>
              </div>
            ))}
          </div>
        </div>
        {loading && <div className="text-sm text-slate-500 dark:text-slate-400">Actualizando...</div>}
      </aside>
    </div>
  );
}
