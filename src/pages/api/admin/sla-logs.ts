import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';

export const GET: APIRoute = async ({ url, locals }) => {
    try {
        const user = (locals as any).user;
        if (!user || user.rol !== 'ADMIN') {
            return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const conversacionId = url.searchParams.get('conversacion_id');

        let query = `
            SELECT 
                l.*,
                c.wa_user,
                c.wa_profile_name
            FROM sla_notification_log l
            LEFT JOIN conversaciones c ON l.conversacion_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (conversacionId) {
            query += ' AND l.conversacion_id = ?';
            params.push(conversacionId);
        }

        query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(query, params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM sla_notification_log WHERE 1=1';
        const countParams: any[] = [];
        if (conversacionId) {
            countQuery += ' AND conversacion_id = ?';
            countParams.push(conversacionId);
        }
        const [countResult] = await pool.query<any[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        return new Response(JSON.stringify({
            ok: true,
            logs: rows,
            total,
            limit,
            offset
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Error obteniendo logs SLA:', err);
        return new Response(JSON.stringify({
            ok: false,
            error: err?.message || 'Error del servidor'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
