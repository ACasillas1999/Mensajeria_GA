import type { APIRoute } from 'astro';
import { pool } from '../../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * GET /api/admin/reports/sales
 * Query params:
 *  - startDate: YYYY-MM-DD
 *  - endDate: YYYY-MM-DD
 *  - agentId: number (optional)
 */
export const GET: APIRoute = async ({ locals, url }) => {
    const user = (locals as any).user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
    }

    try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const agentId = url.searchParams.get('agentId');

        let query = `
      SELECT
        cc.cycle_number,
        cc.completed_at,
        cc.assigned_to,
        u.nombre as agent_name,
        cs.name as status_name,
        cc.cycle_data,
        c.wa_user,
        c.wa_profile_name
      FROM conversation_cycles cc
      LEFT JOIN conversaciones c ON cc.conversation_id = c.id
      LEFT JOIN usuarios u ON cc.assigned_to = u.id
      LEFT JOIN conversation_statuses cs ON cc.final_status_id = cs.id
      WHERE 1=1
    `;

        const params: any[] = [];

        if (startDate) {
            query += ` AND cc.completed_at >= ?`;
            params.push(`${startDate} 00:00:00`);
        }

        if (endDate) {
            query += ` AND cc.completed_at <= ?`;
            params.push(`${endDate} 23:59:59`);
        }

        if (agentId) {
            query += ` AND cc.assigned_to = ?`;
            params.push(agentId);
        }

        query += ` ORDER BY cc.completed_at DESC`;

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        const winningQuoteIds = new Set<number>();
        const parsedRows = rows.map((r) => {
            let data: any = {};
            try {
                data = typeof r.cycle_data === 'string' ? JSON.parse(r.cycle_data) : (r.cycle_data || {});
            } catch {
                data = {};
            }

            const winningQuoteId = data?.winning_quotation_id ? Number(data.winning_quotation_id) : null;
            if (winningQuoteId && Number.isInteger(winningQuoteId)) {
                winningQuoteIds.add(winningQuoteId);
            }

            return {
                row: r,
                cycleData: data,
                winningQuoteId,
            };
        });

        const quotationMap = new Map<number, { id: number; quotation_number: string; amount: number }>();
        if (winningQuoteIds.size > 0) {
            const ids = Array.from(winningQuoteIds);
            const placeholders = ids.map(() => '?').join(',');
            const [quotationRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, quotation_number, amount
                 FROM quotations
                 WHERE id IN (${placeholders})`,
                ids
            );

            quotationRows.forEach((q) => {
                quotationMap.set(Number(q.id), {
                    id: Number(q.id),
                    quotation_number: String(q.quotation_number || ''),
                    amount: Number(q.amount || 0),
                });
            });
        }

        const items = parsedRows.map(({ row, cycleData, winningQuoteId }) => {
            const saleAmount = cycleData?.sale_amount ? Number(cycleData.sale_amount) : 0;
            const selectedQuotation = winningQuoteId ? quotationMap.get(winningQuoteId) : null;
            const amount = selectedQuotation ? Number(selectedQuotation.amount) : saleAmount;

            return {
                agent_name: row.agent_name || 'Sin asignar',
                completed_at: row.completed_at,
                status_name: row.status_name,
                cycle_number: row.cycle_number,
                client_name: row.wa_profile_name || 'Desconocido',
                client_phone: row.wa_user,
                amount,
                has_sale: amount > 0,
                winning_quotation_id: selectedQuotation ? selectedQuotation.id : null,
                winning_quotation_number: selectedQuotation ? selectedQuotation.quotation_number : (cycleData?.winning_quotation_number || null),
            };
        });

        const salesByAgent: Record<string, { total: number; count: number; name: string }> = {};
        let totalRevenue = 0;
        let totalSalesCount = 0;

        items.forEach((item) => {
            if (item.has_sale) {
                if (!salesByAgent[item.agent_name]) {
                    salesByAgent[item.agent_name] = { total: 0, count: 0, name: item.agent_name };
                }
                salesByAgent[item.agent_name].total += item.amount;
                salesByAgent[item.agent_name].count += 1;
                totalRevenue += item.amount;
                totalSalesCount += 1;
            }
        });

        const summary = Object.values(salesByAgent).sort((a, b) => b.total - a.total);

        return new Response(JSON.stringify({
            ok: true,
            items,
            summary,
            totals: {
                revenue: totalRevenue,
                count: totalSalesCount
            }
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e: any) {
        console.error(e);
        return new Response(JSON.stringify({ ok: false, error: e.message || 'Error' }), { status: 500 });
    }
};
