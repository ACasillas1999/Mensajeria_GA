import { useEffect, useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || "";

export default function AutoRepliesAdmin() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [settings, setSettings] = useState({
    auto_reply_enabled: "true",
    out_of_hours_enabled: "true",
    out_of_hours_message: "",
    auto_reply_delay_seconds: "2",
    max_auto_replies_per_conversation: "3",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [modalRule, setModalRule] = useState(null);

  async function loadRules() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (onlyActive) qs.set("active", "1");
      const res = await fetch(
        `${BASE}/api/admin/auto-replies?${qs.toString()}`.replace(/\/\//g, "/")
      );
      const data = await res.json();
      if (data.ok) setRules(data.items || []);
      else alert(data.error || "Error cargando reglas");
    } catch (e) {
      console.error(e);
      alert("Error de red cargando reglas");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch(
        `${BASE}/api/admin/auto-reply-settings`.replace(/\/\//g, "/")
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        const next = { ...settings };
        for (const row of data.items) {
          next[row.setting_key] = row.setting_value ?? "";
        }
        setSettings(next);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, onlyActive]);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedRules = useMemo(() => rules, [rules]);

  function openNewRule() {
    setModalRule({
      id: null,
      name: "",
      trigger_keywords: "",
      response_text: "",
      priority: 0,
      match_type: "contains",
      case_sensitive: 0,
      is_active: 1,
    });
  }

  function openEditRule(rule) {
    setModalRule({
      ...rule,
    });
  }

  function closeModal() {
    setModalRule(null);
  }

  async function saveRule(e) {
    e.preventDefault();
    if (!modalRule) return;

    const payload = {
      name: modalRule.name,
      trigger_keywords: modalRule.trigger_keywords,
      response_text: modalRule.response_text,
      priority: Number(modalRule.priority) || 0,
      match_type: modalRule.match_type,
      case_sensitive:
        modalRule.case_sensitive === true || modalRule.case_sensitive === 1,
      is_active: modalRule.is_active === true || modalRule.is_active === 1,
    };

    try {
      const url = `${BASE}/api/admin/auto-replies${
        modalRule.id ? `?id=${modalRule.id}` : ""
      }`.replace(/\/\//g, "/");
      const res = await fetch(url, {
        method: modalRule.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "No se pudo guardar");
        return;
      }
      closeModal();
      loadRules();
    } catch (e) {
      console.error(e);
      alert("Error de red guardando regla");
    }
  }

  async function toggleActive(rule) {
    try {
      const res = await fetch(
        `${BASE}/api/admin/auto-replies?id=${rule.id}`.replace(/\/\//g, "/"),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !rule.is_active }),
        }
      );
      const data = await res.json();
      if (data.ok) loadRules();
      else alert(data.error || "No se pudo actualizar");
    } catch (e) {
      console.error(e);
      alert("Error de red");
    }
  }

  async function deleteRule(rule) {
    if (!window.confirm("¿Eliminar esta regla?")) return;
    try {
      const res = await fetch(
        `${BASE}/api/admin/auto-replies?id=${rule.id}`.replace(/\/\//g, "/"),
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.ok) loadRules();
      else alert(data.error || "No se pudo eliminar");
    } catch (e) {
      console.error(e);
      alert("Error de red");
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        auto_reply_enabled: settings.auto_reply_enabled,
        out_of_hours_enabled: settings.out_of_hours_enabled,
        out_of_hours_message: settings.out_of_hours_message,
        auto_reply_delay_seconds: settings.auto_reply_delay_seconds,
        max_auto_replies_per_conversation:
          settings.max_auto_replies_per_conversation,
      };
      const res = await fetch(
        `${BASE}/api/admin/auto-reply-settings`.replace(/\/\//g, "/"),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "No se pudo guardar configuración");
        return;
      }
    } catch (e) {
      console.error(e);
      alert("Error de red guardando configuración");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Configuración del bot</h2>
            <p className="text-xs text-slate-400">
              Activa o desactiva las auto-respuestas y ajusta los límites.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Bot</span>
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  auto_reply_enabled:
                    s.auto_reply_enabled === "true" ? "false" : "true",
                }))
              }
              className={`px-3 py-1 rounded-full text-xs border ${
                settings.auto_reply_enabled === "true"
                  ? "bg-emerald-600/30 border-emerald-500 text-emerald-100"
                  : "bg-slate-800 border-slate-600 text-slate-300"
              }`}
            >
              {settings.auto_reply_enabled === "true" ? "Activado" : "Desactivado"}
            </button>
          </div>
        </div>

        <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-2">
            <label className="block text-xs text-slate-400">
              Respuesta fuera de horario
            </label>
            <select
              value={settings.out_of_hours_enabled}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  out_of_hours_enabled: e.target.value,
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
            >
              <option value="true">Activada</option>
              <option value="false">Desactivada</option>
            </select>

            <label className="block text-xs text-slate-400 mt-2">
              Mensaje fuera de horario
            </label>
            <textarea
              value={settings.out_of_hours_message}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  out_of_hours_message: e.target.value,
                }))
              }
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm resize-none"
              placeholder="Mensaje que se envía cuando el cliente escribe fuera de horario."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-400">
              Delay antes de responder (segundos)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={settings.auto_reply_delay_seconds}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  auto_reply_delay_seconds: e.target.value,
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
            />

            <label className="block text-xs text-slate-400 mt-2">
              Máx. respuestas automáticas por conversación (24h)
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={settings.max_auto_replies_per_conversation}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  max_auto_replies_per_conversation: e.target.value,
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
            />

            <div className="pt-4">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:opacity-60"
              >
                {savingSettings ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div>
            <h2 className="text-lg font-semibold">Reglas de auto-respuesta</h2>
            <p className="text-xs text-slate-400">
              Cada regla tiene un nombre, disparadores (palabras clave) y texto de respuesta.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o trigger..."
              className="px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700"
              />
              Solo activas
            </label>
            <button
              type="button"
              onClick={openNewRule}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold"
            >
              + Nueva regla
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-300">
              <tr>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Disparadores (palabras clave)</th>
                <th className="p-2 text-left">Respuesta</th>
                <th className="p-2 text-left">Coincidencia</th>
                <th className="p-2 text-left">Prioridad</th>
                <th className="p-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-center text-slate-400" colSpan={7}>
                    Cargando reglas...
                  </td>
                </tr>
              ) : sortedRules.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={7}>
                    No hay reglas configuradas.
                  </td>
                </tr>
              ) : (
                sortedRules.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        className={`px-2 py-0.5 rounded-full text-[11px] border ${
                          r.is_active
                            ? "bg-emerald-700/30 border-emerald-500 text-emerald-100"
                            : "bg-slate-800 border-slate-600 text-slate-300"
                        }`}
                      >
                        {r.is_active ? "Activa" : "Inactiva"}
                      </button>
                    </td>
                    <td className="p-2 font-medium text-slate-100">
                      {r.name}
                    </td>
                    <td className="p-2 max-w-xs">
                      <div className="text-slate-200 whitespace-pre-wrap break-words">
                        {r.trigger_keywords}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Separamos por comas, por ejemplo:{" "}
                        <code>hola,buenas tardes,buenas noches</code>
                      </div>
                    </td>
                    <td className="p-2 max-w-sm">
                      <div className="text-slate-200 whitespace-pre-wrap break-words">
                        {r.response_text}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                            {r.match_type}
                          </span>
                          {r.case_sensitive ? (
                            <span className="px-2 py-0.5 rounded bg-red-900/40 border border-red-700 text-[10px]">
                              Distingue mayúsculas/minúsculas
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700 text-[10px]">
                              No distingue mayúsculas/minúsculas
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-center">{r.priority}</td>
                    <td className="p-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditRule(r)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule(r)}
                        className="px-2 py-0.5 rounded bg-red-700/80 hover:bg-red-600"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalRule && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <form
              onSubmit={saveRule}
              className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">
                  {modalRule.id ? "Editar regla" : "Nueva regla"}
                </h3>
                <label className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={
                      modalRule.is_active === true || modalRule.is_active === 1
                    }
                    onChange={(e) =>
                      setModalRule((r) => ({
                        ...r,
                        is_active: e.target.checked,
                      }))
                    }
                    className="rounded bg-slate-900 border-slate-700"
                  />
                  Activa
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs text-slate-400">
                    Nombre de la regla
                  </label>
                  <input
                    type="text"
                    value={modalRule.name}
                    onChange={(e) =>
                      setModalRule((r) => ({ ...r, name: e.target.value }))
                    }
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                  />

                  <label className="block text-xs text-slate-400 mt-2">
                    Prioridad (número más alto = se evalúa primero)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={modalRule.priority}
                    onChange={(e) =>
                      setModalRule((r) => ({
                        ...r,
                        priority: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                  />

                  <label className="block text-xs text-slate-400 mt-2">
                    Tipo de coincidencia
                  </label>
                  <select
                    value={modalRule.match_type}
                    onChange={(e) =>
                      setModalRule((r) => ({
                        ...r,
                        match_type: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="contains">Contiene</option>
                    <option value="starts_with">Empieza con</option>
                    <option value="exact">Igual exacto</option>
                  </select>

                  <label className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={
                        modalRule.case_sensitive === true ||
                        modalRule.case_sensitive === 1
                      }
                      onChange={(e) =>
                        setModalRule((r) => ({
                          ...r,
                          case_sensitive: e.target.checked,
                        }))
                      }
                      className="rounded bg-slate-900 border-slate-700"
                    />
                    Distinguir mayúsculas/minúsculas
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-slate-400">
                    Disparadores (palabras/frases separadas por coma)
                  </label>
                  <textarea
                    value={modalRule.trigger_keywords}
                    onChange={(e) =>
                      setModalRule((r) => ({
                        ...r,
                        trigger_keywords: e.target.value,
                      }))
                    }
                    required
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm resize-none"
                    placeholder="Ej: hola,buenos dias,buenas tardes"
                  />

                  <label className="block text-xs text-slate-400 mt-2">
                    Texto de respuesta
                  </label>
                  <textarea
                    value={modalRule.response_text}
                    onChange={(e) =>
                      setModalRule((r) => ({
                        ...r,
                        response_text: e.target.value,
                      }))
                    }
                    required
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm resize-none"
                    placeholder="Texto que el bot enviará al cliente cuando se cumpla esta regla."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

