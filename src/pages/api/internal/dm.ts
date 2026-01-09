import type { APIRoute } from "astro";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
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
    const otherId = Number(url.searchParams.get("user_id") || 0);
    const chatIdParam = Number(url.searchParams.get("chat_id") || 0);
    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);

    if (!otherId && !chatIdParam) {
      return new Response(
        JSON.stringify({ ok: false, error: "Falta user_id o chat_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let chatId: number | null = null;

    if (chatIdParam) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT id
        FROM internal_dm_participants
        WHERE chat_id = ? AND user_id = ?
        LIMIT 1
        `,
        [chatIdParam, user.id],
      );
      if (!rows.length) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
      chatId = chatIdParam;
    } else if (otherId) {
      const [userRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1",
        [otherId],
      );
      if (!userRows.length) {
        return new Response(
          JSON.stringify({ ok: false, error: "Usuario no encontrado" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }
      chatId = await findChatId(user.id, otherId);
    }

    if (!chatId) {
      return new Response(
        JSON.stringify({ ok: true, chat_id: null, items: [], currentUserId: user.id }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const [messages] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, user_id, content, created_at, edited_at
      FROM internal_messages
      WHERE dm_chat_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
      LIMIT ?
      `,
      [chatId, limit],
    );

    return new Response(
      JSON.stringify({ ok: true, chat_id: chatId, items: messages, currentUserId: user.id }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error getting internal messages:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al cargar mensajes" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const user = (locals as any).user as { id: number } | undefined;
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: "No autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await request.json();
    const content = String(body?.content || "").trim();
    if (!content) {
      return new Response(
        JSON.stringify({ ok: false, error: "Mensaje vacio" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let chatId = Number(body?.chat_id || 0);
    const otherId = Number(body?.user_id || 0);

    if (!chatId && !otherId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Falta chat_id o user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (otherId && otherId === user.id) {
      return new Response(
        JSON.stringify({ ok: false, error: "No puedes enviarte mensajes a ti mismo" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (chatId) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT id
        FROM internal_dm_participants
        WHERE chat_id = ? AND user_id = ?
        LIMIT 1
        `,
        [chatId, user.id],
      );
      if (!rows.length) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    if (!chatId && otherId) {
      const [userRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1",
        [otherId],
      );
      if (!userRows.length) {
        return new Response(
          JSON.stringify({ ok: false, error: "Usuario no encontrado" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      chatId = await findChatId(user.id, otherId);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (!chatId) {
        const [chatRes] = await conn.execute<ResultSetHeader>(
          "INSERT INTO internal_dm_chats () VALUES ()",
        );
        chatId = chatRes.insertId;
        await conn.query(
          `
          INSERT IGNORE INTO internal_dm_participants (chat_id, user_id)
          VALUES (?, ?), (?, ?)
          `,
          [chatId, user.id, chatId, otherId],
        );
      }

      const [msgRes] = await conn.execute<ResultSetHeader>(
        `
        INSERT INTO internal_messages (dm_chat_id, user_id, message_type, content)
        VALUES (?, ?, 'text', ?)
        `,
        [chatId, user.id, content],
      );

      const [msgRows] = await conn.query<RowDataPacket[]>(
        "SELECT id, user_id, content, created_at FROM internal_messages WHERE id = ?",
        [msgRes.insertId],
      );
      await conn.commit();

      return new Response(
        JSON.stringify({
          ok: true,
          chat_id: chatId,
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
    console.error("Error sending internal message:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Error al enviar mensaje" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
