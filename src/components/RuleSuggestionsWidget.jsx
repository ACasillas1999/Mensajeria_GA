import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function RuleSuggestionsWidget() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [minOccurrences, setMinOccurrences] = useState(5);
  const [expandedId, setExpandedId] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${BASE}/api/admin/rule-suggestions?minOccurrences=${minOccurrences}`.replace(/\/\//g, '/'),
        { credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al cargar sugerencias');
      setSuggestions(data.items || []);
    } catch (err) {
      setError(err.message || 'Error al cargar sugerencias');
    } finally {
      setLoading(false);
    }
  };

  const processSuggestions = async () => {
    setProcessing(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/admin/rule-suggestions`.replace(/\/\//g, '/'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al procesar sugerencias');
      await load();
    } catch (err) {
      setError(err.message || 'Error al procesar sugerencias');
    } finally {
      setProcessing(false);
    }
  };

  const approveSuggestion = async (suggestion) => {
    const responseText = prompt(
      `Ingresa la respuesta que el bot enviará cuando detecte:\n"${suggestion.suggested_phrase}"`
    );

    if (!responseText || !responseText.trim()) return;

    setActionInProgress(suggestion.id);
    try {
      const res = await fetch(`${BASE}/api/admin/rule-suggestions`.replace(/\/\//g, '/'), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suggestion.id,
          action: 'approve',
          responseText: responseText.trim(),
          matchType: 'contains',
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al aprobar sugerencia');

      alert(`✅ Regla creada exitosamente (ID: ${data.ruleId})`);
      await load();
    } catch (err) {
      alert(err.message || 'Error al aprobar sugerencia');
    } finally {
      setActionInProgress(null);
    }
  };

  const rejectSuggestion = async (suggestion) => {
    if (!confirm(`¿Rechazar esta sugerencia?\n"${suggestion.suggested_phrase}"`)) return;

    setActionInProgress(suggestion.id);
    try {
      const res = await fetch(`${BASE}/api/admin/rule-suggestions`.replace(/\/\//g, '/'), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suggestion.id,
          action: 'reject',
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al rechazar sugerencia');

      await load();
    } catch (err) {
      alert(err.message || 'Error al rechazar sugerencia');
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minOccurrences]);

  return (
    <div className="p-4 rounded-xl border border-emerald-400 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              🤖 Sugerencias de Reglas (Auto-aprendizaje)
            </span>
            {suggestions.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-900/60 border border-emerald-600 text-emerald-200">
                {suggestions.length} {suggestions.length === 1 ? 'sugerencia' : 'sugerencias'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            El bot detectó frases que se repiten y sugiere crear reglas automáticamente
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 dark:text-slate-400">Mín. repeticiones:</label>
            <select
              value={minOccurrences}
              onChange={(e) => setMinOccurrences(parseInt(e.target.value))}
              className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="3">3+</option>
              <option value="5">5+</option>
              <option value="10">10+</option>
              <option value="20">20+</option>
            </select>
          </div>
          <button
            type="button"
            onClick={processSuggestions}
            disabled={processing}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold disabled:opacity-50 transition"
          >
            {processing ? 'Procesando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {loading && !suggestions.length ? (
        <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-400">Cargando sugerencias...</div>
      ) : suggestions.length === 0 ? (
        <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-400">
          No hay sugerencias pendientes. El bot analizará mensajes no reconocidos automáticamente.
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-900/80 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      "{s.suggested_phrase}"
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-900/40 border border-amber-600 text-amber-300">
                      {s.occurrence_count} {s.occurrence_count === 1 ? 'vez' : 'veces'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Score: {s.priority_score.toFixed(1)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <div>
                      Primera vez: {new Date(s.first_seen).toLocaleDateString()} | Última vez:{' '}
                      {new Date(s.last_seen).toLocaleDateString()}
                    </div>

                    {s.closest_rule_name && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">Regla similar:</span>
                        <span className="text-slate-700 dark:text-slate-300">{s.closest_rule_name}</span>
                        {s.closest_existing_score && (
                          <span className="text-slate-500">
                            ({(s.closest_existing_score * 100).toFixed(0)}% similar)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {expandedId === s.id && (
                    <div className="mt-2 p-2 rounded bg-slate-200 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-xs">
                      <div className="text-slate-600 dark:text-slate-400 mb-1">
                        Mensaje original detectado {s.message_count || s.occurrence_count}{' '}
                        {s.message_count === 1 ? 'vez' : 'veces'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="px-2 py-1 rounded text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-400 dark:border-slate-700"
                  >
                    {expandedId === s.id ? 'Ocultar' : 'Ver más'}
                  </button>
                  <button
                    type="button"
                    onClick={() => approveSuggestion(s)}
                    disabled={actionInProgress === s.id}
                    className="px-2 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                  >
                    {actionInProgress === s.id ? '...' : '✅ Crear regla'}
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectSuggestion(s)}
                    disabled={actionInProgress === s.id}
                    className="px-2 py-1 rounded text-xs bg-red-700/80 hover:bg-red-600 text-white disabled:opacity-50"
                  >
                    {actionInProgress === s.id ? '...' : '❌'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
