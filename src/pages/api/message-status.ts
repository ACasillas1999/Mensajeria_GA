import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const cid = url.searchParams.get("conversation_id");
    if (!cid) return new Response(JSON.stringify({ ok:false, error:"conversation_id requerido" }), { status:400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, wa_msg_id, status, status_ts
      FROM mensajes
      WHERE conversacion_id = ? AND from_me = 1
      ORDER BY id DESC
      LIMIT 500
      `,
      [cid]
    );
    return new Response(JSON.stringify({ ok:true, items: rows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || "Error" }), { status: 500 });
  }
};
