import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = (locals as any).user as { id:number, rol:string } | undefined;
    if (!user) return new Response(JSON.stringify({ ok:false, error:'Unauthorized' }), { status: 401 });

    // Counts scoped to user (mine) and global if admin
    const myId = user.id;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         SUM(estado = 'NUEVA'   AND (asignado_a = ?)) AS mine_nuevas,
         SUM(estado = 'ABIERTA' AND (asignado_a = ?)) AS mine_abiertas,
         SUM(estado = 'RESUELTA'AND (asignado_a = ?)) AS mine_resueltas,
         SUM(estado = 'NUEVA')                        AS all_nuevas,
         SUM(estado = 'ABIERTA')                      AS all_abiertas,
         SUM(estado = 'RESUELTA')                     AS all_resueltas
       FROM conversaciones`,
      [myId, myId, myId]
    );

    const stats = (rows as any[])[0] || {};
    return new Response(JSON.stringify({ ok:true, stats }), { headers: { 'Content-Type':'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'Error' }), { status: 500 });
  }
};
