import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url   = new URL(request.url);
    const cid   = url.searchParams.get("conversation_id");
    const limit = Math.min(Number(url.searchParams.get("limit") || 150), 500);
    const before= url.searchParams.get("before");
    const q     = (url.searchParams.get("q") || "").trim();

    if (!cid) {
      return new Response(JSON.stringify({ ok:false, error:"conversation_id requerido" }), { status: 400 });
    }

    const params: any[] = [cid];
    let where = "WHERE m.conversacion_id = ?";
    if (before) {
      const b = /^\d+$/.test(before) ? Number(before) : Math.floor(new Date(before).getTime() / 1000);
      // Traer mensajes ANTERIORES a ese timestamp
      where += " AND COALESCE(UNIX_TIMESTAMP(m.creado_en), m.ts) < ?";
      params.push(b);
    }
    if (q) {
      where += " AND m.cuerpo LIKE CONCAT('%', ?, '%')";
      params.push(q);
    }

    // Traer SIEMPRE los mensajes más recientes primero (por timestamp)
    // y luego reordenarlos ascendente para mostrarlos en orden de chat.
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT *
      FROM (
        SELECT
          m.id,
          m.conversacion_id,
          m.cuerpo,
          m.is_auto_reply,
          m.from_me,
          m.tipo,
          m.media_id,
          m.media_url,
          m.mime_type,
          m.wa_msg_id,
          m.status,
          m.status_ts,
          m.agent_reaction_emoji,
          m.client_reaction_emoji,
          m.usuario_id,
          u.nombre AS usuario_nombre,
          COALESCE(m.creado_en, FROM_UNIXTIME(m.ts)) AS creado_en,
          COALESCE(UNIX_TIMESTAMP(m.creado_en), m.ts) AS sort_ts
        FROM mensajes m
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        ${where}
        ORDER BY sort_ts DESC
        LIMIT ?
      ) AS recent
      ORDER BY recent.sort_ts ASC
      `,
      [...params, limit]
    );

    const items = rows.map(r => {
      let text = r.cuerpo ?? "";
      if ((!text || String(text).trim()==="") && r.tipo && r.tipo!=="text") text = `[${r.tipo}]`;
      return {
        id: r.id,
        conversation_id: r.conversacion_id,
        text,
        created_at: r.creado_en,
        sender: r.from_me ? "me" : "them",
        is_auto_reply: !!(r as any).is_auto_reply,
        tipo: r.tipo,
        media_id: (r as any).media_id || null,
        media_url: r.media_url || null,
        mime_type: r.mime_type || null,
        wa_msg_id: (r as any).wa_msg_id || null,
        status: (r as any).status || null,
        status_ts: (r as any).status_ts || null,
        agent_reaction_emoji: (r as any).agent_reaction_emoji || null,
        client_reaction_emoji: (r as any).client_reaction_emoji || null,
        usuario_id: (r as any).usuario_id || null,
        usuario_nombre: (r as any).usuario_nombre || null,
      };
    });

    return new Response(JSON.stringify({ ok:true, items }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || "Error" }), { status: 500 });
  }
  
};
