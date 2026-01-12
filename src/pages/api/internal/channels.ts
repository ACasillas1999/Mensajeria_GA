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

    const params: any[] = [
      user.id,
      user.id,
      user.id,
      user.id,
      user.id,
      user.id,
      user.id,
      isAdmin ? 1 : 0,
    ];
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
        tc.typing_count,
        tc.typing_names,
        lm.id AS last_message_id,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        lm.user_id AS last_message_user_id,
        u.nombre AS last_message_user_name,
        IF(f.id IS NULL, 0, 1) AS is_favorite,
        rs.last_read_message_id,
        CASE
          WHEN lm.id IS NULL THEN 0
          WHEN lm.user_id = ? THEN 0
          WHEN rs.last_read_message_id IS NULL THEN 1
          WHEN rs.last_read_message_id < lm.id THEN 1
          ELSE 0
        END AS has_unread,
        (
          SELECT COUNT(*)
          FROM internal_messages imc
          WHERE imc.channel_id = c.id
            AND imc.deleted_at IS NULL
            AND imc.user_id <> ?
            AND (
              rs.last_read_message_id IS NULL
              OR imc.id > rs.last_read_message_id
            )
        ) AS unread_count
      FROM internal_channels c
      LEFT JOIN internal_channel_members m
        ON m.channel_id = c.id AND m.user_id = ?
      LEFT JOIN internal_favorites f
        ON f.channel_id = c.id AND f.user_id = ?
      LEFT JOIN internal_read_status rs
        ON rs.channel_id = c.id AND rs.user_id = ?
      LEFT JOIN (
        SELECT
          t.channel_id,
          COUNT(DISTINCT t.user_id) AS typing_count,
          GROUP_CONCAT(DISTINCT u.nombre SEPARATOR ', ') AS typing_names
        FROM internal_typing_status t
        JOIN usuarios u ON u.id = t.user_id
        WHERE t.channel_id IS NOT NULL
          AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 6 SECOND)
          AND t.user_id <> ?
        GROUP BY t.channel_id
      ) tc ON tc.channel_id = c.id
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
      JSON.stringify({ ok: true, items: rows, currentUserId: user.id, isAdmin }),
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

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const user = (locals as any).user as { id: number; rol?: string } | undefined;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "No autenticado" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Only admins can create channels
    const isAdmin = String(user.rol || "").toLowerCase() === "admin";
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ ok: false, error: "Solo administradores pueden crear canales" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await request.json();
    const { name, description, type, member_ids } = body;

    // Validate channel name
    if (!name || typeof name !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Nombre de canal requerido" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Clean and validate channel name (lowercase, no spaces, alphanumeric + hyphens)
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!cleanName || cleanName.length < 2 || cleanName.length > 50) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nombre de canal inválido (2-50 caracteres, solo letras, números y guiones)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate type
    const channelType = type === "private" ? "private" : "public";

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Create channel
      const [result] = await connection.query<any>(
        `INSERT INTO internal_channels (name, description, type, created_by)
         VALUES (?, ?, ?, ?)`,
        [cleanName, description || null, channelType, user.id]
      );

      const channelId = result.insertId;

      // Add creator as owner
      await connection.query(
        `INSERT INTO internal_channel_members (channel_id, user_id, role)
         VALUES (?, ?, 'owner')`,
        [channelId, user.id]
      );

      // Add additional members if provided
      if (Array.isArray(member_ids) && member_ids.length > 0) {
        const validMemberIds = member_ids.filter((id) => typeof id === "number" && id !== user.id);
        if (validMemberIds.length > 0) {
          const values = validMemberIds.map((memberId) => [channelId, memberId, "member", user.id]);
          await connection.query(
            `INSERT INTO internal_channel_members (channel_id, user_id, role, invited_by)
             VALUES ?`,
            [values]
          );
        }
      }

      // Create welcome message
      await connection.query(
        `INSERT INTO internal_messages (channel_id, user_id, message_type, content)
         VALUES (?, ?, 'text', ?)`,
        [
          channelId,
          user.id,
          `¡Bienvenido al canal #${cleanName}! ${description ? description : ""}`,
        ]
      );

      await connection.commit();

      return new Response(
        JSON.stringify({
          ok: true,
          channel: {
            id: channelId,
            name: cleanName,
            description,
            type: channelType,
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      await connection.rollback();

      // Check for duplicate channel name
      if (error.code === "ER_DUP_ENTRY") {
        return new Response(
          JSON.stringify({ ok: false, error: "Ya existe un canal con ese nombre" }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }

      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error creating channel:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al crear canal" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
