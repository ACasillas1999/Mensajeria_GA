import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import {
  processRuleSuggestions,
  getPendingSuggestions,
  approveSuggestion,
  rejectSuggestion,
} from '../../../lib/ruleSuggestions';

/**
 * GET: Obtener sugerencias de reglas
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const minOccurrences = parseInt(url.searchParams.get('minOccurrences') || '5', 10);
    const status = url.searchParams.get('status') || 'pending';

    let query = `
      SELECT
        rs.*,
        ar.name AS closest_rule_name,
        (SELECT COUNT(*) FROM suggestion_messages sm WHERE sm.suggestion_id = rs.id) AS message_count
      FROM rule_suggestions rs
      LEFT JOIN auto_replies ar ON rs.closest_existing_rule_id = ar.id
      WHERE rs.status = ?
    `;

    const params: any[] = [status];

    if (status === 'pending') {
      query += ` AND rs.occurrence_count >= ?`;
      params.push(minOccurrences);
    }

    query += ` ORDER BY rs.priority_score DESC, rs.occurrence_count DESC LIMIT 50`;

    const [rows] = await pool.query(query, params);

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching rule suggestions:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * POST: Procesar mensajes no reconocidos y generar sugerencias
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await processRuleSuggestions();

    const suggestions = await getPendingSuggestions();

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Sugerencias procesadas',
        count: suggestions.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing suggestions:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * PATCH: Aprobar o rechazar una sugerencia
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { id, action, responseText, matchType, notes } = body;

    if (!id || !action) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere id y action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve') {
      if (!responseText) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Se requiere responseText para aprobar' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const ruleId = await approveSuggestion(id, responseText, matchType || 'contains');

      return new Response(
        JSON.stringify({
          ok: true,
          message: 'Sugerencia aprobada y regla creada',
          ruleId,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (action === 'reject') {
      await rejectSuggestion(id, notes);

      return new Response(
        JSON.stringify({ ok: true, message: 'Sugerencia rechazada' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: 'Acción no válida' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error updating suggestion:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
