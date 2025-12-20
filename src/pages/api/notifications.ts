// src/pages/api/notifications.ts
import type { APIRoute } from "astro";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../lib/db";

/**
 * GET: Obtener notificaciones del usuario actual
 * Query params:
 *   - leida: true/false (opcional, filtrar por leída/no leída)
 *   - limit: número (default 50)
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const url = new URL(request.url);
    const leida = url.searchParams.get("leida");
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    let query = `
      SELECT
        an.id,
        an.tipo,
        an.conversacion_id,
        an.mensaje_id,
        an.leida,
        an.leida_en,
        an.creada_en,
        c.wa_user,
        c.wa_profile_name,
        m.cuerpo AS mensaje_texto
      FROM agent_notifications an
      JOIN conversaciones c ON c.id = an.conversacion_id
      LEFT JOIN mensajes m ON m.id = an.mensaje_id
      WHERE an.usuario_id = ?
    `;

    const params: any[] = [user.id];

    if (leida === "true") {
      query += " AND an.leida = TRUE";
    } else if (leida === "false") {
      query += " AND an.leida = FALSE";
    }

    query += " ORDER BY an.creada_en DESC LIMIT ?";
    params.push(limit);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Obtener conteo de no leídas
    const [countRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM agent_notifications WHERE usuario_id = ? AND leida = FALSE",
      [user.id]
    );
    const unreadCount = countRows[0]?.count || 0;

    return new Response(
      JSON.stringify({
        ok: true,
        items: rows,
        unread_count: unreadCount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error fetching notifications:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Error" }),
      { status: 500 }
    );
  }
};

/**
 * POST: Marcar notificación(es) como leída(s)
 * Body:
 *   - notification_id: number (marcar una específica)
 *   - conversation_id: number (marcar todas de una conversación)
 *   - mark_all_read: boolean (marcar todas como leídas)
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const body = await request.json();
    const { notification_id, conversation_id, mark_all_read } = body;

    if (mark_all_read) {
      // Marcar todas como leídas
      await pool.execute<ResultSetHeader>(
        "UPDATE agent_notifications SET leida = TRUE, leida_en = NOW() WHERE usuario_id = ? AND leida = FALSE",
        [user.id]
      );
      return new Response(JSON.stringify({ ok: true, message: "Todas las notificaciones marcadas como leídas" }));
    } else if (conversation_id) {
      // Marcar todas de una conversación como leídas
      await pool.execute<ResultSetHeader>(
        "UPDATE agent_notifications SET leida = TRUE, leida_en = NOW() WHERE usuario_id = ? AND conversacion_id = ? AND leida = FALSE",
        [user.id, conversation_id]
      );
      return new Response(JSON.stringify({ ok: true, message: "Notificaciones de conversación marcadas como leídas" }));
    } else if (notification_id) {
      // Marcar una específica como leída
      await pool.execute<ResultSetHeader>(
        "UPDATE agent_notifications SET leida = TRUE, leida_en = NOW() WHERE id = ? AND usuario_id = ?",
        [notification_id, user.id]
      );
      return new Response(JSON.stringify({ ok: true, message: "Notificación marcada como leída" }));
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: "Se requiere notification_id, conversation_id o mark_all_read" }),
        { status: 400 }
      );
    }
  } catch (e: any) {
    console.error("Error marking notifications as read:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Error" }),
      { status: 500 }
    );
  }
};

/**
 * PUT: Actualizar estado de lectura de conversación
 * Body:
 *   - conversation_id: number
 *   - last_message_id: number (opcional)
 *   - last_ts: number (timestamp Unix)
 */
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const body = await request.json();
    const { conversation_id, last_message_id, last_ts } = body;

    if (!conversation_id || !last_ts) {
      return new Response(
        JSON.stringify({ ok: false, error: "conversation_id y last_ts son requeridos" }),
        { status: 400 }
      );
    }

    // Insertar o actualizar registro de lectura
    await pool.execute<ResultSetHeader>(
      `INSERT INTO conversation_read_status (usuario_id, conversacion_id, ultimo_mensaje_visto_id, ultimo_ts_visto)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ultimo_mensaje_visto_id = VALUES(ultimo_mensaje_visto_id),
         ultimo_ts_visto = VALUES(ultimo_ts_visto)`,
      [user.id, conversation_id, last_message_id || null, last_ts]
    );

    // También marcar notificaciones de esta conversación como leídas
    await pool.execute<ResultSetHeader>(
      "UPDATE agent_notifications SET leida = TRUE, leida_en = NOW() WHERE usuario_id = ? AND conversacion_id = ? AND leida = FALSE",
      [user.id, conversation_id]
    );

    return new Response(JSON.stringify({ ok: true, message: "Estado de lectura actualizado" }));
  } catch (e: any) {
    console.error("Error updating read status:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Error" }),
      { status: 500 }
    );
  }
};
