import type { APIRoute } from 'astro';
import { pool } from '../../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * GET /api/admin/reports/sales
 * Parámetros query:
 *  - startDate: YYYY-MM-DD
 *  - endDate: YYYY-MM-DD
 *  - agentId: number (opcional)
 */
export const GET: APIRoute = async ({ request, locals, url }) => {
    const user = (locals as any).user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
    }

    try {
        const startDate = url.searchParams.get('startDate'); // YYYY-MM-DD
        const endDate = url.searchParams.get('endDate');     // YYYY-MM-DD
        const agentId = url.searchParams.get('agentId');     // optional

        // Query base: obtener ciclos completados en el rango
        // cycle_data contiene el JSON con sale_amount
        let query = `
      SELECT 
        cc.cycle_number,
        cc.completed_at,
        cc.assigned_to,
        u.nombre as agent_name,
        cs.name as status_name,
        cc.cycle_data
      FROM conversation_cycles cc
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

        // Procesar resultados para extraer ventas
        // Estructura esperada de cycle_data: { sale_amount: 123.45, notes: "..." }
        const items = rows.map(r => {
            let data = {};
            try {
                data = typeof r.cycle_data === 'string' ? JSON.parse(r.cycle_data) : r.cycle_data;
            } catch { }

            const amount = data && (data as any).sale_amount ? Number((data as any).sale_amount) : 0;

            return {
                agent_name: r.agent_name || 'Sin asignar',
                completed_at: r.completed_at,
                status_name: r.status_name,
                amount,
                has_sale: amount > 0
            };
        });

        // Calcular totales por agente
        const salesByAgent: Record<string, { total: number, count: number, name: string }> = {};
        let totalRevenue = 0;
        let totalSalesCount = 0;

        items.forEach(item => {
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
            items, // Lista detallada
            summary, // Resumen por agente
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
