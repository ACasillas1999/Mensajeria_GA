import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * GET /api/quotations/by-cycle?conversacion_id=123
 * Obtiene las cotizaciones del ciclo actual de una conversación
 */
export const GET: APIRoute = async ({ url, locals }) => {
    const user = (locals as any).user;
    if (!user) {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const conversacion_id = url.searchParams.get('conversacion_id');

        if (!conversacion_id) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'conversacion_id es requerido'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener ciclo actual de la conversación
        const [convRows] = await pool.query<RowDataPacket[]>(
            'SELECT ciclo_actual FROM conversaciones WHERE id = ?',
            [conversacion_id]
        );

        if (convRows.length === 0) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'Conversación no encontrada'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const ciclo_actual = convRows[0].ciclo_actual || 1;

        // Obtener cotizaciones del ciclo actual
        const [quotations] = await pool.query<RowDataPacket[]>(
            `SELECT q.*, u.nombre as usuario_nombre
             FROM cotizaciones q
             LEFT JOIN usuarios u ON q.usuario_id = u.id
             WHERE q.conversacion_id = ? AND q.ciclo_numero = ?
             ORDER BY q.created_at DESC`,
            [conversacion_id, ciclo_actual]
        );

        return new Response(JSON.stringify({
            ok: true,
            quotations,
            ciclo_actual
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('Error fetching quotations:', e);
        return new Response(JSON.stringify({
            ok: false,
            error: e.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
