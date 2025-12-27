import type { APIRoute } from 'astro';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../lib/db';

/**
 * GET: Obtener trazabilidad completa de una conversación
 * Incluye: historial de estados, asignaciones, ciclos, eventos, comentarios y métricas
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversation_id');

    if (!conversationId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'conversation_id requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Información básica de la conversación
    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.*,
        cs.name AS current_status_name,
        cs.color AS current_status_color,
        cs.icon AS current_status_icon,
        u.nombre AS assigned_to_name
      FROM conversaciones c
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      LEFT JOIN usuarios u ON c.asignado_a = u.id
      WHERE c.id = ?`,
      [conversationId]
    );

    if (convRows.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Conversación no encontrada' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conversation = convRows[0];

    // 2. Historial completo de cambios de estado con duración en cada estado
    const [statusHistory] = await pool.query<RowDataPacket[]>(
      `SELECT
        csh.id,
        csh.conversation_id,
        csh.old_status_id,
        csh.new_status_id,
        csh.changed_by_user_id,
        csh.field_data,
        csh.changed_at,
        UNIX_TIMESTAMP(csh.changed_at) AS ts,
        old_status.name AS old_status_name,
        old_status.color AS old_status_color,
        old_status.icon AS old_status_icon,
        new_status.name AS new_status_name,
        new_status.color AS new_status_color,
        new_status.icon AS new_status_icon,
        u.nombre AS changed_by_name,
        -- Calcular duración en el estado anterior (tiempo hasta el siguiente cambio)
        TIMESTAMPDIFF(SECOND,
          LAG(csh.changed_at) OVER (ORDER BY csh.changed_at),
          csh.changed_at
        ) AS duration_in_previous_state_seconds
      FROM conversation_status_history csh
      LEFT JOIN conversation_statuses old_status ON csh.old_status_id = old_status.id
      LEFT JOIN conversation_statuses new_status ON csh.new_status_id = new_status.id
      LEFT JOIN usuarios u ON csh.changed_by_user_id = u.id
      WHERE csh.conversation_id = ?
      ORDER BY csh.changed_at ASC`,
      [conversationId]
    );

    // 3. Historial de asignaciones
    const [assignmentHistory] = await pool.query<RowDataPacket[]>(
      `SELECT
        ce.id,
        ce.conversacion_id,
        ce.tipo,
        ce.usuario_id,
        ce.texto,
        ce.evento_data,
        ce.creado_en,
        UNIX_TIMESTAMP(ce.creado_en) AS ts,
        u.nombre AS usuario_nombre
      FROM conversation_events ce
      LEFT JOIN usuarios u ON ce.usuario_id = u.id
      WHERE ce.conversacion_id = ?
        AND ce.tipo IN ('asignacion', 'reasignacion')
      ORDER BY ce.creado_en ASC`,
      [conversationId]
    );

    // 4. Historial de ciclos completados
    const [cycles] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id,
        cc.conversation_id,
        cc.cycle_number,
        cc.started_at,
        cc.completed_at,
        cc.initial_status_id,
        cc.final_status_id,
        cc.assigned_to_user_id,
        cc.total_messages,
        cc.cycle_data,
        TIMESTAMPDIFF(SECOND, cc.started_at, cc.completed_at) AS duration_seconds,
        initial_status.name AS initial_status_name,
        initial_status.color AS initial_status_color,
        initial_status.icon AS initial_status_icon,
        final_status.name AS final_status_name,
        final_status.color AS final_status_color,
        final_status.icon AS final_status_icon,
        u.nombre AS assigned_to_name
      FROM conversation_cycles cc
      LEFT JOIN conversation_statuses initial_status ON cc.initial_status_id = initial_status.id
      LEFT JOIN conversation_statuses final_status ON cc.final_status_id = final_status.id
      LEFT JOIN usuarios u ON cc.assigned_to_user_id = u.id
      WHERE cc.conversation_id = ?
      ORDER BY cc.cycle_number ASC`,
      [conversationId]
    );

    // 5. Todos los eventos del sistema
    const [events] = await pool.query<RowDataPacket[]>(
      `SELECT
        ce.id,
        ce.conversacion_id,
        ce.tipo,
        ce.usuario_id,
        ce.texto,
        ce.evento_data,
        ce.creado_en,
        UNIX_TIMESTAMP(ce.creado_en) AS ts,
        u.nombre AS usuario_nombre
      FROM conversation_events ce
      LEFT JOIN usuarios u ON ce.usuario_id = u.id
      WHERE ce.conversacion_id = ?
      ORDER BY ce.creado_en ASC`,
      [conversationId]
    );

    // 6. Comentarios internos
    const [comments] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id,
        c.conversacion_id,
        c.usuario_id,
        c.comentario,
        c.creado_en,
        UNIX_TIMESTAMP(c.creado_en) AS ts,
        u.nombre AS usuario_nombre
      FROM comentarios_internos c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.conversacion_id = ?
      ORDER BY c.creado_en ASC`,
      [conversationId]
    );

    // 7. Calcular métricas de rendimiento
    const metrics = calculateMetrics(conversation, statusHistory, cycles);

    return new Response(
      JSON.stringify({
        ok: true,
        conversation,
        statusHistory,
        assignmentHistory,
        cycles,
        events,
        comments,
        metrics,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching conversation trace:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Calcular métricas de rendimiento de la conversación
 */
