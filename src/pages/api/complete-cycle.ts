import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * POST /api/complete-cycle
 * Permite al agente completar manualmente un ciclo de conversacion
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { conversacion_id, reason, final_status_id, amount, cycle_notes, quotation_id } = body;

    if (!conversacion_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'conversacion_id requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const convId = Number(conversacion_id);
    const finalStatusInput = final_status_id ? Number(final_status_id) : null;

    if (final_status_id && !Number.isFinite(finalStatusInput)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'final_status_id invalido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let parsedAmount: number | null = null;
    if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
      parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'amount invalido' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    let parsedQuotationId: number | null = null;
    if (quotation_id !== undefined && quotation_id !== null && String(quotation_id).trim() !== '') {
      parsedQuotationId = Number(quotation_id);
      if (!Number.isInteger(parsedQuotationId) || parsedQuotationId <= 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'quotation_id invalido' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Obtener informacion de la conversacion actual
    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id,
        c.status_id,
        c.cycle_count,
        c.current_cycle_started_at,
        c.asignado_a,
        cs.auto_reset_to_status_id,
        cs.name as status_name
      FROM conversaciones c
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      WHERE c.id = ?`,
      [convId]
    );

    if (convRows.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Conversacion no encontrada' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conv = convRows[0];

    let selectedQuotation: RowDataPacket | null = null;
    if (parsedQuotationId) {
      const [quotationRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, conversation_id, quotation_number, amount
         FROM quotations
         WHERE id = ?
         LIMIT 1`,
        [parsedQuotationId]
      );

      if (quotationRows.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'La cotizacion seleccionada no existe' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const quotation = quotationRows[0];
      if (Number(quotation.conversation_id) !== convId) {
        return new Response(
          JSON.stringify({ ok: false, error: 'La cotizacion no pertenece a esta conversacion' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      selectedQuotation = quotation;
    }

    console.log(`[Complete Cycle] Agente ${user.nombre} completando ciclo de conversacion ${convId}...`);

    // Prepare cycle data
    const cycleDataObj: any = {};

    const saleAmount = selectedQuotation
      ? Number(selectedQuotation.amount)
      : parsedAmount;

    if (saleAmount !== null && Number.isFinite(saleAmount)) {
      cycleDataObj.sale_amount = saleAmount;
    }

    if (cycle_notes) cycleDataObj.notes = cycle_notes;

    if (selectedQuotation) {
      cycleDataObj.winning_quotation_id = Number(selectedQuotation.id);
      cycleDataObj.winning_quotation_number = selectedQuotation.quotation_number;
      cycleDataObj.winning_quotation_amount = Number(selectedQuotation.amount);
    }

    // Si se especifico un estado final explicito, usarlo. Si no, usar el actual.
    const finalStatusToRecord = finalStatusInput || conv.status_id;

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
    const completedAt = new Date();

    await pool.query(
      `INSERT INTO conversation_cycles
       (conversation_id, cycle_number, started_at, completed_at, initial_status_id, final_status_id, total_messages, assigned_to, cycle_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        convId,
        newCycleNumber,
        conv.current_cycle_started_at || new Date(),
        completedAt,
        null,
        finalStatusToRecord,
        totalMessages,
        conv.asignado_a || null,
        JSON.stringify(cycleDataObj)
      ]
    );

    console.log(`[Complete Cycle] Ciclo #${newCycleNumber} guardado. Monto: ${saleAmount ?? 'N/A'}`);

    // 2. Determinar estado de reset
    let resetStatusId = conv.auto_reset_to_status_id;

    // Si no hay auto_reset_to_status_id, usar el estado por defecto o el primero
    if (!resetStatusId) {
      const [defaultStatusRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM conversation_statuses
         WHERE is_default = TRUE AND is_active = TRUE
         LIMIT 1`
      );

      if (defaultStatusRows.length === 0) {
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

    // 3. Resetear la conversacion: cambiar estado, incrementar ciclo, reiniciar fecha
    await pool.query(
      `UPDATE conversaciones
       SET status_id = ?,
           cycle_count = ?,
           ciclo_actual = ciclo_actual + 1,
           current_cycle_started_at = NOW()
       WHERE id = ?`,
      [resetStatusId, newCycleNumber, convId]
    );

    // 4. Registrar historial de cambio de estado
    if (finalStatusInput && finalStatusInput !== Number(conv.status_id)) {
      await pool.query(
        `INSERT INTO conversation_status_history
         (conversation_id, old_status_id, new_status_id, changed_by, change_reason)
         VALUES (?, ?, ?, ?, ?)`,
        [
          convId,
          conv.status_id,
          finalStatusInput,
          user.id,
          reason || `Ciclo completado como venta. Monto: ${saleAmount || 0}`
        ]
      );
    }

    await pool.query(
      `INSERT INTO conversation_status_history
       (conversation_id, old_status_id, new_status_id, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?)`,
      [
        convId,
        finalStatusInput || conv.status_id,
        resetStatusId,
        user.id,
        reason || `Ciclo completado. Conversacion reseteada.`
      ]
    );

    // 5. Registrar evento del sistema
    const [newStatusRows] = await pool.query<RowDataPacket[]>(
      `SELECT name, icon FROM conversation_statuses WHERE id = ?`,
      [resetStatusId]
    );

    const newStatusName = newStatusRows[0]?.name || 'Nuevo';
    const newStatusIcon = newStatusRows[0]?.icon || '[reset]';

    let eventText = `Ciclo #${newCycleNumber} completado por ${user.nombre}`;
    if (saleAmount !== null && Number.isFinite(saleAmount)) {
      eventText += ` (Venta: $${saleAmount})`;
    }
    if (selectedQuotation) {
      eventText += ` usando cotizacion ${selectedQuotation.quotation_number}`;
    }
    eventText += ` - Conversacion reseteada a ${newStatusIcon} ${newStatusName} (agente asignado: ${conv.asignado_a ? 'mantenido' : 'ninguno'})`;

    await pool.query(
      `INSERT INTO conversation_events
       (conversacion_id, tipo, texto, evento_data)
       VALUES (?, 'cambio_estado', ?, ?)`,
      [
        convId,
        eventText,
        JSON.stringify({
          cycle_number: newCycleNumber,
          old_status_id: conv.status_id,
          final_status_id: finalStatusToRecord,
          new_status_id: resetStatusId,
          completed_by: user.id,
          amount: saleAmount,
          notes: cycle_notes,
          quotation_id: selectedQuotation ? Number(selectedQuotation.id) : null,
          quotation_number: selectedQuotation ? selectedQuotation.quotation_number : null,
          agent_kept_assigned: conv.asignado_a !== null
        })
      ]
    );

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Ciclo #${newCycleNumber} completado exitosamente`,
        cycle_number: newCycleNumber,
        sale_amount: saleAmount,
        winning_quotation: selectedQuotation
          ? {
              id: Number(selectedQuotation.id),
              quotation_number: selectedQuotation.quotation_number,
              amount: Number(selectedQuotation.amount)
            }
          : null,
        new_status: {
          id: resetStatusId,
          name: newStatusName,
          icon: newStatusIcon
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Complete Cycle] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
