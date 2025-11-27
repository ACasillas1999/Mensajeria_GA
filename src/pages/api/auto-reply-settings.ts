import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';

/**
 * GET /api/auto-reply-settings
 * Obtiene la configuración del sistema de auto-respuestas
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
      'SELECT setting_key, setting_value, description FROM auto_reply_settings'
    );

    const settings: Record<string, any> = {};
    for (const row of rows as any[]) {
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
      };
    }

    return new Response(JSON.stringify({ ok: true, settings }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error fetching settings:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/auto-reply-settings
 * Actualiza una configuración
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
    const { setting_key, setting_value } = data;

    if (!setting_key || setting_value === undefined) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await pool.query(
      'UPDATE auto_reply_settings SET setting_value = ? WHERE setting_key = ?',
      [setting_value, setting_key]
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error updating setting:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
