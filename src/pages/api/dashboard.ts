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

    // Distribución de conversaciones por estatus (usando historial de cambios como en auditoría)
    const [statusRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         cs.id,
         cs.name,
         cs.color,
         cs.icon,
         COUNT(csh.id) AS total,
         SUM(CASE WHEN c.asignado_a = ? THEN 1 ELSE 0 END) AS mine
       FROM conversation_statuses cs
       LEFT JOIN conversation_status_history csh ON csh.new_status_id = cs.id
       LEFT JOIN conversaciones c ON c.id = csh.conversation_id
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

    // Quotations and sales metrics (alineados con la auditoria)
    const [rows4] = await pool.query<RowDataPacket[]>(
      `SELECT
         (
           SELECT COUNT(q.id)
           FROM conversation_cycles cc
           LEFT JOIN quotations q ON q.cycle_id = cc.id
           WHERE cc.completed_at IS NOT NULL
         ) +
         (
           SELECT COUNT(q2.id)
           FROM conversaciones c
           LEFT JOIN quotations q2 ON q2.conversation_id = c.id
             AND q2.created_at >= c.current_cycle_started_at
           WHERE c.current_cycle_started_at IS NOT NULL
         ) AS cotizaciones_total,
         (
           SELECT COUNT(q3.id)
           FROM quotations q3
           WHERE DATE(q3.created_at) = CURDATE()
         ) AS cotizaciones_hoy,
         (
           SELECT COALESCE(SUM(q4.amount), 0)
           FROM conversation_cycles cc2
           LEFT JOIN quotations q4 ON q4.cycle_id = cc2.id
           WHERE cc2.completed_at IS NOT NULL
         ) +
         (
           SELECT COALESCE(SUM(q5.amount), 0)
           FROM conversaciones c2
           LEFT JOIN quotations q5 ON q5.conversation_id = c2.id
             AND q5.created_at >= c2.current_cycle_started_at
           WHERE c2.current_cycle_started_at IS NOT NULL
         ) AS monto_total_cotizado,
         (
           SELECT COALESCE(SUM(q6.amount), 0)
           FROM quotations q6
           WHERE DATE(q6.created_at) = CURDATE()
         ) AS monto_cotizado_hoy`
    );

    const [ventaStatusRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM conversation_statuses WHERE name = 'venta' LIMIT 1`
    );
    const ventaStatusId = ventaStatusRows[0]?.id ?? null;

    let ventasStats = { ventas_total: 0, ventas_hoy: 0 };
    let montoStats = { monto_total_ventas: 0 };

    if (ventaStatusId) {
      const [ventasRows] = await pool.query<RowDataPacket[]>(
        `SELECT
           COALESCE(SUM(ventas_total), 0) AS ventas_total,
           COALESCE(SUM(ventas_hoy), 0) AS ventas_hoy
         FROM (
           SELECT
             COUNT(*) AS ventas_total,
             SUM(DATE(csh.created_at) = CURDATE()) AS ventas_hoy
           FROM conversation_cycles cc
           INNER JOIN conversation_status_history csh
             ON csh.conversation_id = cc.conversation_id
            AND csh.created_at >= cc.started_at
            AND csh.created_at <= cc.completed_at
           WHERE csh.new_status_id = ?
             AND cc.completed_at IS NOT NULL

           UNION ALL

           SELECT
             COUNT(*) AS ventas_total,
             SUM(DATE(csh.created_at) = CURDATE()) AS ventas_hoy
           FROM conversaciones c
           INNER JOIN conversation_status_history csh
             ON csh.conversation_id = c.id
            AND csh.created_at >= c.current_cycle_started_at
           WHERE csh.new_status_id = ?
             AND c.current_cycle_started_at IS NOT NULL
         ) AS sales_counts`,
        [ventaStatusId, ventaStatusId]
      );

      const [montoRows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total_amount), 0) AS monto_total_ventas
         FROM (
           SELECT COALESCE(SUM(q.amount), 0) AS total_amount
           FROM quotations q
           INNER JOIN (
             SELECT DISTINCT cc.id
             FROM conversation_cycles cc
             INNER JOIN conversation_status_history csh
               ON csh.conversation_id = cc.conversation_id
              AND csh.created_at >= cc.started_at
              AND csh.created_at <= cc.completed_at
             WHERE csh.new_status_id = ?
               AND cc.completed_at IS NOT NULL
           ) AS sales_cycles ON sales_cycles.id = q.cycle_id

           UNION ALL

           SELECT COALESCE(SUM(q_active.amount), 0) AS total_amount
           FROM conversaciones c
           INNER JOIN (
             SELECT DISTINCT csh.conversation_id
             FROM conversaciones c2
             INNER JOIN conversation_status_history csh
               ON csh.conversation_id = c2.id
              AND csh.created_at >= c2.current_cycle_started_at
             WHERE csh.new_status_id = ?
               AND c2.current_cycle_started_at IS NOT NULL
           ) AS sales_convs ON sales_convs.conversation_id = c.id
           LEFT JOIN quotations q_active
             ON q_active.conversation_id = c.id
            AND q_active.created_at >= c.current_cycle_started_at
         ) AS sales_amounts`,
        [ventaStatusId, ventaStatusId]
      );

      ventasStats = (ventasRows as any[])[0] || ventasStats;
      montoStats = (montoRows as any[])[0] || montoStats;
    }


    // Base stats
    const stats = {
      ...base,
      ...(rows2 as any[])[0],
      ...(rows3 as any[])[0],
      ...(rows4 as any[])[0],
      ...ventasStats,
      ...montoStats,
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
