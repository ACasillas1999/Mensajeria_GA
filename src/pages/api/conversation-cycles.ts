import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import type { RowDataPacket } from 'mysql2';

/**
 * GET: Obtener historial de ciclos completados de una conversación
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const user = locals?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conversationId = url.searchParams.get('conversation_id');
    if (!conversationId) {
      return new Response(JSON.stringify({ ok: false, error: 'conversation_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener historial de ciclos completados
    const [cycles] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id,
        cc.cycle_number,
        cc.started_at,
        cc.completed_at,
        cc.duration_seconds,
        cc.total_messages,
        cc.cycle_data,
        cs_initial.name AS initial_status_name,
        cs_initial.color AS initial_status_color,
        cs_final.name AS final_status_name,
        cs_final.color AS final_status_color,
        u.nombre AS assigned_to_name
      FROM conversation_cycles cc
      LEFT JOIN conversation_statuses cs_initial ON cc.initial_status_id = cs_initial.id
      LEFT JOIN conversation_statuses cs_final ON cc.final_status_id = cs_final.id
      LEFT JOIN usuarios u ON cc.assigned_to = u.id
      WHERE cc.conversation_id = ?
      ORDER BY cc.cycle_number DESC`,
      [conversationId]
    );

    // Obtener información de la conversación actual
    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id,
        c.wa_user,
        c.wa_profile_name,
        c.cycle_count,
        c.current_cycle_started_at,
        cs.name AS current_status_name,
        cs.color AS current_status_color
      FROM conversaciones c
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      WHERE c.id = ?`,
      [conversationId]
    );

    if (convRows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Conversación no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conversation = convRows[0];

    // Calcular duración del ciclo actual
    const currentCycleDuration = conversation.current_cycle_started_at
      ? Math.floor((Date.now() - new Date(conversation.current_cycle_started_at).getTime()) / 1000)
      : 0;

    // Estadísticas
    const totalCycles = cycles.length;
    const avgDuration = totalCycles > 0
      ? Math.floor(cycles.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / totalCycles)
      : 0;
    const avgMessages = totalCycles > 0
      ? Math.floor(cycles.reduce((sum, c) => sum + (c.total_messages || 0), 0) / totalCycles)
      : 0;

    return new Response(
      JSON.stringify({
        ok: true,
        conversation: {
          id: conversation.id,
          wa_user: conversation.wa_user,
          wa_profile_name: conversation.wa_profile_name,
          cycle_count: conversation.cycle_count,
          current_status_name: conversation.current_status_name,
          current_status_color: conversation.current_status_color,
          current_cycle_started_at: conversation.current_cycle_started_at,
          current_cycle_duration_seconds: currentCycleDuration,
        },
        cycles: cycles.map(c => ({
          id: c.id,
          cycle_number: c.cycle_number,
          started_at: c.started_at,
          completed_at: c.completed_at,
          duration_seconds: c.duration_seconds,
          duration_formatted: formatDuration(c.duration_seconds),
          total_messages: c.total_messages,
          initial_status_name: c.initial_status_name,
          initial_status_color: c.initial_status_color,
          final_status_name: c.final_status_name,
          final_status_color: c.final_status_color,
          assigned_to_name: c.assigned_to_name,
          cycle_data: c.cycle_data ? JSON.parse(c.cycle_data as string) : null,
        })),
        stats: {
          total_cycles: totalCycles,
          avg_duration_seconds: avgDuration,
          avg_duration_formatted: formatDuration(avgDuration),
          avg_messages: avgMessages,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching conversation cycles:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * Helper para formatear duración en segundos a formato legible
 */
function formatDuration(seconds: number | null): string {
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
