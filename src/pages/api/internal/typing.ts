import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

const findChatId = async (userId: number, otherUserId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT c.id
    FROM internal_dm_chats c
    JOIN internal_dm_participants p1
      ON p1.chat_id = c.id AND p1.user_id = ?
    JOIN internal_dm_participants p2
      ON p2.chat_id = c.id AND p2.user_id = ?
    LIMIT 1
    `,
    [userId, otherUserId],
  );
  return rows.length ? Number(rows[0].id) : null;
};

const isDmParticipant = async (chatId: number, userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT id
    FROM internal_dm_participants
    WHERE chat_id = ? AND user_id = ?
    LIMIT 1
    `,
    [chatId, userId],
  );
  return rows.length > 0;
};

const getChannelWithRole = async (channelId: number, userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT
      c.id,
      c.type,
      c.archived,
      c.created_by,
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
    const type = String(url.searchParams.get("type") || "");
    const chatId = Number(url.searchParams.get("chat_id") || 0);
    const channelId = Number(url.searchParams.get("channel_id") || 0);

    if (type !== "dm" && type !== "channel") {
      return new Response(
        JSON.stringify({ ok: false, error: "Tipo invalido" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (type === "dm") {
      if (!chatId) {
        return new Response(JSON.stringify({ ok: true, items: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const allowed = await isDmParticipant(chatId, user.id);
      if (!allowed) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT u.id, u.nombre
        FROM internal_typing_status t
        JOIN usuarios u ON u.id = t.user_id
        WHERE t.dm_chat_id = ?
          AND t.user_id <> ?
          AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 6 SECOND)
        ORDER BY t.updated_at DESC
        `,
        [chatId, user.id],
      );

      return new Response(JSON.stringify({ ok: true, items: rows }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!channelId) {
      return new Response(JSON.stringify({ ok: true, items: [] }), {
        headers: { "Content-Type": "application/json" },
      });
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

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT u.id, u.nombre
      FROM internal_typing_status t
      JOIN usuarios u ON u.id = t.user_id
      WHERE t.channel_id = ?
        AND t.user_id <> ?
        AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 6 SECOND)
      ORDER BY t.updated_at DESC
      `,
      [channelId, user.id],
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error getting typing status:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al cargar estado" }),
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

    const body = await request.json();
    const type = String(body?.type || "");
    let chatId = Number(body?.chat_id || 0);
    const channelId = Number(body?.channel_id || 0);
    const otherUserId = Number(body?.user_id || 0);

    if (type !== "dm" && type !== "channel") {
      return new Response(
        JSON.stringify({ ok: false, error: "Tipo invalido" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (type === "dm") {
      if (!chatId && otherUserId) {
        chatId = (await findChatId(user.id, otherUserId)) || 0;
      }
      if (!chatId) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const allowed = await isDmParticipant(chatId, user.id);
      if (!allowed) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }

      await pool.query(
        `
        INSERT INTO internal_typing_status (user_id, dm_chat_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `,
        [user.id, chatId],
      );

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!channelId) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
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

    await pool.query(
      `
      INSERT INTO internal_typing_status (user_id, channel_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
      `,
      [user.id, channelId],
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating typing status:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al actualizar estado" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
