import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import { updateRuleEmbedding } from '../../lib/embeddings';

/**
 * GET /api/auto-replies
 * Obtiene todas las reglas de auto-respuesta
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [rows] = await pool.query(
      `SELECT id, name, trigger_keywords, response_text, is_active, priority,
              match_type, case_sensitive, embedding_generated_at,
              created_at, updated_at
       FROM auto_replies
       ORDER BY priority DESC, name ASC`
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error fetching auto-replies:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/auto-replies
 * Crea una nueva regla de auto-respuesta
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await request.json();
    const {
      name,
      trigger_keywords,
      response_text,
      is_active = true,
      priority = 10,
      match_type = 'contains',
      case_sensitive = false,
    } = data;

    if (!name || !trigger_keywords || !response_text) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO auto_replies
       (name, trigger_keywords, response_text, is_active, priority, match_type, case_sensitive)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, trigger_keywords, response_text, is_active, priority, match_type, case_sensitive]
    );

    const insertId = (result as any).insertId;

    // Generar embedding automáticamente
    await updateRuleEmbedding(insertId);

    return new Response(
      JSON.stringify({ ok: true, id: insertId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error creating auto-reply:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * PUT /api/auto-replies
 * Actualiza una regla existente
 */
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await request.json();
    const {
      id,
      name,
      trigger_keywords,
      response_text,
      is_active,
      priority,
      match_type,
      case_sensitive,
    } = data;

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await pool.query(
      `UPDATE auto_replies
       SET name = ?, trigger_keywords = ?, response_text = ?,
           is_active = ?, priority = ?, match_type = ?, case_sensitive = ?
       WHERE id = ?`,
      [name, trigger_keywords, response_text, is_active, priority, match_type, case_sensitive, id]
    );

    // Regenerar embedding
    await updateRuleEmbedding(id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error updating auto-reply:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * DELETE /api/auto-replies
 * Elimina una regla
 */
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await pool.query('DELETE FROM auto_replies WHERE id = ?', [id]);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error deleting auto-reply:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
