import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import {
  checkEmbeddingServiceHealth,
  isEmbeddingServiceEnabled,
} from '../../../lib/embeddings';

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
      return new Response(JSON.stringify({ ok: false, error: auth.error }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [settingsRows] = await pool.query(
      `
      SELECT setting_key, setting_value
      FROM auto_reply_settings
      WHERE setting_key IN ('auto_reply_enabled', 'embedding_service_enabled')
      `
    );
    const settings = Object.fromEntries(
      (settingsRows as any[]).map((r) => [r.setting_key, r.setting_value])
    );

    const autoReplyEnabled = settings['auto_reply_enabled'] === 'true';
    const embeddingEnabledSetting = settings['embedding_service_enabled'] === 'true';

    const embeddingEnabled = await isEmbeddingServiceEnabled();
    const embeddingHealthy = await checkEmbeddingServiceHealth();

    const [msgRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_today,
        SUM(DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) = CURDATE()) AS hoy
      FROM mensajes
      `
    );
    const msgStats = (msgRows as any[])[0] || { total_today: 0, hoy: 0 };
    const messagesToday = Number(msgStats.hoy) || 0;

    const [unrecRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_today,
        SUM(DATE(created_at) = CURDATE()) AS hoy
      FROM unrecognized_messages
      `
    );
    const unrecStats = (unrecRows as any[])[0] || { total_today: 0, hoy: 0 };
    const unrecognizedToday = Number(unrecStats.hoy) || 0;

    const recognitionRate =
      messagesToday > 0
        ? Math.max(
            0,
            Math.min(1, 1 - unrecognizedToday / messagesToday)
          )
        : null;

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          auto_reply_enabled: autoReplyEnabled,
          embedding_enabled_setting: embeddingEnabledSetting,
          embedding_enabled: embeddingEnabled,
          embedding_healthy: embeddingHealthy,
          messages_today: messagesToday,
          unrecognized_today: unrecognizedToday,
          recognition_rate: recognitionRate,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error in bot-health endpoint:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

