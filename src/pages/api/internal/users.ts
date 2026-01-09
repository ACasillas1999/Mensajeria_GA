import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "No autenticado" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const params: any[] = [user.id, user.id, user.id, user.id];
    let searchClause = "";
    if (q) {
      searchClause =
        " AND (u.nombre LIKE ? OR u.email LIKE ? OR s.nombre LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.activo,
        u.sucursal_id,
        s.nombre AS sucursal,
        act.last_activity_at,
        CASE
          WHEN act.last_activity_at IS NOT NULL
            AND act.last_activity_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            THEN 1
          ELSE 0
        END AS is_online,
        dm.chat_id,
        lm.id AS last_message_id,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        lm.user_id AS last_message_user_id,
        IF(f.id IS NULL, 0, 1) AS is_favorite
      FROM usuarios u
      LEFT JOIN sucursales s ON s.id = u.sucursal_id
      LEFT JOIN (
        SELECT user_id, MAX(created_at) AS last_activity_at
        FROM internal_messages
        WHERE deleted_at IS NULL
        GROUP BY user_id
      ) act ON act.user_id = u.id
      LEFT JOIN (
        SELECT
          c.id AS chat_id,
          p_other.user_id AS other_user_id
        FROM internal_dm_chats c
        JOIN internal_dm_participants p_self
          ON p_self.chat_id = c.id AND p_self.user_id = ?
        JOIN internal_dm_participants p_other
          ON p_other.chat_id = c.id AND p_other.user_id != ?
      ) dm ON dm.other_user_id = u.id
      LEFT JOIN internal_messages lm ON lm.id = (
        SELECT im.id
        FROM internal_messages im
        WHERE im.dm_chat_id = dm.chat_id AND im.deleted_at IS NULL
        ORDER BY im.created_at DESC, im.id DESC
        LIMIT 1
      )
      LEFT JOIN internal_favorites f
        ON f.dm_chat_id = dm.chat_id AND f.user_id = ?
      WHERE u.activo = 1
        AND LOWER(u.rol) IN ('agente', 'admin')
        AND u.id != ?
        ${searchClause}
      ORDER BY (lm.created_at IS NULL), lm.created_at DESC, u.nombre ASC
      `,
      params,
    );

    return new Response(
      JSON.stringify({ ok: true, items: rows, currentUserId: user.id }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error getting internal users:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al cargar usuarios" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
