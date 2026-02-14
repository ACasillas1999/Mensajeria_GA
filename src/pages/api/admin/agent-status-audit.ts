import type { APIRoute } from 'astro';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../../lib/db';

type QuotationAggregationMode = 'sum_all' | 'latest_by_number' | 'latest_overall';

function aggregateQuotationRows(rows: RowDataPacket[], mode: QuotationAggregationMode) {
  const toAmount = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const toTime = (value: any) => {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  if (mode === 'sum_all') {
    return {
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + toAmount(row.amount), 0),
    };
  }

  if (mode === 'latest_overall') {
    let latestRow: RowDataPacket | null = null;
    for (const row of rows) {
      if (!latestRow) {
        latestRow = row;
        continue;
      }
      const currentTime = toTime(row.created_at);
      const latestTime = toTime(latestRow.created_at);
      if (
        currentTime > latestTime ||
        (currentTime === latestTime && Number(row.quotation_id || 0) > Number(latestRow.quotation_id || 0))
      ) {
        latestRow = row;
      }
    }

    if (!latestRow) {
      return { count: 0, amount: 0 };
    }

    return { count: 1, amount: toAmount(latestRow.amount) };
  }

  const latestByNumber = new Map<string, RowDataPacket>();
  for (const row of rows) {
    const quotationNumber = String(row.quotation_number || '').trim();
    const key = quotationNumber || `__id_${row.quotation_id}`;
    const previous = latestByNumber.get(key);
    if (!previous) {
      latestByNumber.set(key, row);
      continue;
    }

    const currentTime = toTime(row.created_at);
    const previousTime = toTime(previous.created_at);
    if (
      currentTime > previousTime ||
      (currentTime === previousTime && Number(row.quotation_id || 0) > Number(previous.quotation_id || 0))
    ) {
      latestByNumber.set(key, row);
    }
  }

  const dedupedRows = Array.from(latestByNumber.values());
  return {
    count: dedupedRows.length,
    amount: dedupedRows.reduce((sum, row) => sum + toAmount(row.amount), 0),
  };
}

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

    // Obtener detalle de cotizaciones por ciclo completado
    const [completedQuotationRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id AS cycle_id,
        cc.conversation_id,
        q.id AS quotation_id,
        q.quotation_number,
        q.amount,
        q.created_at
       FROM conversation_cycles cc
       JOIN quotations q ON q.cycle_id = cc.id
       WHERE cc.assigned_to = ?${completedDateClause}`,
      completedParams
    );

    // Obtener detalle de cotizaciones para ciclos activos
    const [activeQuotationRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id AS conversation_id,
        q.id AS quotation_id,
        q.quotation_number,
        q.amount,
        q.created_at
       FROM conversaciones c
       JOIN quotations q ON q.conversation_id = c.id
         AND q.created_at >= c.current_cycle_started_at
       WHERE c.asignado_a = ?
         AND c.current_cycle_started_at IS NOT NULL${activeDateClause}`,
      activeParams
    );

    const countsByCycleId = new Map<string, Record<string, number>>();
    const quotationRowsByCycleId = new Map<string, RowDataPacket[]>();
    const quotationAmountsByCycleId = new Map<string, number>();

    const activeStartByConversation = new Map<number, number>();
    for (const conv of activeConversations) {
      const startedAt = new Date(conv.current_cycle_started_at).getTime();
      activeStartByConversation.set(
        Number(conv.conversation_id),
        Number.isFinite(startedAt) ? startedAt : 0
      );
    }

    const completedQuotationIds = new Set<number>();
    for (const row of completedQuotationRows) {
      const activeStartedAt = activeStartByConversation.get(Number(row.conversation_id));
      const quotationTime = new Date(row.created_at).getTime();
      if (activeStartedAt && Number.isFinite(quotationTime) && quotationTime >= activeStartedAt) {
        // Cotizacion historicamente mal asociada al ciclo anterior; se tratara como activa.
        continue;
      }

      const key = String(row.cycle_id);
      completedQuotationIds.add(Number(row.quotation_id));
      if (!quotationRowsByCycleId.has(key)) quotationRowsByCycleId.set(key, []);
      quotationRowsByCycleId.get(key)!.push(row);
    }

    for (const row of activeQuotationRows) {
      if (completedQuotationIds.has(Number(row.quotation_id))) continue;
      const key = `active-${row.conversation_id}`;
      if (!quotationRowsByCycleId.has(key)) quotationRowsByCycleId.set(key, []);
      quotationRowsByCycleId.get(key)!.push(row);
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

    const saleAmountByCycleId = new Map<string, number>();
    for (const cycle of completedCycles) {
      let cycleData: any = null;
      try {
        cycleData = typeof cycle.cycle_data === 'string'
          ? JSON.parse(cycle.cycle_data)
          : cycle.cycle_data;
      } catch {
        cycleData = null;
      }

      const explicitSale = Number(
        cycleData?.winning_quotation_amount ??
        cycleData?.sale_amount ??
        0
      );
      saleAmountByCycleId.set(String(cycle.cycle_id), Number.isFinite(explicitSale) ? explicitSale : 0);
    }

    // Calcular monto cotizado por ciclo aplicando regla:
    // - Ciclos activos o no vendidos: deduplicar por quotation_number y tomar solo la mas reciente
    // - Ciclos con venta: sumar todas las cotizaciones del ciclo
    for (const cycle of cycles) {
      const rows = quotationRowsByCycleId.get(cycle.cycle_id) || [];
      const explicitSaleAmount = saleAmountByCycleId.get(cycle.cycle_id) || 0;
      if (explicitSaleAmount > 0) {
        // Si el ciclo ya se vendio, monto cotizado efectivo = monto vendido.
        quotationAmountsByCycleId.set(cycle.cycle_id, explicitSaleAmount);
        continue;
      }

      const mode: QuotationAggregationMode = cycle.is_active ? 'latest_by_number' : 'latest_overall';
      const aggregated = aggregateQuotationRows(rows, mode);
      quotationAmountsByCycleId.set(cycle.cycle_id, aggregated.amount);
    }

    for (const cycle of cycles) {
      conversationIds.add(Number(cycle.conversation_id));
      const cycleCounts = countsByCycleId.get(cycle.cycle_id) || {};
      const cycleQuotationAmount = quotationAmountsByCycleId.get(cycle.cycle_id) || 0;

      // Sumar al total de cotizaciones
      totalQuotationAmount += cycleQuotationAmount;

      const explicitSaleAmount = saleAmountByCycleId.get(cycle.cycle_id) || 0;
      if (explicitSaleAmount > 0) {
        totalSalesAmount += explicitSaleAmount;
      }

      for (const [statusId, count] of Object.entries(cycleCounts)) {
        summaryCounts[statusId] = (summaryCounts[statusId] || 0) + Number(count || 0);
      }
    }

    const cyclesWithCounts = cycles.map((cycle) => ({
      ...cycle,
      counts: countsByCycleId.get(cycle.cycle_id) || {},
      quotation_amount: quotationAmountsByCycleId.get(cycle.cycle_id) || 0,
    }));

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
