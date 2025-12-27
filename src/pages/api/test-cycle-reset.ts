import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Endpoint temporal para probar el reset de ciclos manualmente
 * Uso: GET /api/test-cycle-reset?conversation_id=31
 */
export const GET: APIRoute = async ({ request, locals, url }) => {
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
      return new Response(
        JSON.stringify({ ok: false, error: 'conversation_id requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const convId = Number(conversationId);

    // Obtener información de la conversación y su estado actual
    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id,
        c.status_id,
        c.cycle_count,
        c.current_cycle_started_at,
        c.asignado_a,
        cs.is_final,
        cs.auto_reset_to_status_id,
        cs.name as status_name
      FROM conversaciones c
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      WHERE c.id = ?`,
      [convId]
    );

    if (convRows.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Conversación no encontrada' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conv = convRows[0];

    // Si no está en estado final, advertir
    if (!conv.is_final) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `La conversación no está en estado final. Estado actual: ${conv.status_name}`,
          suggestion: 'Cambia la conversación al estado "Test" (id=8) primero'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Test Cycle Reset] Conversación ${convId} en estado final "${conv.status_name}", completando ciclo...`);

    // Obtener el último field_data del estado actual
    const [lastHistoryRows] = await pool.query<RowDataPacket[]>(
      `SELECT field_data
       FROM conversation_status_history
       WHERE conversation_id = ? AND new_status_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [convId, conv.status_id]
    );

    const cycleData = lastHistoryRows.length > 0 && lastHistoryRows[0].field_data
      ? lastHistoryRows[0].field_data
      : null;

    // Contar mensajes del ciclo actual
    const [msgCountRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM mensajes
       WHERE conversacion_id = ?
         AND creado_en >= ?`,
      [convId, conv.current_cycle_started_at || new Date()]
    );

    const totalMessages = msgCountRows[0]?.total || 0;

    // 1. Guardar el ciclo completado en conversation_cycles
    const newCycleNumber = (conv.cycle_count || 0) + 1;

    await pool.query(
      `INSERT INTO conversation_cycles
       (conversation_id, cycle_number, started_at, completed_at,
        initial_status_id, final_status_id, total_messages, assigned_to, cycle_data)
       VALUES (?, ?, ?, NOW(), NULL, ?, ?, ?, ?)`,
      [
        convId,
        newCycleNumber,
        conv.current_cycle_started_at || new Date(),
        conv.status_id,
        totalMessages,
        conv.asignado_a || null,
        cycleData
      ]
    );

    console.log(`[Test Cycle Reset] Ciclo #${newCycleNumber} guardado con ${totalMessages} mensajes`);

    // 2. Determinar estado de reset
    let resetStatusId = conv.auto_reset_to_status_id;

    // Si no hay auto_reset_to_status_id, usar el estado por defecto
    if (!resetStatusId) {
      const [defaultStatusRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM conversation_statuses
         WHERE is_default = TRUE AND is_active = TRUE
         LIMIT 1`
      );

      if (defaultStatusRows.length === 0) {
        // Si no hay estado default, usar el primero activo
        const [firstStatusRows] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM conversation_statuses
           WHERE is_active = TRUE
           ORDER BY display_order ASC
           LIMIT 1`
        );
        resetStatusId = firstStatusRows[0]?.id || conv.status_id;
      } else {
        resetStatusId = defaultStatusRows[0].id;
      }
    }

    // 3. Resetear la conversación al nuevo ciclo
    await pool.query(
      `UPDATE conversaciones
       SET status_id = ?,
           cycle_count = ?,
           current_cycle_started_at = NOW()
       WHERE id = ?`,
      [resetStatusId, newCycleNumber, convId]
    );

    // 4. Registrar el cambio de estado en el historial
    await pool.query(
      `INSERT INTO conversation_status_history
       (conversation_id, old_status_id, new_status_id, changed_by, change_reason)
       VALUES (?, ?, ?, ?, 'Ciclo completado - Reset automático (TEST MANUAL)')`,
      [convId, conv.status_id, resetStatusId, user.id]
    );

    // 5. Registrar evento del sistema
    const [newStatusRows] = await pool.query<RowDataPacket[]>(
      `SELECT name, icon FROM conversation_statuses WHERE id = ?`,
      [resetStatusId]
    );

    const newStatusName = newStatusRows[0]?.name || 'Nuevo';
    const newStatusIcon = newStatusRows[0]?.icon || '🔄';

    await pool.query(
      `INSERT INTO conversation_events
       (conversacion_id, tipo, texto, evento_data)
       VALUES (?, 'cambio_estado', ?, ?)`,
      [
        convId,
        `🔄 Ciclo #${newCycleNumber} completado - Estado reseteado a ${newStatusIcon} ${newStatusName}`,
        JSON.stringify({
          cycle_number: newCycleNumber,
          old_status_id: conv.status_id,
          new_status_id: resetStatusId,
          reason: 'TEST MANUAL - Simulación de mensaje de cliente'
        })
      ]
    );

    console.log(`[Test Cycle Reset] Conversación ${convId} reseteada a estado "${newStatusName}" (ciclo #${newCycleNumber})`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Ciclo completado exitosamente`,
        details: {
          cycle_number: newCycleNumber,
          old_status: conv.status_name,
          new_status: newStatusName,
          total_messages: totalMessages,
          conversation_id: convId
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Test Cycle Reset] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
