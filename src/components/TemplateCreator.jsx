import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL || "";

const categoryOptions = [
  { value: "UTILITY", label: "UTILITY (operaciones)" },
  { value: "MARKETING", label: "MARKETING" },
  { value: "AUTHENTICATION", label: "AUTHENTICATION" },
];

const languageOptions = [
  { value: "es_MX", label: "Español (MX)" },
  { value: "es_ES", label: "Español (ES)" },
  { value: "en_US", label: "English (US)" },
  { value: "pt_BR", label: "Portugués (BR)" },
];

const buttonTypeLabels = {
  QUICK_REPLY: "Quick reply",
  URL: "Enlace",
  PHONE_NUMBER: "Llamada",
};

export default function TemplateCreator() {
  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "es_MX",
    headerText: "",
    bodyText: "",
    footerText: "",
    buttons: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [existing, setExisting] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const updateField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateButton = (idx, patch) => {
    setForm((f) => {
      const next = [...f.buttons];
      next[idx] = { ...next[idx], ...patch };
      return { ...f, buttons: next };
    });
  };

  const addButton = (type) => {
    if (form.buttons.length >= 3) {
      setFeedback({ type: "error", text: "Máximo 3 botones por plantilla" });
      return;
    }
    setForm((f) => ({
      ...f,
      buttons: [...f.buttons, { type, text: "", url: "", phone_number: "" }],
    }));
  };

  const removeButton = (idx) => {
    setForm((f) => ({
      ...f,
      buttons: f.buttons.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        language: form.language,
        headerText: form.headerText.trim() || null,
        bodyText: form.bodyText.trim(),
        footerText: form.footerText.trim() || null,
        buttons: form.buttons.map((b) => ({
          type: b.type,
          text: b.text.trim(),
          url: b.url?.trim() || undefined,
          phone_number: b.phone_number?.trim() || undefined,
        })),
      };

      const res = await fetch(
        `${BASE}/api/templates/create`.replace(/\/\//g, "/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo crear la plantilla");
      }
      setFeedback({
        type: "success",
        text: `Plantilla enviada a revisión (${data.status || "PENDING"})`,
      });
      loadExisting();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err?.message || "Error creando la plantilla",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const loadExisting = async (allowSync = true) => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(
        `${BASE}/api/templates?estado=`.replace(/\/\//g, "/")
      );
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "No se pudieron cargar las plantillas");
      }
      const items = data.items || [];
      setExisting(items);
      // Si no hay registros en BD, intentar sincronizar con Meta una vez
      if (allowSync && items.length === 0) {
        await syncTemplates(true);
      }
    } catch (err) {
      setListError(err?.message || "Error cargando plantillas");
      setExisting([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadExisting();
  }, []);

  const syncTemplates = async (silent = false) => {
    if (!silent) setListError(null);
    setSyncing(true);
    try {
      const res = await fetch(
        `${BASE}/api/sync-templates`.replace(/\/\//g, "/"),
        { method: "GET" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo sincronizar con Meta");
      }
      await loadExisting(false);
      if (!silent) {
        setFeedback({
          type: "success",
          text: data.message || "Sincronizado desde Meta",
        });
      }
    } catch (err) {
      const msg = err?.message || "Error sincronizando plantillas";
      if (!silent) setFeedback({ type: "error", text: msg });
      setListError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const hasButtons = form.buttons.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-emerald-300">
                Crear plantilla de WhatsApp
              </h2>
              <p className="text-sm text-slate-400">
                Envía la solicitud directamente a Meta Developers sin salir del
                panel.
              </p>
            </div>
            <div className="text-xs text-slate-400 bg-slate-900 border border-slate-700 rounded px-3 py-1.5">
              Requiere rol ADMIN y WABA_TOKEN
            </div>
          </div>

          {feedback && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-900/30 border-emerald-700 text-emerald-200"
                  : "bg-red-900/30 border-red-700 text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">
                  Nombre (snake_case)
                </label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="promo_reengage_es"
                  required
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Solo letras, números y guion bajo. Meta lo exige en minúsculas.
                </p>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Idioma
                </label>
                <select
                  value={form.language}
                  onChange={(e) => updateField("language", e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">
                  Asunto (HEADER opcional)
                </label>
                <input
                  value={form.headerText}
                  onChange={(e) => updateField("headerText", e.target.value)}
                  placeholder="Ejemplo: Confirmación de pedido"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Cuerpo (BODY) *
              </label>
              <textarea
                required
                rows={5}
                value={form.bodyText}
                onChange={(e) => updateField("bodyText", e.target.value)}
                placeholder="Hola {{1}}, gracias por tu interés..."
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Puedes usar placeholders {"{{1}}"}, {"{{2}}"}, etc. Evita links
                acortados genéricos.
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Footer (opcional)
              </label>
              <input
                value={form.footerText}
                onChange={(e) => updateField("footerText", e.target.value)}
                placeholder="Ej: Powered by GA Whats"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium text-slate-200">
                    Botones (opcional)
                  </div>
                  <p className="text-xs text-slate-500">
                    Hasta 3 botones. Quick reply, enlace o llamada.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addButton("QUICK_REPLY")}
                    className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    + Quick reply
                  </button>
                  <button
                    type="button"
                    onClick={() => addButton("URL")}
                    className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    + Enlace
                  </button>
                  <button
                    type="button"
                    onClick={() => addButton("PHONE_NUMBER")}
                    className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    + Llamada
                  </button>
                </div>
              </div>

              {hasButtons ? (
                <div className="space-y-3">
                  {form.buttons.map((btn, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-slate-800 bg-slate-950/70 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={btn.type}
                          onChange={(e) =>
                            updateButton(idx, { type: e.target.value })
                          }
                          className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                        >
                          <option value="QUICK_REPLY">Quick reply</option>
                          <option value="URL">Enlace</option>
                          <option value="PHONE_NUMBER">Llamada</option>
                        </select>
                        <input
                          value={btn.text}
                          onChange={(e) =>
                            updateButton(idx, { text: e.target.value })
                          }
                          placeholder="Texto del botón"
                          className="flex-1 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeButton(idx)}
                          className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                        >
                          Quitar
                        </button>
                      </div>
                      {btn.type === "URL" && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 w-20">
                            URL
                          </label>
                          <input
                            value={btn.url}
                            onChange={(e) =>
                              updateButton(idx, { url: e.target.value })
                            }
                            placeholder="https://..."
                            className="flex-1 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm outline-none focus:border-emerald-400"
                          />
                        </div>
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 w-20">
                            Teléfono
                          </label>
                          <input
                            value={btn.phone_number}
                            onChange={(e) =>
                              updateButton(idx, { phone_number: e.target.value })
                            }
                            placeholder="521XXXXXXXXXX"
                            className="flex-1 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm outline-none focus:border-emerald-400"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Sin botones. Añade alguno si lo requiere la plantilla.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Tip: cuida ortografía, evita mayúsculas excesivas y adjunta
                variables claras ({"{{1}}"}).
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Enviando..." : "Enviar a revisión"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-slate-400">Previsualización</div>
              <div className="text-base font-semibold text-slate-200">
                {form.name || "nombre_de_plantilla"}
              </div>
            </div>
            <span className="text-[11px] px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-400">
              {form.category} · {form.language}
            </span>
          </div>

          {form.headerText && (
            <div className="text-sm font-semibold text-slate-100 mb-2">
              {form.headerText}
            </div>
          )}

          <div className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-900/40 border border-slate-800 rounded-lg p-3">
            {form.bodyText || "Escribe el cuerpo de la plantilla..."}
          </div>

          {form.footerText && (
            <div className="text-[11px] text-slate-500 mt-2">{form.footerText}</div>
          )}

          {hasButtons && (
            <div className="flex flex-wrap gap-2 mt-3">
              {form.buttons.map((b, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-200"
                  title={buttonTypeLabels[b.type]}
                >
                  {b.text || buttonTypeLabels[b.type]}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 space-y-2">
          <div className="font-semibold text-emerald-300">Requisitos Meta</div>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Nombre en snake_case en minúsculas.</li>
            <li>Sin enlaces acortados genéricos (bit.ly, tinyurl...).</li>
            <li>
              Usa placeholders {"{{1}}"}, {"{{2}}"} para variables.
            </li>
            <li>Botones: máximo 3, texto corto y claro.</li>
          </ul>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 space-y-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-emerald-300 flex-1">
                Plantillas existentes
              </div>
              <button
                type="button"
                onClick={loadExisting}
                className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                disabled={loadingList}
              >
                {loadingList ? "Cargando..." : "Recargar"}
              </button>
              <button
                type="button"
                onClick={() => syncTemplates(false)}
                className="px-3 py-1.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white"
                disabled={syncing}
              >
                {syncing ? "Sincronizando..." : "Sync Meta"}
              </button>
            </div>

          {listError && (
            <div className="rounded border border-red-700 bg-red-900/30 text-red-200 px-3 py-2">
              {listError}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto thin-scroll space-y-2">
            {loadingList && !listError && (
              <div className="text-xs text-slate-400">Cargando...</div>
            )}
            {!loadingList && existing.length === 0 && !listError && (
              <div className="text-xs text-slate-500">
                No hay plantillas registradas.
              </div>
            )}
            {existing.map((tpl) => (
              <div
                key={`${tpl.id}-${tpl.nombre}`}
                className="border border-slate-800 rounded-lg p-3 bg-slate-900/50"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">
                      {tpl.nombre}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tpl.idioma} · {tpl.categoria}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border ${
                      tpl.estado === "APPROVED"
                        ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                        : tpl.estado === "PENDING"
                        ? "bg-amber-900/30 border-amber-700 text-amber-300"
                        : "bg-red-900/30 border-red-700 text-red-300"
                    }`}
                  >
                    {tpl.estado}
                  </span>
                </div>
                {tpl.body_text && (
                  <div className="text-xs text-slate-300 mt-1 line-clamp-3">
                    {tpl.body_text}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 mt-1">
                  ID: {tpl.wa_template_id || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
