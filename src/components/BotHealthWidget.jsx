import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "";

export default function BotHealthWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${BASE}/api/admin/bot-health`.replace(/\/\//g, "/")
        );
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || "Error al cargar estado del bot");
        setData(j.data || null);
      } catch (e) {
        setError(e.message || "Error al cargar estado del bot");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading && !data) {
    return (
      <section className="mt-4 mb-2">
        <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-slate-800 bg-slate-950/70 text-[11px] text-slate-400">
          Salud del bot: cargando...
        </div>
      </section>
    );
  }

  if (!data || error) {
    return (
      <section className="mt-4 mb-2">
        <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-red-800/60 bg-red-950/40 text-[11px] text-red-300">
          Salud del bot: {error || "sin datos"}
        </div>
      </section>
    );
  }

  const statusPill = (ok, labelOk, labelBad, colorOk, colorBad) => {
    const okClass =
      "bg-emerald-900/40 border-emerald-700 text-emerald-300 " + colorOk;
    const badClass =
      "bg-red-900/40 border-red-700 text-red-300 " + colorBad;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${
          ok ? okClass : badClass
        }`}
      >
        {ok ? labelOk : labelBad}
      </span>
    );
  };

  const rate =
    data.recognition_rate != null
      ? Math.round(data.recognition_rate * 100)
      : null;

  return (
    <section className="mt-4 mb-2">
      <div className="p-3 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-wrap items-center gap-3 text-[11px]">
        <div className="text-xs font-semibold text-emerald-300 mr-2">
          Salud del bot
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Auto-respuestas:</span>
          {statusPill(
            !!data.auto_reply_enabled,
            "Activadas",
            "Desactivadas",
            "",
            ""
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Embeddings:</span>
          {data.embedding_enabled_setting ? (
            statusPill(
              data.embedding_enabled && data.embedding_healthy,
              "Operativos",
              "Con problema",
              "",
              ""
            )
          ) : (
            statusPill(false, "", "Desactivados", "", "")
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Reconocimiento hoy:</span>
          {rate != null ? (
            <span className="text-slate-200 font-semibold">
              {rate}%{" "}
              <span className="text-slate-500 font-normal">
                ({data.unrecognized_today} sin entender)
              </span>
            </span>
          ) : (
            <span className="text-slate-500">Sin mensajes hoy</span>
          )}
        </div>
      </div>
    </section>
  );
}

