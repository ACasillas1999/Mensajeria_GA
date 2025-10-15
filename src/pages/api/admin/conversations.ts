import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { rol:string } | undefined;
  if (!user || (user.rol||'').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  const url = new URL(request.url);
  const estado = url.searchParams.get("estado") || "";      // "ABIERTA", "NUEVA", etc.
  const asignado = url.searchParams.get("asignado") || "";  // "null", "any", userId
  const search = url.searchParams.get("search")?.trim() || "";
  const limit  = Math.min(Number(url.searchParams.get("limit") || 100), 300);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  const params:any[] = [];
  let where = "WHERE 1=1";

  if (estado) { where += " AND c.estado = ?"; params.push(estado); }

  if (asignado === "null")      { where += " AND c.asignado_a IS NULL"; }
  else if (asignado === "any")  { /* nada */ }
  else if (/^\d+$/.test(asignado)) { where += " AND c.asignado_a = ?"; params.push(Number(asignado)); }

  if (search) {
    where += " AND (COALESCE(c.wa_profile_name, c.wa_user) LIKE CONCAT('%', ?, '%') OR CAST(c.id AS CHAR) LIKE CONCAT('%', ?, '%'))";
    params.push(search, search);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT c.id, c.wa_user, c.wa_profile_name,
           c.ultimo_msg, c.ultimo_ts, c.estado, c.asignado_a,
           u.nombre AS asignado_nombre
    FROM conversaciones c
    LEFT JOIN usuarios u ON u.id = c.asignado_a
    ${where}
    ORDER BY COALESCE(c.ultimo_ts, UNIX_TIMESTAMP(c.creado_en)) DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return new Response(JSON.stringify({ ok:true, items: rows }), { headers: { "Content-Type":"application/json" } });
};
