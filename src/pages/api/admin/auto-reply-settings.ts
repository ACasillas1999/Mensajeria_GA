import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';

function requireAdmin(locals: any): { ok: boolean; error?: string } {
  const user = locals?.user;
  if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
    return { ok: false, error: 'No autorizado' };
  }
  return { ok: true };
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const keys = [
      'auto_reply_enabled',
      'out_of_hours_enabled',
      'out_of_hours_message',
      'auto_reply_delay_seconds',
      'max_auto_replies_per_conversation',
      'embedding_service_enabled',
      'embedding_similarity_threshold',
      'fallback_message_enabled',
      'fallback_message_text',
      'fallback_suggest_enabled',
      'fallback_suggest_threshold',
    ];

    const [rows] = await pool.query(
      `SELECT setting_key, setting_value, description
       FROM auto_reply_settings
       WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
      keys
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const body = await request.json();
    const entries = Object.entries(body || {});

    if (!entries.length) {
      return new Response(JSON.stringify({ ok: false, error: 'Sin cambios' }), { status: 400 });
    }

    for (const [key, value] of entries) {
      await pool.query(
        `UPDATE auto_reply_settings SET setting_value = ? WHERE setting_key = ?`,
        [String(value), key]
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

