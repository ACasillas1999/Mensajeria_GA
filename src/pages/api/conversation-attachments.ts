import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url   = new URL(request.url);
    const cid   = url.searchParams.get("conversation_id");
    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);
    if (!cid) return new Response(JSON.stringify({ ok:false, error:'conversation_id requerido' }), { status:400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, conversacion_id, tipo, cuerpo, media_id, media_url, mime_type,
              COALESCE(creado_en, FROM_UNIXTIME(ts)) AS creado_en
       FROM mensajes
       WHERE conversacion_id = ? AND tipo IN ('image','video','audio','document')
       ORDER BY COALESCE(creado_en, FROM_UNIXTIME(ts)) DESC
       LIMIT ?`,
      [cid, limit]
    );

    const items = (rows as any[]).map(r => ({
      id: r.id,
      tipo: r.tipo,
      caption: r.cuerpo || '',
      url: r.media_url || null,
      media_id: r.media_id || null,
      mime_type: r.mime_type || null,
      created_at: r.creado_en,
    }));

    return new Response(JSON.stringify({ ok:true, items }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'Error' }), { status: 500 });
  }
};

