import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { findMatchingRuleByKeywords } from '../../../lib/autoReply';
import { findSimilarRules, isEmbeddingServiceEnabled } from '../../../lib/embeddings';

/**
 * Endpoint para simular el matching de reglas sin enviar mensajes reales
 * Útil para testing y debugging del bot
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Verificar autenticación de admin
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere un mensaje de texto' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener configuración
    const [settingsRows] = await pool.query(
      `SELECT setting_key, setting_value FROM auto_reply_settings WHERE setting_key IN (
        'auto_reply_enabled',
        'embedding_service_enabled',
        'embedding_similarity_threshold',
        'fallback_message_enabled',
        'fallback_message_text',
        'fallback_suggest_enabled',
        'fallback_suggest_threshold'
      )`
    );

    const settings: Record<string, string> = {};
    (settingsRows as any[]).forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });

    const result: any = {
      ok: true,
      message,
      timestamp: new Date().toISOString(),
      settings: {
        auto_reply_enabled: settings.auto_reply_enabled === 'true',
        embedding_enabled: settings.embedding_service_enabled === 'true',
        embedding_threshold: parseFloat(settings.embedding_similarity_threshold || '0.7'),
        fallback_enabled: settings.fallback_message_enabled === 'true',
        fallback_suggest_threshold: parseFloat(settings.fallback_suggest_threshold || '0.60'),
      },
      match: null,
      action: null,
      response: null,
      debug: {
        keyword_matches: [],
        embedding_matches: [],
      },
    };

    // Si el bot está desactivado
    if (settings.auto_reply_enabled !== 'true') {
      result.action = 'NO_ACTION';
      result.response = '⚠️ El bot está desactivado globalmente';
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Intentar matching por keywords
    const [rulesRows] = await pool.query(
      'SELECT * FROM auto_replies WHERE is_active = TRUE ORDER BY priority DESC'
    );
    const rules = rulesRows as any[];

    for (const rule of rules) {
      const keywords = rule.trigger_keywords.split(',').map((k: string) => k.trim());
      const text = rule.case_sensitive ? message : message.toLowerCase();

      for (const keyword of keywords) {
        const kw = rule.case_sensitive ? keyword : keyword.toLowerCase();
        let matches = false;

        switch (rule.match_type) {
          case 'exact':
            matches = text === kw;
            break;
          case 'contains':
            matches = text.includes(kw);
            break;
          case 'starts_with':
            matches = text.startsWith(kw);
            break;
        }

        if (matches) {
          result.debug.keyword_matches.push({
            rule_id: rule.id,
            rule_name: rule.name,
            keyword,
            match_type: rule.match_type,
            priority: rule.priority,
          });

          if (!result.match) {
            result.match = {
              type: 'KEYWORD',
              rule_id: rule.id,
              rule_name: rule.name,
              keyword_matched: keyword,
              match_type: rule.match_type,
              priority: rule.priority,
              score: 1.0,
            };
            result.action = 'SEND_AUTO_REPLY';
            result.response = rule.response_text;
          }
        }
      }
    }

    // 2. Si no hay match por keywords, intentar embeddings
    if (!result.match && settings.embedding_service_enabled === 'true') {
      const embeddingEnabled = await isEmbeddingServiceEnabled();

      if (embeddingEnabled) {
        try {
          const matches = await findSimilarRules(message);
          const threshold = parseFloat(settings.embedding_similarity_threshold || '0.7');

          result.debug.embedding_matches = matches.map((m) => ({
            rule_id: m.id,
            score: m.score,
            priority: m.priority,
            combined_score: m.score + m.priority * 0.01,
          }));

          if (matches.length > 0) {
            // Ordenar por score combinado
            const sorted = [...matches].sort((a, b) => {
              const scoreA = a.score + a.priority * 0.01;
              const scoreB = b.score + b.priority * 0.01;
              return scoreB - scoreA;
            });

            const best = sorted[0];

            // Obtener info de la regla
            const [ruleRows] = await pool.query(
              'SELECT * FROM auto_replies WHERE id = ? AND is_active = TRUE',
              [best.id]
            );
            const matchedRule = (ruleRows as any[])[0];

            if (matchedRule) {
              if (best.score >= threshold) {
                // Match exitoso por embeddings
                result.match = {
                  type: 'EMBEDDING',
                  rule_id: matchedRule.id,
                  rule_name: matchedRule.name,
                  score: best.score,
                  priority: best.priority,
                  threshold,
                };
                result.action = 'SEND_AUTO_REPLY';
                result.response = matchedRule.response_text;
              } else {
                // Score por debajo del umbral principal
                const suggestThreshold = parseFloat(settings.fallback_suggest_threshold || '0.60');

                if (best.score >= suggestThreshold) {
                  // Sugerencia de regla cercana
                  result.match = {
                    type: 'SUGGESTION',
                    rule_id: matchedRule.id,
                    rule_name: matchedRule.name,
                    score: best.score,
                    priority: best.priority,
                    threshold,
                    suggest_threshold: suggestThreshold,
                  };

                  if (settings.fallback_message_enabled === 'true' && settings.fallback_suggest_enabled === 'true') {
                    result.action = 'SEND_FALLBACK_WITH_SUGGESTION';
                    result.response = `No estoy seguro de entender tu pregunta. ¿Quizás querías preguntar sobre "${matchedRule.name}"?\n\nSi no, por favor reformula tu pregunta o escribe "ayuda".`;
                  } else {
                    result.action = 'NO_MATCH';
                    result.response = '❌ No se encontró ninguna regla (sugerencias desactivadas)';
                  }
                } else {
                  // Score muy bajo
                  result.match = null;

                  if (settings.fallback_message_enabled === 'true') {
                    result.action = 'SEND_FALLBACK_GENERIC';
                    result.response = settings.fallback_message_text ||
                      'Lo siento, no entendí tu pregunta. ¿Podrías reformularla o escribir "ayuda" para ver en qué puedo ayudarte?';
                  } else {
                    result.action = 'NO_MATCH';
                    result.response = '❌ No se encontró ninguna regla (fallback desactivado)';
                  }
                }
              }
            }
          } else {
            // No hay matches de embeddings
            if (settings.fallback_message_enabled === 'true') {
              result.action = 'SEND_FALLBACK_GENERIC';
              result.response = settings.fallback_message_text ||
                'Lo siento, no entendí tu pregunta. ¿Podrías reformularla o escribir "ayuda" para ver en qué puedo ayudarte?';
            } else {
              result.action = 'NO_MATCH';
              result.response = '❌ No se encontró ninguna regla';
            }
          }
        } catch (err) {
          console.error('Error testing embeddings:', err);
          result.debug.embedding_error = String(err);
        }
      } else {
        result.debug.embedding_status = 'Embeddings configurados pero servicio no disponible';

        if (settings.fallback_message_enabled === 'true') {
          result.action = 'SEND_FALLBACK_GENERIC';
          result.response = settings.fallback_message_text ||
            'Lo siento, no entendí tu pregunta. ¿Podrías reformularla o escribir "ayuda" para ver en qué puedo ayudarte?';
        } else {
          result.action = 'NO_MATCH';
          result.response = '❌ No se encontró ninguna regla';
        }
      }
    } else if (!result.match) {
      // No hay match y embeddings desactivados
      if (settings.fallback_message_enabled === 'true') {
        result.action = 'SEND_FALLBACK_GENERIC';
        result.response = settings.fallback_message_text ||
          'Lo siento, no entendí tu pregunta. ¿Podrías reformularla o escribir "ayuda" para ver en qué puedo ayudarte?';
      } else {
        result.action = 'NO_MATCH';
        result.response = '❌ No se encontró ninguna regla';
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in test-auto-reply:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
