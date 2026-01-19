import type { APIRoute } from "astro";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../../lib/db";

const getChannelWithRole = async (channelId: number, userId: number) => {
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
      m.role AS member_role
    FROM internal_channels c
    LEFT JOIN internal_channel_members m
      ON m.channel_id = c.id AND m.user_id = ?
    WHERE c.id = ?
    LIMIT 1
    `,
    [userId, channelId],
  );
  return rows.length ? rows[0] : null;
};

const canAccessChannel = (channel: any, isAdmin: boolean, userId: number) => {
  if (!channel || channel.archived) return false;
  if (channel.type === "private") {
    if (isAdmin || channel.created_by === userId) return true;
    return Boolean(channel.member_role);
  }
  return true;
};

const canWriteChannel = (channel: any, isAdmin: boolean, userId: number) => {
  if (!channel) return false;
  const role = String(channel.member_role || "").toLowerCase();
  const isOwner = channel.created_by === userId || role === "owner";
  const isChannelAdmin = role === "admin" || role === "owner";

  switch (channel.write_permission) {
    case "admins":
      return isAdmin || isChannelAdmin || isOwner;
    case "owner":
      return isAdmin || isOwner;
    default:
      return true;
  }
};

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
    const channelId = Number(url.searchParams.get("channel_id") || 0);
    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);

    if (!channelId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Falta channel_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const isAdmin = String(user.rol || "").toLowerCase() === "admin";
    const channel = await getChannelWithRole(channelId, user.id);
    if (!channel) {
      return new Response(
        JSON.stringify({ ok: false, error: "Canal no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!canAccessChannel(channel, isAdmin, user.id)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const [messages] = await pool.query<RowDataPacket[]>(
      `
      SELECT im.id, im.user_id, im.content, im.created_at, im.edited_at,
             im.attachment_type, im.attachment_url, im.attachment_name,
             im.attachment_size, im.attachment_mime,
             u.nombre AS sender_name
      FROM internal_messages im
      JOIN usuarios u ON u.id = im.user_id
      WHERE im.channel_id = ? AND im.deleted_at IS NULL
      ORDER BY im.created_at ASC, im.id ASC
      LIMIT ?
      `,
      [channelId, limit],
    );

    const lastMessageId =
      messages.length > 0 ? Number(messages[messages.length - 1].id) : null;
    if (lastMessageId) {
      await pool.query(
        `
        INSERT INTO internal_read_status (user_id, channel_id, last_read_message_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          last_read_message_id = VALUES(last_read_message_id),
          last_read_at = CURRENT_TIMESTAMP
        `,
        [user.id, channelId, lastMessageId],
      );
    }

    const [readRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT user_id, last_read_message_id, last_read_at
      FROM internal_read_status
      WHERE channel_id = ? AND user_id <> ?
      `,
      [channelId, user.id],
    );
    const readers = readRows.map((row) => ({
      user_id: Number(row.user_id),
      last_read_message_id: row.last_read_message_id
        ? Number(row.last_read_message_id)
        : null,
      last_read_at: row.last_read_at || null,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        channel,
        channel_id: channelId,
        can_write: canWriteChannel(channel, isAdmin, user.id),
        items: messages,
        readers,
        currentUserId: user.id,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error getting channel messages:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al cargar mensajes" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user as { id: number; rol?: string } | undefined;
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: "No autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await request.json();
    const content = String(body?.content || "").trim();
    const attachment = body?.attachment || null;
    const channelId = Number(body?.channel_id || 0);

    if (!channelId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Falta channel_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validar que haya contenido o archivo adjunto
    if (!content && !attachment) {
      return new Response(
        JSON.stringify({ ok: false, error: "Mensaje vacio" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const isAdmin = String(user.rol || "").toLowerCase() === "admin";
    const channel = await getChannelWithRole(channelId, user.id);

    if (!channel) {
      return new Response(
        JSON.stringify({ ok: false, error: "Canal no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!canAccessChannel(channel, isAdmin, user.id)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!canWriteChannel(channel, isAdmin, user.id)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sin permisos de escritura" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (channel.type === "public" && !channel.member_role) {
        await conn.query(
          `
          INSERT IGNORE INTO internal_channel_members (channel_id, user_id, role)
          VALUES (?, ?, 'member')
          `,
          [channelId, user.id],
        );
      }

      const [msgRes] = await conn.execute<ResultSetHeader>(
        `
        INSERT INTO internal_messages (
          channel_id, user_id, message_type, content,
          attachment_type, attachment_url, attachment_name,
          attachment_size, attachment_mime
        )
        VALUES (?, ?, 'text', ?, ?, ?, ?, ?, ?)
        `,
        [
          channelId,
          user.id,
          content || null,
          attachment?.type || null,
          attachment?.url || null,
          attachment?.name || null,
          attachment?.size || null,
          attachment?.mime || null
        ],
      );

      const [msgRows] = await conn.query<RowDataPacket[]>(
        `
        SELECT im.id, im.user_id, im.content, im.created_at,
               im.attachment_type, im.attachment_url, im.attachment_name,
               im.attachment_size, im.attachment_mime,
               u.nombre AS sender_name
        FROM internal_messages im
        JOIN usuarios u ON u.id = im.user_id
        WHERE im.id = ?
        `,
        [msgRes.insertId],
      );

      await conn.query(
        `
        INSERT INTO internal_read_status (user_id, channel_id, last_read_message_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          last_read_message_id = VALUES(last_read_message_id),
          last_read_at = CURRENT_TIMESTAMP
        `,
        [user.id, channelId, msgRes.insertId],
      );

      await conn.commit();

      return new Response(
        JSON.stringify({
          ok: true,
          channel_id: channelId,
          message: msgRows[0],
          currentUserId: user.id,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error sending channel message:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al enviar mensaje" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
