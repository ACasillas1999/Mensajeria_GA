import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

/**
 * API avanzada de analytics para el dashboard
 * Retorna métricas detalladas de rendimiento de agentes, tiempos de respuesta, etc.
 * Acepta parámetros de rango de fecha: ?days=30 o ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const user = (locals as any).user as { id: number, rol: string } | undefined;
    if (!user) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });

    const isAdmin = String(user.rol).toLowerCase() === 'admin';

    // Obtener parámetros de fecha del query string
    const days = url.searchParams.get('days');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Construir condición de fecha dinámica
    let dateFilter = '';
    let messageDateFilter = '';
    let cyclesDateFilter = '';
    let hourlyDateFilter = '';
    let dailyDateFilter = '';

    if (startDate && endDate) {
      // Rango personalizado
      dateFilter = `>= '${startDate}' AND c.creado_en <= '${endDate} 23:59:59'`;
      messageDateFilter = `>= '${startDate}' AND m.creado_en <= '${endDate} 23:59:59'`;
      cyclesDateFilter = `>= '${startDate}' AND cc.completed_at <= '${endDate} 23:59:59'`;
      hourlyDateFilter = `>= '${startDate}' AND COALESCE(creado_en, FROM_UNIXTIME(ts)) <= '${endDate} 23:59:59'`;
      dailyDateFilter = `>= '${startDate}' AND c.creado_en <= '${endDate} 23:59:59'`;
    } else {
      // Usar días (por defecto 30)
      const numDays = days || '30';
      dateFilter = `>= DATE_SUB(CURDATE(), INTERVAL ${numDays} DAY)`;
      messageDateFilter = `>= DATE_SUB(CURDATE(), INTERVAL ${numDays} DAY)`;
      cyclesDateFilter = `>= DATE_SUB(CURDATE(), INTERVAL ${numDays} DAY)`;
      hourlyDateFilter = `>= DATE_SUB(CURDATE(), INTERVAL ${numDays} DAY)`;
      dailyDateFilter = `>= DATE_SUB(CURDATE(), INTERVAL ${numDays} DAY)`;
    }

    // 1. Tiempo promedio de primera respuesta por agente
    const [responseTimeRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        u.id,
        u.nombre AS agent_name,
        COUNT(DISTINCT c.id) AS total_conversations,
        AVG(TIMESTAMPDIFF(SECOND, c.creado_en, first_response.ts)) AS avg_response_time_seconds,
        MIN(TIMESTAMPDIFF(SECOND, c.creado_en, first_response.ts)) AS min_response_time_seconds,
        MAX(TIMESTAMPDIFF(SECOND, c.creado_en, first_response.ts)) AS max_response_time_seconds
      FROM usuarios u
      INNER JOIN conversaciones c ON c.asignado_a = u.id
      INNER JOIN (
        SELECT
          conversacion_id,
          MIN(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS ts
        FROM mensajes
        WHERE from_me = 1
        GROUP BY conversacion_id
      ) AS first_response ON first_response.conversacion_id = c.id
      WHERE u.activo = 1
        AND u.rol = 'AGENTE'
        AND c.creado_en ${dateFilter}
      GROUP BY u.id, u.nombre
      ORDER BY avg_response_time_seconds ASC`
    );

    // 2. Rendimiento por agente
    const [agentPerformanceRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        u.id,
        u.nombre AS agent_name,
        COUNT(DISTINCT c.id) AS conversations_handled,
        COUNT(DISTINCT CASE WHEN cs.is_final = TRUE THEN c.id END) AS conversations_resolved,
        COUNT(m.id) AS messages_sent,
        COUNT(DISTINCT cc.id) AS cycles_completed
      FROM usuarios u
      LEFT JOIN conversaciones c ON c.asignado_a = u.id
        AND c.creado_en ${dateFilter}
      LEFT JOIN mensajes m ON m.usuario_id = u.id
        AND m.from_me = 1
        AND m.creado_en ${messageDateFilter}
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      LEFT JOIN conversation_cycles cc ON cc.assigned_to = u.id
        AND cc.completed_at ${cyclesDateFilter}
      WHERE u.activo = 1 AND u.rol = 'AGENTE'
      GROUP BY u.id, u.nombre
      ORDER BY conversations_handled DESC`
    );

    // 3. Distribución de carga actual (conversaciones activas por agente)
    const [workloadRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        u.id,
        u.nombre AS agent_name,
        COUNT(c.id) AS active_conversations,
        COUNT(CASE WHEN cs.is_final = FALSE THEN c.id END) AS open_conversations
      FROM usuarios u
      LEFT JOIN conversaciones c ON c.asignado_a = u.id
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      WHERE u.activo = 1 AND u.rol = 'AGENTE'
      GROUP BY u.id, u.nombre
      ORDER BY active_conversations DESC`
    );

    // 4. Mensajes por hora del día - Para identificar horarios pico
    const [hourlyActivityRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        HOUR(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS hour,
        COUNT(*) AS message_count
      FROM mensajes
      WHERE COALESCE(creado_en, FROM_UNIXTIME(ts)) ${hourlyDateFilter}
      GROUP BY hour
      ORDER BY hour`
    );

    // 5. Tasa de resolución global (DESHABILITADA - no se usa en el frontend)
    // const [resolutionRateRows] = await pool.query<RowDataPacket[]>(
    //   `SELECT
    //     COUNT(*) AS total_conversations,
    //     COUNT(CASE WHEN cs.is_final = TRUE THEN 1 END) AS resolved_conversations,
    //     COUNT(CASE WHEN cs.is_final = FALSE THEN 1 END) AS open_conversations,
    //     ROUND(COUNT(CASE WHEN cs.is_final = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) AS resolution_rate
    //   FROM conversaciones c
    //   LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
    //   WHERE c.creado_en ${dateFilter}`
    // );

    // 6. Estadísticas de ciclos
    const [cycleStatsRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(*) AS total_cycles,
        AVG(duration_seconds) AS avg_duration_seconds,
        AVG(total_messages) AS avg_messages_per_cycle,
        MIN(duration_seconds) AS min_duration_seconds,
        MAX(duration_seconds) AS max_duration_seconds
      FROM conversation_cycles
      WHERE completed_at ${cyclesDateFilter}`
    );

    // 7. Conversaciones por fuente/canal (si aplica)
    const [channelStatsRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        'WhatsApp' AS channel,
        COUNT(*) AS conversation_count
      FROM conversaciones
      WHERE creado_en ${dateFilter}`
    );

    // 8. Top 5 conversaciones más largas (por mensajes)
    const [topConversationsRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id,
        c.wa_profile_name,
        c.wa_user,
        COUNT(m.id) AS message_count,
        u.nombre AS assigned_agent
      FROM conversaciones c
      LEFT JOIN mensajes m ON m.conversacion_id = c.id
      LEFT JOIN usuarios u ON u.id = c.asignado_a
      WHERE c.creado_en ${dateFilter}
      GROUP BY c.id, c.wa_profile_name, c.wa_user, u.nombre
      ORDER BY message_count DESC
      LIMIT 5`
    );

    // 9. Actividad diaria - Para gráfica de tendencia
    const [dailyActivityRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        DATE(c.creado_en) AS day,
        COUNT(DISTINCT c.id) AS conversations,
        COUNT(m.id) AS messages
      FROM conversaciones c
      LEFT JOIN mensajes m ON m.conversacion_id = c.id
        AND DATE(COALESCE(m.creado_en, FROM_UNIXTIME(m.ts))) = DATE(c.creado_en)
      WHERE c.creado_en ${dailyDateFilter}
      GROUP BY day
      ORDER BY day DESC`
    );

    // 10. Métricas de satisfacción (basado en reacciones de clientes)
    const [satisfactionRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(DISTINCT conversacion_id) AS conversations_with_reactions,
        SUM(CASE WHEN client_reaction_emoji IN ('👍', '❤️', '😊', '🙏', '✅') THEN 1 ELSE 0 END) AS positive_reactions,
        SUM(CASE WHEN client_reaction_emoji IN ('👎', '😡', '😞', '💢') THEN 1 ELSE 0 END) AS negative_reactions,
        COUNT(client_reaction_emoji) AS total_reactions
      FROM mensajes
      WHERE client_reaction_emoji IS NOT NULL
        AND COALESCE(creado_en, FROM_UNIXTIME(ts)) ${hourlyDateFilter}`
    );

    const result = {
      ok: true,
      analytics: {
        // Tiempo de respuesta
        response_times: responseTimeRows.map(r => ({
          agent_id: r.id,
          agent_name: r.agent_name,
          total_conversations: r.total_conversations,
          avg_response_time_seconds: Math.round(r.avg_response_time_seconds || 0),
          min_response_time_seconds: Math.round(r.min_response_time_seconds || 0),
          max_response_time_seconds: Math.round(r.max_response_time_seconds || 0),
          avg_response_time_formatted: formatDuration(Math.round(r.avg_response_time_seconds || 0))
        })),

        // Rendimiento de agentes
        agent_performance: agentPerformanceRows.map(r => ({
          agent_id: r.id,
          agent_name: r.agent_name,
          conversations_handled: r.conversations_handled,
          conversations_resolved: r.conversations_resolved,
          messages_sent: r.messages_sent,
          cycles_completed: r.cycles_completed,
          resolution_rate: r.conversations_handled > 0
            ? Math.round((r.conversations_resolved / r.conversations_handled) * 100)
            : 0
        })),

        // Carga de trabajo actual
        workload: workloadRows.map(r => ({
          agent_id: r.id,
          agent_name: r.agent_name,
          active_conversations: r.active_conversations,
          open_conversations: r.open_conversations
        })),

        // Actividad por hora
        hourly_activity: hourlyActivityRows.map(r => ({
          hour: r.hour,
          message_count: r.message_count
        })),

        // Tasa de resolución (DESHABILITADA)
        // resolution_rate: resolutionRateRows[0] ? {
        //   total_conversations: resolutionRateRows[0].total_conversations,
        //   resolved_conversations: resolutionRateRows[0].resolved_conversations,
        //   open_conversations: resolutionRateRows[0].open_conversations,
        //   resolution_rate: resolutionRateRows[0].resolution_rate
        // } : null,

        // Estadísticas de ciclos
        cycle_stats: cycleStatsRows[0] ? {
          total_cycles: cycleStatsRows[0].total_cycles,
          avg_duration_seconds: Math.round(cycleStatsRows[0].avg_duration_seconds || 0),
          avg_duration_formatted: formatDuration(Math.round(cycleStatsRows[0].avg_duration_seconds || 0)),
          avg_messages_per_cycle: Math.round(cycleStatsRows[0].avg_messages_per_cycle || 0),
          min_duration_seconds: cycleStatsRows[0].min_duration_seconds,
          max_duration_seconds: cycleStatsRows[0].max_duration_seconds
        } : null,

        // Canales
        channels: channelStatsRows.map(r => ({
          channel: r.channel,
          conversation_count: r.conversation_count
        })),

        // Top conversaciones
        top_conversations: topConversationsRows.map(r => ({
          id: r.id,
          wa_profile_name: r.wa_profile_name,
          wa_user: r.wa_user,
          message_count: r.message_count,
          assigned_agent: r.assigned_agent
        })),

        // Actividad diaria
        daily_activity: dailyActivityRows.map(r => ({
          day: r.day,
          conversations: r.conversations,
          messages: r.messages
        })),

        // Satisfacción
        satisfaction: satisfactionRows[0] ? {
          conversations_with_reactions: satisfactionRows[0].conversations_with_reactions,
          positive_reactions: satisfactionRows[0].positive_reactions,
          negative_reactions: satisfactionRows[0].negative_reactions,
          total_reactions: satisfactionRows[0].total_reactions,
          satisfaction_rate: satisfactionRows[0].total_reactions > 0
            ? Math.round((satisfactionRows[0].positive_reactions / satisfactionRows[0].total_reactions) * 100)
            : 0
        } : null
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('Dashboard Analytics Error:', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Error' }), { status: 500 });
  }
};

/**
 * Helper para formatear duración en segundos a formato legible
 */
function formatDuration(seconds: number): string {
  if (!seconds) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
