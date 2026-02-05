import type { APIRoute } from 'astro';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../../lib/db';

export const GET: APIRoute = async ({ locals, url }) => {
  const user = (locals as any).user as { rol: string } | undefined;
  if (!user || String(user.rol).toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
  }

  const agentIdParam = url.searchParams.get('agent_id');
  const agentId = Number(agentIdParam);
  if (!agentIdParam || Number.isNaN(agentId)) {
    return new Response(JSON.stringify({ ok: false, error: 'agent_id requerido' }), { status: 400 });
  }

  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const weeksParam = url.searchParams.get('weeks');
  const weeks = weeksParam ? Number(weeksParam) : NaN;
  const safeWeeks = Number.isFinite(weeks) && weeks > 0 ? Math.min(weeks, 52) : null;

  try {
    const [agentRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, nombre, email FROM usuarios WHERE id = ? LIMIT 1',
      [agentId]
    );

    if (agentRows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Agente no encontrado' }), { status: 404 });
    }

    const [statusRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, is_final, is_active, display_order
       FROM conversation_statuses
       ORDER BY display_order ASC, id ASC`
    );

    let completedDateClause = '';
    let activeDateClause = '';
    const completedParams: any[] = [agentId];
    const activeParams: any[] = [agentId];

    if (startDate && endDate) {
      completedDateClause = ' AND cc.completed_at >= ? AND cc.completed_at <= ?';
      activeDateClause = ' AND c.current_cycle_started_at >= ? AND c.current_cycle_started_at <= ?';
      completedParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      activeParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    } else if (safeWeeks) {
      completedDateClause = ` AND cc.completed_at >= DATE_SUB(NOW(), INTERVAL ${safeWeeks} WEEK)`;
      activeDateClause = ` AND c.current_cycle_started_at >= DATE_SUB(NOW(), INTERVAL ${safeWeeks} WEEK)`;
    }

    const [completedCycles] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id AS cycle_id,
        cc.conversation_id,
        cc.cycle_number,
        cc.started_at,
        cc.completed_at,
        cc.cycle_data,
        c.wa_user,
        c.wa_profile_name
       FROM conversation_cycles cc
       LEFT JOIN conversaciones c ON c.id = cc.conversation_id
       WHERE cc.assigned_to = ?
         AND cc.completed_at IS NOT NULL${completedDateClause}
       ORDER BY cc.started_at DESC`,
      completedParams
    );

    const [activeConversations] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id AS conversation_id,
        c.cycle_count,
        c.current_cycle_started_at,
        c.wa_user,
        c.wa_profile_name
       FROM conversaciones c
       WHERE c.asignado_a = ?
         AND c.current_cycle_started_at IS NOT NULL${activeDateClause}`,
      activeParams
    );

    const [completedCounts] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id AS cycle_id,
        csh.new_status_id,
        COUNT(*) AS status_count
       FROM conversation_cycles cc
       JOIN conversation_status_history csh
         ON csh.conversation_id = cc.conversation_id
        AND csh.created_at >= cc.started_at
        AND csh.created_at <= cc.completed_at
       WHERE cc.assigned_to = ?${completedDateClause}
       GROUP BY cc.id, csh.new_status_id`,
      completedParams
    );

    const [activeCounts] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id AS conversation_id,
        csh.new_status_id,
        COUNT(*) AS status_count
       FROM conversaciones c
       JOIN conversation_status_history csh
         ON csh.conversation_id = c.id
        AND csh.created_at >= c.current_cycle_started_at
       WHERE c.asignado_a = ?
         AND c.current_cycle_started_at IS NOT NULL${activeDateClause}
       GROUP BY c.id, csh.new_status_id`,
      activeParams
    );

    // Obtener montos de cotizaciones por ciclo
    const [quotationAmounts] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id AS cycle_id,
        COALESCE(SUM(q.amount), 0) AS total_amount
       FROM conversation_cycles cc
       LEFT JOIN quotations q ON q.cycle_id = cc.id
       WHERE cc.assigned_to = ?${completedDateClause}
       GROUP BY cc.id`,
      completedParams
    );

    // Obtener montos de cotizaciones para ciclos activos
    const [activeQuotationAmounts] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id AS conversation_id,
        COALESCE(SUM(q.amount), 0) AS total_amount
       FROM conversaciones c
       LEFT JOIN quotations q ON q.conversation_id = c.id
         AND q.created_at >= c.current_cycle_started_at
       WHERE c.asignado_a = ?
         AND c.current_cycle_started_at IS NOT NULL${activeDateClause}
       GROUP BY c.id`,
      activeParams
    );

    const countsByCycleId = new Map<string, Record<string, number>>();
    const quotationAmountsByCycleId = new Map<string, number>();

    // Mapear montos de cotizaciones completadas
    for (const row of quotationAmounts) {
      const key = String(row.cycle_id);
      quotationAmountsByCycleId.set(key, Number(row.total_amount || 0));
    }

    // Mapear montos de cotizaciones activas
    for (const row of activeQuotationAmounts) {
      const key = `active-${row.conversation_id}`;
      quotationAmountsByCycleId.set(key, Number(row.total_amount || 0));
    }

    for (const row of completedCounts) {
      if (!row.new_status_id) continue;
      const key = String(row.cycle_id);
      const statusKey = String(row.new_status_id);
      if (!countsByCycleId.has(key)) countsByCycleId.set(key, {});
      countsByCycleId.get(key)![statusKey] = Number(row.status_count || 0);
    }

    for (const row of activeCounts) {
      if (!row.new_status_id) continue;
      const key = `active-${row.conversation_id}`;
      const statusKey = String(row.new_status_id);
      if (!countsByCycleId.has(key)) countsByCycleId.set(key, {});
      countsByCycleId.get(key)![statusKey] = Number(row.status_count || 0);
    }

    // Helper function to extract invoice number from cycle_data
    function extractInvoiceNumber(cycleData: any): string | null {
      if (!cycleData) return null;
      try {
        const data = typeof cycleData === 'string' ? JSON.parse(cycleData) : cycleData;
        if (data.notes && typeof data.notes === 'string') {
          const match = data.notes.match(/Factura:\s*(.+)/i);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
      return null;
    }

    // Helper function to extract sale amount from cycle_data
    function extractSaleAmount(cycleData: any): number {
      if (!cycleData) return 0;
      try {
        const data = typeof cycleData === 'string' ? JSON.parse(cycleData) : cycleData;
        return Number(data.sale_amount || 0);
      } catch (e) {
        // Ignore parse errors
        return 0;
      }
    }

    const cycles = [
      ...completedCycles.map((cycle) => ({
        cycle_id: String(cycle.cycle_id),
        conversation_id: cycle.conversation_id,
        cycle_number: cycle.cycle_number,
        started_at: cycle.started_at,
        completed_at: cycle.completed_at,
        is_active: false,
        wa_user: cycle.wa_user,
        wa_profile_name: cycle.wa_profile_name,
        cycle_data: cycle.cycle_data,
      })),
      ...activeConversations.map((conv) => ({
        cycle_id: `active-${conv.conversation_id}`,
        conversation_id: conv.conversation_id,
        cycle_number: Number(conv.cycle_count || 0) + 1,
        started_at: conv.current_cycle_started_at,
        completed_at: null,
        is_active: true,
        wa_user: conv.wa_user,
        wa_profile_name: conv.wa_profile_name,
        cycle_data: null,
      })),
    ].sort((a, b) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
      return bTime - aTime;
    });

    const summaryCounts: Record<string, number> = {};
    const conversationIds = new Set<number>();
    let totalQuotationAmount = 0;
    let totalSalesAmount = 0;
    const invoiceNumbers: string[] = [];

    // Obtener el ID del status "venta" (no "ventaa")
    const ventaStatus = statusRows.find(s => s.name === 'venta');
    const ventaStatusId = ventaStatus ? String(ventaStatus.id) : null;

    for (const cycle of cycles) {
      conversationIds.add(Number(cycle.conversation_id));
      const cycleCounts = countsByCycleId.get(cycle.cycle_id) || {};
      const cycleQuotationAmount = quotationAmountsByCycleId.get(cycle.cycle_id) || 0;

      // Sumar al total de cotizaciones
      totalQuotationAmount += cycleQuotationAmount;

      // Si el ciclo tiene status "venta", sumar al total de ventas y extraer factura
      if (ventaStatusId && cycleCounts[ventaStatusId] > 0) {
        // Usar sale_amount del cycle_data en lugar de quotation amount
        const saleAmount = extractSaleAmount(cycle.cycle_data);
        totalSalesAmount += saleAmount;

        const invoiceNumber = extractInvoiceNumber(cycle.cycle_data);
        if (invoiceNumber) {
          invoiceNumbers.push(invoiceNumber);
        }
      }

      for (const [statusId, count] of Object.entries(cycleCounts)) {
        summaryCounts[statusId] = (summaryCounts[statusId] || 0) + Number(count || 0);
      }
    }

    const cyclesWithCounts = cycles.map((cycle) => {
      const cycleCounts = countsByCycleId.get(cycle.cycle_id) || {};
      const cycleQuotationAmount = quotationAmountsByCycleId.get(cycle.cycle_id) || 0;

      // Si el ciclo tiene status "venta", usar sale_amount en lugar de quotation amount
      let displayAmount = cycleQuotationAmount;
      if (ventaStatusId && cycleCounts[ventaStatusId] > 0) {
        const saleAmount = extractSaleAmount(cycle.cycle_data);
        if (saleAmount > 0) {
          displayAmount = saleAmount;
        }
      }

      return {
        ...cycle,
        counts: cycleCounts,
        quotation_amount: displayAmount,
        invoice_number: extractInvoiceNumber(cycle.cycle_data),
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        agent: {
          id: agentRows[0].id,
          nombre: agentRows[0].nombre,
          email: agentRows[0].email,
        },
        statuses: statusRows.map((s) => ({
          id: s.id,
          name: s.name,
          is_final: Boolean(s.is_final),
          is_active: Boolean(s.is_active),
          display_order: s.display_order ?? 0,
        })),
        summary: {
          total_conversations: conversationIds.size,
          total_cycles: cycles.length,
          counts: summaryCounts,
          total_quotation_amount: totalQuotationAmount,
          total_sales_amount: totalSalesAmount,
          invoice_numbers: invoiceNumbers,
        },
        cycles: cyclesWithCounts,
        filters: {
          start_date: startDate || null,
          end_date: endDate || null,
          weeks: safeWeeks || null,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Agent status audit error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || 'Error' }),
      { status: 500 }
    );
  }
};