function calculateMetrics(conversation: any, statusHistory: any[], cycles: any[]) {
  const now = new Date();
  const createdAt = new Date(conversation.creado_en);

  // Tiempo total desde creación
  const totalLifetimeSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

  // Tiempo en estado actual
  let currentStateDurationSeconds = 0;
  if (statusHistory.length > 0) {
    const lastChange = new Date(statusHistory[statusHistory.length - 1].changed_at);
    currentStateDurationSeconds = Math.floor((now.getTime() - lastChange.getTime()) / 1000);
  } else {
    currentStateDurationSeconds = totalLifetimeSeconds;
  }

  // Tiempo promedio por estado
  const timeByStatus: Record<string, { totalSeconds: number; count: number; name: string; color: string }> = {};

  statusHistory.forEach((change, index) => {
    const statusId = change.new_status_id;
    const statusName = change.new_status_name;
    const statusColor = change.new_status_color;

    if (!timeByStatus[statusId]) {
      timeByStatus[statusId] = { totalSeconds: 0, count: 0, name: statusName, color: statusColor };
    }

    // Calcular duración en este estado
    let duration = 0;
    if (index < statusHistory.length - 1) {
      // Hay un siguiente cambio
      const nextChange = statusHistory[index + 1];
      const currentTime = new Date(change.changed_at).getTime();
      const nextTime = new Date(nextChange.changed_at).getTime();
      duration = Math.floor((nextTime - currentTime) / 1000);
    } else {
      // Es el último cambio, usar tiempo hasta ahora
      duration = currentStateDurationSeconds;
    }

    timeByStatus[statusId].totalSeconds += duration;
    timeByStatus[statusId].count += 1;
  });

  // Convertir a array y calcular promedios
  const statusMetrics = Object.entries(timeByStatus).map(([statusId, data]) => ({
    statusId: Number(statusId),
    statusName: data.name,
    statusColor: data.color,
    totalSeconds: data.totalSeconds,
    averageSeconds: Math.floor(data.totalSeconds / data.count),
    count: data.count,
    percentage: totalLifetimeSeconds > 0 ? (data.totalSeconds / totalLifetimeSeconds) * 100 : 0,
  }));

  // Métricas de ciclos
  const totalCycles = cycles.length;
  const avgCycleDuration = totalCycles > 0
    ? Math.floor(cycles.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / totalCycles)
    : 0;
  const avgMessagesPerCycle = totalCycles > 0
    ? Math.floor(cycles.reduce((sum, c) => sum + (c.total_messages || 0), 0) / totalCycles)
    : 0;

  // Número de cambios de estado
  const totalStatusChanges = statusHistory.length;

  // Número de reasignaciones
  const totalReassignments = statusHistory.filter(h =>
    h.old_status_id && h.new_status_id && h.old_status_id !== h.new_status_id
  ).length;

  return {
    totalLifetimeSeconds,
    totalLifetimeFormatted: formatDuration(totalLifetimeSeconds),
    currentStateDurationSeconds,
    currentStateDurationFormatted: formatDuration(currentStateDurationSeconds),
    totalStatusChanges,
    totalReassignments,
    statusMetrics: statusMetrics.sort((a, b) => b.totalSeconds - a.totalSeconds),
    cycles: {
      total: totalCycles,
      avgDuration: avgCycleDuration,
      avgDurationFormatted: formatDuration(avgCycleDuration),
      avgMessages: avgMessagesPerCycle,
    },
  };
}

/**
 * Formatear duración en formato legible
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}
