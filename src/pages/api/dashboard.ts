import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = (locals as any).user as { id: number, rol: string } | undefined;
    if (!user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });

    // Counts scoped to user (mine) and global if admin
    const myId = user.id;

    // Get basic stats
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*)                                     AS total_conversaciones,
         SUM(asignado_a IS NULL)                      AS sin_asignar,
         SUM(asignado_a = ?)                          AS mine_total,
         SUM(DATE(creado_en) = CURDATE())             AS conversaciones_hoy
       FROM conversaciones`,
      [myId]
    );

    const base = (rows as any[])[0] || {};

    // Get status counts (dynamic, using new system)
    const [statusRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         cs.id,
         cs.name,
         cs.color,
         cs.icon,
         COUNT(c.id) AS total,
         SUM(c.asignado_a = ?) AS mine
       FROM conversation_statuses cs
       LEFT JOIN conversaciones c ON c.status_id = cs.id
       WHERE cs.is_active = TRUE
       GROUP BY cs.id, cs.name, cs.color, cs.icon
       ORDER BY cs.display_order`,
      [myId]
    );

    base.statuses = statusRows;

    // Extra global metrics from other tables
    const [rows2] = await pool.query<RowDataPacket[]>(
      `SELECT 
         COUNT(*)                                       AS mensajes_total,
         SUM(DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) = CURDATE()) AS mensajes_hoy
       FROM mensajes`
    );

    const [rows3] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS agentes_activos 
       FROM usuarios 
       WHERE activo = 1 AND UPPER(rol) = 'AGENTE'`
    );

    // Quotations and sales metrics
    const [rows4] = await pool.query<RowDataPacket[]>(
      `SELECT 
         COUNT(*) AS cotizaciones_total,
         SUM(DATE(created_at) = CURDATE()) AS cotizaciones_hoy
       FROM quotations`
    );

    const [rows5] = await pool.query<RowDataPacket[]>(
      `SELECT 
         COUNT(*) AS ventas_total,
         SUM(sale_amount) AS monto_total_ventas,
         SUM(DATE(completed_at) = CURDATE()) AS ventas_hoy
       FROM conversation_cycles
       WHERE sale_registered = TRUE`
    );


    // Base stats
    const stats = {
      ...base,
      ...(rows2 as any[])[0],
      ...(rows3 as any[])[0],
      ...(rows4 as any[])[0],
      ...(rows5 as any[])[0],
    } as Record<string, number>;

    // 30-day series for conversations and messages
    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(creado_en) AS d, COUNT(*) AS c
       FROM conversaciones
       WHERE creado_en >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY d
       ORDER BY d`
    );

    const [msgRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS d, COUNT(*) AS c
       FROM mensajes
       WHERE COALESCE(creado_en, FROM_UNIXTIME(ts)) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY d
       ORDER BY d`
    );

    const payload = {
      ok: true,
      stats: {
        ...stats,
        conv_series: (convRows as any[]).map(r => ({ day: r.d, count: Number(r.c) })),
        msg_series: (msgRows as any[]).map(r => ({ day: r.d, count: Number(r.c) })),
      }
    };
    return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Error' }), { status: 500 });
  }
};
