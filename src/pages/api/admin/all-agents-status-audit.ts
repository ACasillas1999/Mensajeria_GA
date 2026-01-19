import type { APIRoute } from 'astro';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../../lib/db';

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

        // Obtener el ID del status "venta"
        const ventaStatus = statusRows.find(s => s.name === 'venta');
        const ventaStatusId = ventaStatus ? String(ventaStatus.id) : null;

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
          cc.completed_at
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

            // Montos y conteo de cotizaciones por ciclo completado
            const [quotationAmounts] = await pool.query<RowDataPacket[]>(
                `SELECT
          cc.id AS cycle_id,
          COUNT(q.id) AS quotation_count,
          COALESCE(SUM(q.amount), 0) AS total_amount
         FROM conversation_cycles cc
         LEFT JOIN quotations q ON q.cycle_id = cc.id
         WHERE cc.assigned_to = ?${completedDateClause}
         GROUP BY cc.id`,
                completedParams
            );

            // Montos y conteo de cotizaciones para ciclos activos
            const [activeQuotationAmounts] = await pool.query<RowDataPacket[]>(
                `SELECT
          c.id AS conversation_id,
          COUNT(q.id) AS quotation_count,
          COALESCE(SUM(q.amount), 0) AS total_amount
         FROM conversaciones c
         LEFT JOIN quotations q ON q.conversation_id = c.id
           AND q.created_at >= c.current_cycle_started_at
         WHERE c.asignado_a = ?
           AND c.current_cycle_started_at IS NOT NULL${activeDateClause}
         GROUP BY c.id`,
                activeParams
            );

            // Procesar datos del agente
            const countsByCycleId = new Map<string, Record<string, number>>();
            const quotationAmountsByCycleId = new Map<string, number>();
            const quotationCountsByCycleId = new Map<string, number>();

            // Mapear montos y conteos de cotizaciones completadas
            for (const row of quotationAmounts) {
                const key = String(row.cycle_id);
                quotationAmountsByCycleId.set(key, Number(row.total_amount || 0));
                quotationCountsByCycleId.set(key, Number(row.quotation_count || 0));
            }

            // Mapear montos y conteos de cotizaciones activas
            for (const row of activeQuotationAmounts) {
                const key = `active-${row.conversation_id}`;
                quotationAmountsByCycleId.set(key, Number(row.total_amount || 0));
                quotationCountsByCycleId.set(key, Number(row.quotation_count || 0));
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

                // Si el ciclo tiene status "venta", sumar al total de ventas
                if (ventaStatusId && cycleCounts[ventaStatusId] > 0) {
                    totalSalesAmount += cycleQuotationAmount;
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
