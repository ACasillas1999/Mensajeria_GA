import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { rol:string } | undefined;
  if (!user || (user.rol||'').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  const url = new URL(request.url);
  const suc = url.searchParams.get("sucursal_id");
  const params: any[] = ["AGENTE", 1];
  let where = "WHERE u.rol=? AND u.activo=?";
  if (suc) { where += " AND u.sucursal_id=?"; params.push(Number(suc)); }

  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT u.id, u.nombre, u.email, u.sucursal_id, s.nombre AS sucursal
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id = u.sucursal_id
    ${where}
    ORDER BY s.nombre ASC, u.nombre ASC
    `,
    params
  );

  return new Response(JSON.stringify({ ok:true, items: rows }), { headers: { "Content-Type": "application/json" } });
};
