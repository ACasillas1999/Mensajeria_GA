import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const user = (locals as any).user as { id: number; rol?: string } | undefined;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "No autenticado" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const isAdmin = String(user.rol || "").toLowerCase() === "admin";

    const params: any[] = [user.id, user.id, user.id, isAdmin ? 1 : 0];
    let searchClause = "";
    if (q) {
      searchClause = " AND (LOWER(c.name) LIKE ? OR LOWER(c.description) LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        c.id,
        c.name,
        c.description,
        c.type,
        c.archived,
        c.created_by,
        c.write_permission,
        c.invite_permission,
        c.thread_permission,
        c.pin_permission,
        c.delete_permission,
        m.role AS member_role,
        lm.id AS last_message_id,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        lm.user_id AS last_message_user_id,
        u.nombre AS last_message_user_name,
        IF(f.id IS NULL, 0, 1) AS is_favorite
      FROM internal_channels c
      LEFT JOIN internal_channel_members m
        ON m.channel_id = c.id AND m.user_id = ?
      LEFT JOIN internal_favorites f
        ON f.channel_id = c.id AND f.user_id = ?
      LEFT JOIN internal_messages lm ON lm.id = (
        SELECT im.id
        FROM internal_messages im
        WHERE im.channel_id = c.id AND im.deleted_at IS NULL
        ORDER BY im.created_at DESC, im.id DESC
        LIMIT 1
      )
      LEFT JOIN usuarios u ON u.id = lm.user_id
      WHERE c.archived = 0
        AND (c.type = 'public' OR m.user_id IS NOT NULL OR c.created_by = ? OR ? = 1)
        ${searchClause}
      ORDER BY (lm.created_at IS NULL), lm.created_at DESC, c.name ASC
      `,
      params,
    );

    return new Response(
      JSON.stringify({ ok: true, items: rows, currentUserId: user.id }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error getting internal channels:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al cargar canales" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
