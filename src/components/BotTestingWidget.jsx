import { useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function BotTestingWidget() {
  const [testMessage, setTestMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const runTest = async (e) => {
    e.preventDefault();
    if (!testMessage.trim()) return;

    setTesting(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${BASE}/api/admin/test-auto-reply`.replace(/\/\//g, '/'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Error al probar el mensaje');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Error al probar el mensaje');
    } finally {
      setTesting(false);
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'SEND_AUTO_REPLY':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-900/40 border border-emerald-600 text-emerald-300">
            ✅ Enviaría auto-respuesta
          </span>
        );
      case 'SEND_FALLBACK_WITH_SUGGESTION':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-900/40 border border-amber-600 text-amber-300">
            💡 Enviaría sugerencia
          </span>
        );
      case 'SEND_FALLBACK_GENERIC':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-700/40 border border-slate-600 text-slate-300">
            💬 Enviaría fallback genérico
          </span>
        );
      case 'NO_MATCH':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-900/40 border border-red-600 text-red-300">
            ❌ No haría nada
          </span>
        );
      case 'NO_ACTION':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-700/40 border border-slate-600 text-slate-400">
            ⏸️ Bot desactivado
          </span>
        );
      default:
        return null;
    }
  };

  const getMatchTypeBadge = (type) => {
    switch (type) {
      case 'KEYWORD':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-900/40 border border-blue-600 text-blue-300 text-xs">
            🔑 Keywords
          </span>
        );
      case 'EMBEDDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-900/40 border border-purple-600 text-purple-300 text-xs">
            🧠 IA/Embeddings
          </span>
        );
      case 'SUGGESTION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-900/40 border border-amber-600 text-amber-300 text-xs">
            💡 Sugerencia
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-lg font-semibold">🧪 Simulador de Bot</div>
        <span className="text-xs text-slate-400">
          Prueba cómo respondería el bot sin enviar mensajes reales
        </span>
      </div>

      <form onSubmit={runTest} className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Mensaje de prueba
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Ej: Hola, buenos días, cuánto cuesta..."
              className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500"
              disabled={testing}
            />
            <button
              type="submit"
              disabled={testing || !testMessage.trim()}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {testing ? 'Probando...' : 'Probar'}
            </button>
          </div>
        </div>

        {/* Ejemplos rápidos */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Ejemplos:</span>
          {['Hola', 'Buenos días', 'Cuánto cuesta', 'Necesito ayuda urgente', 'Horario de atención'].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setTestMessage(ex)}
              className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              disabled={testing}
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          {/* Acción principal */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Acción:</span>
            {getActionBadge(result.action)}
          </div>

          {/* Match encontrado */}
          {result.match && (
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Match encontrado:
                  </span>
                  {getMatchTypeBadge(result.match.type)}
                </div>
                {result.match.score && (
                  <span className="text-xs text-slate-400">
                    Score: {(result.match.score * 100).toFixed(1)}%
                  </span>
                )}
              </div>

              <div className="text-sm">
                <div className="text-slate-300">
                  <span className="text-slate-500">Regla:</span>{' '}
                  <span className="font-semibold">{result.match.rule_name}</span>
                </div>
                {result.match.keyword_matched && (
                  <div className="text-xs text-slate-400 mt-1">
                    Keyword: "{result.match.keyword_matched}" ({result.match.match_type})
                  </div>
                )}
                {result.match.threshold && (
                  <div className="text-xs text-slate-400 mt-1">
                    Umbral requerido: {(result.match.threshold * 100).toFixed(0)}%
                    {result.match.suggest_threshold && (
                      <span className="ml-2">
                        | Sugerencia: {(result.match.suggest_threshold * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Respuesta */}
          {result.response && (
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
              <div className="text-xs text-slate-400 mb-1">
                Respuesta que enviaría:
              </div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap">
                {result.response}
              </div>
            </div>
          )}

          {/* Debug info */}
          {result.debug && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-400">
                🔍 Ver información de debug
              </summary>
              <div className="mt-2 p-3 rounded bg-slate-900/40 border border-slate-800 space-y-2">
                {/* Keywords intentados */}
                {result.debug.keyword_matches && result.debug.keyword_matches.length > 0 && (
                  <div>
                    <div className="text-slate-400 font-semibold mb-1">
                      Matches por Keywords ({result.debug.keyword_matches.length}):
                    </div>
                    <div className="space-y-1">
                      {result.debug.keyword_matches.map((m, idx) => (
                        <div key={idx} className="text-slate-500">
                          • {m.rule_name} - "{m.keyword}" ({m.match_type}) - Prioridad: {m.priority}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embeddings */}
                {result.debug.embedding_matches && result.debug.embedding_matches.length > 0 && (
                  <div>
                    <div className="text-slate-400 font-semibold mb-1">
                      Matches por Embeddings ({result.debug.embedding_matches.length}):
                    </div>
                    <div className="space-y-1">
                      {result.debug.embedding_matches.map((m, idx) => (
                        <div key={idx} className="text-slate-500">
                          • Regla ID {m.rule_id} - Score: {(m.score * 100).toFixed(1)}% - Prioridad: {m.priority} - Combined: {(m.combined_score * 100).toFixed(1)}%
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.debug.embedding_error && (
                  <div className="text-red-400">
                    Error embeddings: {result.debug.embedding_error}
                  </div>
                )}

                {result.debug.embedding_status && (
                  <div className="text-amber-400">
                    {result.debug.embedding_status}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Settings usados */}
          {result.settings && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-400">
                ⚙️ Configuración usada
              </summary>
              <div className="mt-2 p-3 rounded bg-slate-900/40 border border-slate-800">
                <div className="grid grid-cols-2 gap-2 text-slate-500">
                  <div>Bot activado: {result.settings.auto_reply_enabled ? '✅' : '❌'}</div>
                  <div>Embeddings: {result.settings.embedding_enabled ? '✅' : '❌'}</div>
                  <div>Umbral IA: {(result.settings.embedding_threshold * 100).toFixed(0)}%</div>
                  <div>Fallback: {result.settings.fallback_enabled ? '✅' : '❌'}</div>
                  <div colSpan={2}>
                    Umbral sugerencias: {(result.settings.fallback_suggest_threshold * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
