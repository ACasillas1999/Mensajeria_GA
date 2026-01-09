import type { APIRoute } from "astro";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../../lib/db";

const canAccessChannel = async (
  channelId: number,
  userId: number,
  isAdmin: boolean,
) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT c.id, c.type, c.created_by, m.user_id AS member_id
    FROM internal_channels c
    LEFT JOIN internal_channel_members m
      ON m.channel_id = c.id AND m.user_id = ?
    WHERE c.id = ? AND c.archived = 0
    LIMIT 1
    `,
    [userId, channelId],
  );
  if (!rows.length) return false;
  const row = rows[0];
  if (row.type === "public") return true;
  if (isAdmin) return true;
  if (Number(row.created_by) === userId) return true;
  return Boolean(row.member_id);
};

const canAccessDm = async (chatId: number, userId: number) => {
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
    const type = String(body?.type || "");
    const favoriteFlag =
      body?.favorite === undefined ? null : Boolean(body.favorite);
    const isAdmin = String(user.rol || "").toLowerCase() === "admin";

    if (type !== "channel" && type !== "dm") {
      return new Response(
        JSON.stringify({ ok: false, error: "Tipo no valido" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (type === "channel") {
      const channelId = Number(body?.channel_id || 0);
      if (!channelId) {
        return new Response(
          JSON.stringify({ ok: false, error: "Falta channel_id" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const allowed = await canAccessChannel(channelId, user.id, isAdmin);
      if (!allowed) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }

      if (favoriteFlag === false) {
        await pool.query(
          "DELETE FROM internal_favorites WHERE user_id = ? AND channel_id = ?",
          [user.id, channelId],
        );
        return new Response(
          JSON.stringify({ ok: true, is_favorite: false }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      await pool.execute<ResultSetHeader>(
        "INSERT IGNORE INTO internal_favorites (user_id, channel_id) VALUES (?, ?)",
        [user.id, channelId],
      );
      return new Response(
        JSON.stringify({ ok: true, is_favorite: true }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const dmChatId = Number(body?.dm_chat_id || 0);
    if (!dmChatId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Falta dm_chat_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const allowed = await canAccessDm(dmChatId, user.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    if (favoriteFlag === false) {
      await pool.query(
        "DELETE FROM internal_favorites WHERE user_id = ? AND dm_chat_id = ?",
        [user.id, dmChatId],
      );
      return new Response(
        JSON.stringify({ ok: true, is_favorite: false }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    await pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO internal_favorites (user_id, dm_chat_id) VALUES (?, ?)",
      [user.id, dmChatId],
    );
    return new Response(
      JSON.stringify({ ok: true, is_favorite: true }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error updating favorites:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al actualizar favoritos" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
