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

        // Obtener el cycle_id del ciclo activo actual
        const [cycleRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM conversation_cycles 
             WHERE conversation_id = ? 
             AND completed_at IS NULL 
             ORDER BY started_at DESC 
             LIMIT 1`,
            [conversacion_id]
        );

        if (cycleRows.length === 0) {
            // No hay ciclo activo, retornar vacío
            return new Response(JSON.stringify({
                ok: true,
                quotations: []
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const cycle_id = cycleRows[0].id;

        // Obtener cotizaciones del ciclo actual usando la tabla correcta 'quotations'
        const [quotations] = await pool.query<RowDataPacket[]>(
            `SELECT q.id, q.conversation_id, q.cycle_id, q.quotation_number as numero_cotizacion, 
                    q.amount as monto, q.file_path, q.created_at, u.nombre as usuario_nombre
             FROM quotations q
             LEFT JOIN usuarios u ON u.id = (SELECT usuario_id FROM mensajes WHERE id = q.mensaje_id LIMIT 1)
             WHERE q.cycle_id = ?
             ORDER BY q.created_at DESC`,
            [cycle_id]
        );

        return new Response(JSON.stringify({
            ok: true,
            quotations
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
