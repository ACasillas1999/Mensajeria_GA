import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = Number(params.id);
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'Invalid id' }), { status: 400 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, wa_user, COALESCE(wa_profile_name, wa_user, CONCAT('Chat ', id)) AS title
       FROM conversaciones WHERE id=? LIMIT 1`,
      [id]
    );
    if (!(rows as any[]).length) {
      return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
    }
    const item = (rows as any[])[0];
    return new Response(JSON.stringify({ ok: true, item }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Error' }), { status: 500 });
  }
};

