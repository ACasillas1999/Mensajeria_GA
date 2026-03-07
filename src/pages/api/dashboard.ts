import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type DateFilter = {
  clause: string;
  params: Array<string | number>;
};

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const user = (locals as any).user as { id: number, rol: string } | undefined;
    if (!user) return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });

    const myId = user.id;
    const daysParam = url.searchParams.get("days");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    const hasCustomRange = Boolean(
      startDate &&
      endDate &&
      ISO_DATE_RE.test(startDate) &&
      ISO_DATE_RE.test(endDate)
    );

    const parsedDays = Number.parseInt(daysParam ?? "30", 10);
    const safeDays = Number.isFinite(parsedDays) && parsedDays > 0
      ? Math.min(parsedDays, 365)
      : 30;

    const startDateTime = hasCustomRange ? `${startDate} 00:00:00` : "";
    const endDateTime = hasCustomRange ? `${endDate} 23:59:59` : "";

    const buildDateFilter = (column: string): DateFilter => {
      if (hasCustomRange) {
        return {
          clause: `${column} BETWEEN ? AND ?`,
          params: [startDateTime, endDateTime]
        };
      }
      return {
        clause: `${column} >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
        params: [safeDays]
      };
    };

    const conversationFilter = buildDateFilter("creado_en");
    const statusHistoryFilter = buildDateFilter("csh.created_at");
    const messageFilter = buildDateFilter("COALESCE(creado_en, FROM_UNIXTIME(ts))");
    const completedCyclesFilter = buildDateFilter("cc.completed_at");
    const activeCyclesFilter = buildDateFilter("c.current_cycle_started_at");
    const completedCyclesFilter2 = buildDateFilter("cc2.completed_at");
    const activeCyclesFilter2 = buildDateFilter("c2.current_cycle_started_at");
    const seriesConversationFilter = buildDateFilter("creado_en");
    const seriesMessageFilter = buildDateFilter("COALESCE(creado_en, FROM_UNIXTIME(ts))");

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*)                                     AS total_conversaciones,
         SUM(asignado_a IS NULL)                      AS sin_asignar,
         SUM(asignado_a = ?)                          AS mine_total,
         SUM(DATE(creado_en) = CURDATE())             AS conversaciones_hoy
       FROM conversaciones
       WHERE ${conversationFilter.clause}`,
      [myId, ...conversationFilter.params]
    );

    const base = (rows as any[])[0] || {};

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
         AND ${statusHistoryFilter.clause}
       LEFT JOIN conversaciones c ON c.id = csh.conversation_id
       WHERE cs.is_active = TRUE
       GROUP BY cs.id, cs.name, cs.color, cs.icon
       ORDER BY cs.display_order`,
      [myId, ...statusHistoryFilter.params]
    );

    base.statuses = statusRows;

    const [rows2] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS mensajes_total,
         SUM(DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) = CURDATE()) AS mensajes_hoy
       FROM mensajes
       WHERE ${messageFilter.clause}`,
      [...messageFilter.params]
    );

    const [rows3] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS agentes_activos
       FROM usuarios
       WHERE activo = 1 AND UPPER(rol) IN ('AGENTE', 'ADMIN')`
    );

    const [rows4] = await pool.query<RowDataPacket[]>(
      `SELECT
         (
           SELECT COUNT(q.id)
           FROM conversation_cycles cc
           LEFT JOIN quotations q ON q.cycle_id = cc.id
           WHERE cc.completed_at IS NOT NULL
             AND ${completedCyclesFilter.clause}
         ) +
         (
           SELECT COUNT(q2.id)
           FROM conversaciones c
           LEFT JOIN quotations q2 ON q2.conversation_id = c.id
             AND q2.created_at >= c.current_cycle_started_at
           WHERE c.current_cycle_started_at IS NOT NULL
             AND ${activeCyclesFilter.clause}
         ) AS cotizaciones_total,
         (
           SELECT COUNT(q3.id)
           FROM quotations q3
           WHERE DATE(q3.created_at) = CURDATE()
         ) AS cotizaciones_hoy,
         (
           SELECT COALESCE(SUM(
             CASE
               WHEN COALESCE(
                 CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cc2.cycle_data, '$.winning_quotation_amount')), '') AS DECIMAL(12,2)),
                 CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cc2.cycle_data, '$.sale_amount')), '') AS DECIMAL(12,2)),
                 0
               ) > 0
               THEN COALESCE(
                 CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cc2.cycle_data, '$.winning_quotation_amount')), '') AS DECIMAL(12,2)),
                 CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cc2.cycle_data, '$.sale_amount')), '') AS DECIMAL(12,2)),
                 0
               )
               ELSE COALESCE(
                 (
                   SELECT q4.amount
                   FROM quotations q4
                   WHERE q4.cycle_id = cc2.id
                   ORDER BY q4.created_at DESC, q4.id DESC
                   LIMIT 1
                 ),
                 0
               )
             END
           ), 0)
           FROM conversation_cycles cc2
           WHERE cc2.completed_at IS NOT NULL
             AND ${completedCyclesFilter2.clause}
         ) +
         (
           SELECT COALESCE(SUM(
             COALESCE(
               (
                 SELECT q5.amount
                 FROM quotations q5
                 WHERE q5.conversation_id = c2.id
                   AND q5.created_at >= c2.current_cycle_started_at
                 ORDER BY q5.created_at DESC, q5.id DESC
                 LIMIT 1
               ),
               0
             )
           ), 0)
           FROM conversaciones c2
           WHERE c2.current_cycle_started_at IS NOT NULL
             AND ${activeCyclesFilter2.clause}
         ) AS monto_total_cotizado,
         (
           SELECT COALESCE(SUM(q6.amount), 0)
           FROM quotations q6
           WHERE DATE(q6.created_at) = CURDATE()
         ) AS monto_cotizado_hoy`,
      [
        ...completedCyclesFilter.params,
        ...activeCyclesFilter.params,
        ...completedCyclesFilter2.params,
        ...activeCyclesFilter2.params,
      ]
    );

    const saleAmountExpr = `
      COALESCE(
        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cc.cycle_data, '$.winning_quotation_amount')), '') AS DECIMAL(12,2)),
        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cc.cycle_data, '$.sale_amount')), '') AS DECIMAL(12,2)),
        0
      )
    `;

    const [salesRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(CASE WHEN ${saleAmountExpr} > 0 THEN 1 END) AS ventas_total,
         COUNT(CASE WHEN ${saleAmountExpr} > 0 AND DATE(cc.completed_at) = CURDATE() THEN 1 END) AS ventas_hoy,
         COALESCE(SUM(CASE WHEN ${saleAmountExpr} > 0 THEN ${saleAmountExpr} ELSE 0 END), 0) AS monto_total_ventas
       FROM conversation_cycles cc
       WHERE cc.completed_at IS NOT NULL
         AND ${completedCyclesFilter.clause}`,
      [...completedCyclesFilter.params]
    );

    const salesStats = (salesRows as any[])[0] || {
      ventas_total: 0,
      ventas_hoy: 0,
      monto_total_ventas: 0,
    };

    const stats = {
      ...base,
      ...(rows2 as any[])[0],
      ...(rows3 as any[])[0],
      ...(rows4 as any[])[0],
      ...salesStats,
    } as Record<string, number>;

    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(creado_en) AS d, COUNT(*) AS c
       FROM conversaciones
       WHERE ${seriesConversationFilter.clause}
       GROUP BY d
       ORDER BY d`,
      [...seriesConversationFilter.params]
    );

    const [msgRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS d, COUNT(*) AS c
       FROM mensajes
       WHERE ${seriesMessageFilter.clause}
       GROUP BY d
       ORDER BY d`,
      [...seriesMessageFilter.params]
    );

    const payload = {
      ok: true,
      stats: {
        ...stats,
        conv_series: (convRows as any[]).map(r => ({ day: r.d, count: Number(r.c) })),
        msg_series: (msgRows as any[]).map(r => ({ day: r.d, count: Number(r.c) })),
      }
    };

    return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Error" }), { status: 500 });
  }
};
