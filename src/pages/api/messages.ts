import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  try {
    const url = new URL(request.url);
    const cid = url.searchParams.get("conversation_id");
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 500);
    const before = url.searchParams.get("before");
    const q = (url.searchParams.get("q") || "").trim();

    console.log(`[API /messages] Request for conversation ${cid}, limit ${limit}`);

    if (!cid) {
      return new Response(JSON.stringify({ ok: false, error: "conversation_id requerido" }), { status: 400 });
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
    console.log(`[API /messages] Executing query...`);
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
          m.replied_to_msg_id,
          m.replied_to_wa_id,
          m.replied_to_text,
          u.nombre AS usuario_nombre,
          COALESCE(UNIX_TIMESTAMP(m.creado_en), m.ts) AS ts,
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
    console.log(`[API /messages] Query returned ${rows.length} rows`);

    const items = rows.map(r => {
      let text = r.cuerpo ?? "";
      if ((!text || String(text).trim() === "") && r.tipo && r.tipo !== "text") text = `[${r.tipo}]`;
      return {
        id: r.id,
        conversation_id: r.conversacion_id,
        text,
        ts: (r as any).ts, // Timestamp Unix en segundos
        created_at: new Date((r as any).ts * 1000).toISOString(), // ISO string para compatibilidad
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
        replied_to_msg_id: (r as any).replied_to_msg_id || null,
        replied_to_wa_id: (r as any).replied_to_wa_id || null,
        replied_to_text: (r as any).replied_to_text || null,
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[API /messages] Completed in ${duration}ms, returning ${items.length} items`);

    return new Response(JSON.stringify({ ok: true, items }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(`[API /messages] ERROR:`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Error" }), { status: 500 });
  }

};
