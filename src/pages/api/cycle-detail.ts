import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import type { RowDataPacket } from 'mysql2';

/**
 * GET: Obtener detalle completo de un ciclo específico con todos sus estados intermedios
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

    const cycleId = url.searchParams.get('cycle_id');
    if (!cycleId) {
      return new Response(JSON.stringify({ ok: false, error: 'cycle_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener información básica del ciclo
    const [cycleRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id,
        cc.conversation_id,
        cc.cycle_number,
        cc.started_at,
        cc.completed_at,
        cc.duration_seconds,
        cc.total_messages,
        cc.cycle_data,
        cc.assigned_to,
        cs_initial.name AS initial_status_name,
        cs_initial.color AS initial_status_color,
        cs_initial.icon AS initial_status_icon,
        cs_final.name AS final_status_name,
        cs_final.color AS final_status_color,
        cs_final.icon AS final_status_icon,
        u.nombre AS assigned_to_name,
        c.wa_user,
        c.wa_profile_name
      FROM conversation_cycles cc
      LEFT JOIN conversation_statuses cs_initial ON cc.initial_status_id = cs_initial.id
      LEFT JOIN conversation_statuses cs_final ON cc.final_status_id = cs_final.id
      LEFT JOIN usuarios u ON cc.assigned_to = u.id
      LEFT JOIN conversaciones c ON cc.conversation_id = c.id
      WHERE cc.id = ?`,
      [cycleId]
    );

    if (cycleRows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Ciclo no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cycle = cycleRows[0];

    // Obtener todos los cambios de estado que ocurrieron durante este ciclo
    const [stateChanges] = await pool.query<RowDataPacket[]>(
      `SELECT
        csh.id,
        csh.created_at,
        csh.old_status_id,
        csh.new_status_id,
        csh.change_reason,
        csh.field_data,
        cs_old.name AS old_status_name,
        cs_old.color AS old_status_color,
        cs_old.icon AS old_status_icon,
        cs_new.name AS new_status_name,
        cs_new.color AS new_status_color,
        cs_new.icon AS new_status_icon,
        u.nombre AS changed_by_name
      FROM conversation_status_history csh
      LEFT JOIN conversation_statuses cs_old ON csh.old_status_id = cs_old.id
      LEFT JOIN conversation_statuses cs_new ON csh.new_status_id = cs_new.id
      LEFT JOIN usuarios u ON csh.changed_by = u.id
      WHERE csh.conversation_id = ?
        AND csh.created_at >= ?
        AND csh.created_at <= ?
      ORDER BY csh.created_at ASC`,
      [cycle.conversation_id, cycle.started_at, cycle.completed_at]
    );

    // Calcular duración en cada estado
    const stateTimeline = stateChanges.map((change, index) => {
      // Parsear field_data si es string
      let parsedFieldData = null;
      if (change.field_data) {
        if (typeof change.field_data === 'string') {
          try {
            parsedFieldData = JSON.parse(change.field_data);
          } catch (e) {
            console.error('Error parsing field_data:', e);
          }
        } else {
          parsedFieldData = change.field_data;
        }
      }

      // Calcular duración hasta el siguiente cambio o hasta el final del ciclo
      const startTime = new Date(change.created_at).getTime();
      const endTime = index < stateChanges.length - 1
        ? new Date(stateChanges[index + 1].created_at).getTime()
        : new Date(cycle.completed_at).getTime();

      const durationSeconds = Math.floor((endTime - startTime) / 1000);

      return {
        id: change.id,
        created_at: change.created_at,
        old_status_name: change.old_status_name,
        old_status_color: change.old_status_color,
        old_status_icon: change.old_status_icon,
        new_status_name: change.new_status_name,
        new_status_color: change.new_status_color,
        new_status_icon: change.new_status_icon,
        changed_by_name: change.changed_by_name,
        change_reason: change.change_reason,
        field_data: parsedFieldData,
        duration_seconds: durationSeconds,
        duration_formatted: formatDuration(durationSeconds),
      };
    });

    // Obtener mensajes del ciclo agrupados por estado
    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT
        m.id,
        m.creado_en,
        m.from_me,
        m.tipo,
        m.cuerpo,
        m.media_url,
        u.nombre as usuario_nombre
      FROM mensajes m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.conversacion_id = ?
        AND m.creado_en >= ?
        AND m.creado_en <= ?
      ORDER BY m.creado_en ASC`,
      [cycle.conversation_id, cycle.started_at, cycle.completed_at]
    );

    // Agrupar mensajes por estado
    const messagesPerState = stateTimeline.map((state, index) => {
      const stateStart = new Date(state.created_at).getTime();
      const stateEnd = index < stateTimeline.length - 1
        ? new Date(stateTimeline[index + 1].created_at).getTime()
        : new Date(cycle.completed_at).getTime();

      const stateMessages = messages.filter(msg => {
        const msgTime = new Date(msg.creado_en).getTime();
        return msgTime >= stateStart && msgTime < stateEnd;
      }).map(msg => ({
        id: msg.id,
        creado_en: msg.creado_en,
        from_me: msg.from_me,
        tipo: msg.tipo,
        cuerpo: msg.cuerpo,
        media_url: msg.media_url,
        usuario_nombre: msg.usuario_nombre,
      }));

      return {
        ...state,
        message_count: stateMessages.length,
        messages: stateMessages,
      };
    });

    // Parsear cycle_data
    let parsedCycleData = null;
    if (cycle.cycle_data) {
      if (typeof cycle.cycle_data === 'string') {
        try {
          parsedCycleData = JSON.parse(cycle.cycle_data);
        } catch (e) {
          console.error('Error parsing cycle_data:', e);
        }
      } else {
        parsedCycleData = cycle.cycle_data;
      }
    }

    // Obtener cotizaciones asociadas al ciclo
    const [quotations] = await pool.query<RowDataPacket[]>(
      `SELECT 
        cq.id,
        cq.cotizacion_id,
        c.numero_cotizacion,
        c.monto,
        c.created_at,
        u.nombre as usuario_nombre
      FROM cycle_quotations cq
      JOIN cotizaciones c ON cq.cotizacion_id = c.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE cq.conversacion_id = ? AND cq.ciclo_numero = ?
      ORDER BY c.created_at ASC`,
      [cycle.conversation_id, cycle.cycle_number]
    );

    return new Response(
      JSON.stringify({
        ok: true,
        cycle: {
          id: cycle.id,
          conversation_id: cycle.conversation_id,
          cycle_number: cycle.cycle_number,
          started_at: cycle.started_at,
          completed_at: cycle.completed_at,
          duration_seconds: cycle.duration_seconds,
          duration_formatted: formatDuration(cycle.duration_seconds),
          total_messages: cycle.total_messages,
          wa_user: cycle.wa_user,
          wa_profile_name: cycle.wa_profile_name,
          initial_status_name: cycle.initial_status_name,
          initial_status_color: cycle.initial_status_color,
          initial_status_icon: cycle.initial_status_icon,
          final_status_name: cycle.final_status_name,
          final_status_color: cycle.final_status_color,
          final_status_icon: cycle.final_status_icon,
          assigned_to_name: cycle.assigned_to_name,
          cycle_data: parsedCycleData,
        },
        state_timeline: messagesPerState,
        total_state_changes: stateTimeline.length,
        quotations: quotations.map(q => ({
          id: q.id,
          cotizacion_id: q.cotizacion_id,
          numero_cotizacion: q.numero_cotizacion,
          monto: q.monto,
          created_at: q.created_at,
          usuario_nombre: q.usuario_nombre
        }))
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching cycle detail:', error);
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
