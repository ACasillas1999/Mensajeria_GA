import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const GET: APIRoute = async ({ locals }) => {
  const user = (locals as any).user as { rol:string } | undefined;
  if (!user || (user.rol||'').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, nombre FROM sucursales ORDER BY nombre ASC");
  return new Response(JSON.stringify({ ok:true, items: rows }), { headers: { "Content-Type":"application/json" }});
};
