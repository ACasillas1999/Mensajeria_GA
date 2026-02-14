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

    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const weeksParam = url.searchParams.get('weeks');
    const weeks = weeksParam ? Number(weeksParam) : NaN;
    const safeWeeks = Number.isFinite(weeks) && weeks > 0 ? Math.min(weeks, 52) : null;

    try {
        // Obtener todos los agentes
        const [agentRows] = await pool.query<RowDataPacket[]>(
            `SELECT u.id, u.nombre, u.email, u.sucursal_id, s.nombre AS sucursal 
             FROM usuarios u
             LEFT JOIN sucursales s ON s.id = u.sucursal_id
             WHERE u.rol = "agente" 
             ORDER BY u.nombre ASC`
        );

        if (agentRows.length === 0) {
            return new Response(JSON.stringify({ ok: false, error: 'No hay agentes' }), { status: 404 });
        }

        // Obtener todos los estados
        const [statusRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, is_final, is_active, display_order
       FROM conversation_statuses
       ORDER BY display_order ASC, id ASC`
        );

        // Preparar cláusulas de fecha
        let completedDateClause = '';
        let activeDateClause = '';
        const dateParams: any[] = [];

        if (startDate && endDate) {
            completedDateClause = ' AND cc.completed_at >= ? AND cc.completed_at <= ?';
            activeDateClause = ' AND c.current_cycle_started_at >= ? AND c.current_cycle_started_at <= ?';
            dateParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        } else if (safeWeeks) {
            completedDateClause = ` AND cc.completed_at >= DATE_SUB(NOW(), INTERVAL ${safeWeeks} WEEK)`;
            activeDateClause = ` AND c.current_cycle_started_at >= DATE_SUB(NOW(), INTERVAL ${safeWeeks} WEEK)`;
        }

        const agentSummaries = [];

        // Para cada agente, calcular sus métricas
        for (const agent of agentRows) {
            const agentId = agent.id;
            const completedParams = [agentId, ...dateParams];
            const activeParams = [agentId, ...dateParams];

            // Ciclos completados
            const [completedCycles] = await pool.query<RowDataPacket[]>(
                `SELECT
          cc.id AS cycle_id,
          cc.conversation_id,
          cc.cycle_number,
          cc.started_at,
          cc.completed_at,
          cc.cycle_data
         FROM conversation_cycles cc
         WHERE cc.assigned_to = ?
           AND cc.completed_at IS NOT NULL${completedDateClause}
         ORDER BY cc.started_at DESC`,
                completedParams
            );

            // Conversaciones activas
            const [activeConversations] = await pool.query<RowDataPacket[]>(
                `SELECT
          c.id AS conversation_id,
          c.cycle_count,
          c.current_cycle_started_at
         FROM conversaciones c
         WHERE c.asignado_a = ?
           AND c.current_cycle_started_at IS NOT NULL${activeDateClause}`,
                activeParams
            );

            // Conteos de estados para ciclos completados
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

            // Conteos de estados para conversaciones activas
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

            // Detalle de cotizaciones por ciclo completado
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

            // Detalle de cotizaciones para ciclos activos
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

            // Procesar datos del agente
            const countsByCycleId = new Map<string, Record<string, number>>();
            const quotationRowsByCycleId = new Map<string, RowDataPacket[]>();
            const quotationAmountsByCycleId = new Map<string, number>();
            const quotationCountsByCycleId = new Map<string, number>();
            const saleAmountByCycleId = new Map<string, number>();

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

            // Mapear monto vendido explicito por ciclo (si existe en cycle_data)
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
                saleAmountByCycleId.set(
                    String(cycle.cycle_id),
                    Number.isFinite(explicitSale) ? explicitSale : 0
                );
            }

            // Mapear conteos de estados completados
            for (const row of completedCounts) {
                if (!row.new_status_id) continue;
                const key = String(row.cycle_id);
                const statusKey = String(row.new_status_id);
                if (!countsByCycleId.has(key)) countsByCycleId.set(key, {});
                countsByCycleId.get(key)![statusKey] = Number(row.status_count || 0);
            }

            // Mapear conteos de estados activos
            for (const row of activeCounts) {
                if (!row.new_status_id) continue;
                const key = `active-${row.conversation_id}`;
                const statusKey = String(row.new_status_id);
                if (!countsByCycleId.has(key)) countsByCycleId.set(key, {});
                countsByCycleId.get(key)![statusKey] = Number(row.status_count || 0);
            }

            // Combinar ciclos completados y activos
            const cycles = [
                ...completedCycles.map((cycle) => ({
                    cycle_id: String(cycle.cycle_id),
                    conversation_id: cycle.conversation_id,
                    is_active: false,
                })),
                ...activeConversations.map((conv) => ({
                    cycle_id: `active-${conv.conversation_id}`,
                    conversation_id: conv.conversation_id,
                    is_active: true,
                })),
            ];

            for (const cycle of cycles) {
                const rows = quotationRowsByCycleId.get(cycle.cycle_id) || [];
                const explicitSaleAmount = saleAmountByCycleId.get(cycle.cycle_id) || 0;
                if (explicitSaleAmount > 0) {
                    // Si el ciclo ya se vendio, monto cotizado efectivo = monto vendido.
                    quotationAmountsByCycleId.set(cycle.cycle_id, explicitSaleAmount);
                    quotationCountsByCycleId.set(cycle.cycle_id, rows.length);
                    continue;
                }

                const mode: QuotationAggregationMode = cycle.is_active
                    ? 'latest_by_number'
                    : 'latest_overall';
                const aggregated = aggregateQuotationRows(rows, mode);
                quotationAmountsByCycleId.set(cycle.cycle_id, aggregated.amount);
                quotationCountsByCycleId.set(cycle.cycle_id, aggregated.count);
            }

            // Calcular resumen del agente
            const summaryCounts: Record<string, number> = {};
            const conversationIds = new Set<number>();
            let totalQuotationCount = 0;
            let totalQuotationAmount = 0;
            let totalSalesAmount = 0;

            for (const cycle of cycles) {
                conversationIds.add(Number(cycle.conversation_id));
                const cycleCounts = countsByCycleId.get(cycle.cycle_id) || {};
                const cycleQuotationAmount = quotationAmountsByCycleId.get(cycle.cycle_id) || 0;
                const cycleQuotationCount = quotationCountsByCycleId.get(cycle.cycle_id) || 0;

                // Sumar al total de cotizaciones
                totalQuotationCount += cycleQuotationCount;
                totalQuotationAmount += cycleQuotationAmount;

                const explicitSaleAmount = saleAmountByCycleId.get(cycle.cycle_id) || 0;
                if (explicitSaleAmount > 0) {
                    totalSalesAmount += explicitSaleAmount;
                }

                for (const [statusId, count] of Object.entries(cycleCounts)) {
                    summaryCounts[statusId] = (summaryCounts[statusId] || 0) + Number(count || 0);
                }
            }

            agentSummaries.push({
                id: agent.id,
                nombre: agent.nombre,
                email: agent.email,
                sucursal: agent.sucursal || '',
                total_conversations: conversationIds.size,
                total_cycles: cycles.length,
                status_counts: summaryCounts,
                total_quotation_count: totalQuotationCount,
                total_quotation_amount: totalQuotationAmount,
                total_sales_amount: totalSalesAmount,
            });
        }

        // Calcular totales globales
        const globalSummaryCounts: Record<string, number> = {};
        let globalTotalConversations = 0;
        let globalTotalCycles = 0;
        let globalTotalQuotationCount = 0;
        let globalTotalQuotationAmount = 0;
        let globalTotalSalesAmount = 0;

        for (const agentSummary of agentSummaries) {
            globalTotalConversations += agentSummary.total_conversations;
            globalTotalCycles += agentSummary.total_cycles;
            globalTotalQuotationCount += agentSummary.total_quotation_count;
            globalTotalQuotationAmount += agentSummary.total_quotation_amount;
            globalTotalSalesAmount += agentSummary.total_sales_amount;

            for (const [statusId, count] of Object.entries(agentSummary.status_counts)) {
                globalSummaryCounts[statusId] = (globalSummaryCounts[statusId] || 0) + count;
            }
        }

        return new Response(
            JSON.stringify({
                ok: true,
                statuses: statusRows.map((s) => ({
                    id: s.id,
                    name: s.name,
                    is_final: Boolean(s.is_final),
                    is_active: Boolean(s.is_active),
                    display_order: s.display_order ?? 0,
                })),
                agents: agentSummaries,
                global_summary: {
                    total_conversations: globalTotalConversations,
                    total_cycles: globalTotalCycles,
                    counts: globalSummaryCounts,
                    total_quotation_count: globalTotalQuotationCount,
                    total_quotation_amount: globalTotalQuotationAmount,
                    total_sales_amount: globalTotalSalesAmount,
                },
                filters: {
                    start_date: startDate || null,
                    end_date: endDate || null,
                    weeks: safeWeeks || null,
                },
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (e: any) {
        console.error('All agents status audit error:', e);
        return new Response(
            JSON.stringify({ ok: false, error: e?.message || 'Error' }),
            { status: 500 }
        );
    }
};
