import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * GET /api/quotations/by-cycle?conversacion_id=123
 * Obtiene las cotizaciones del ciclo actual de una conversacion
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

        const conversationId = Number(conversacion_id);

        const [conversationRows] = await pool.query<RowDataPacket[]>(
            `SELECT cycle_count, current_cycle_started_at
             FROM conversaciones
             WHERE id = ?
             LIMIT 1`,
            [conversationId]
        );

        if (conversationRows.length === 0) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'Conversacion no encontrada'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const conversation = conversationRows[0];
        const currentCycleNumber = Number(conversation.cycle_count || 0) + 1;

        // Intentar obtener cycle_id del ciclo activo
        const [cycleRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM conversation_cycles
             WHERE conversation_id = ?
             AND completed_at IS NULL
             ORDER BY started_at DESC
             LIMIT 1`,
            [conversationId]
        );

        let quotations: RowDataPacket[] = [];
        let cycleId: number | null = null;

        if (cycleRows.length > 0) {
            cycleId = Number(cycleRows[0].id);
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT q.id, q.conversation_id, q.cycle_id, q.quotation_number as numero_cotizacion,
                        q.amount as monto, q.file_path, q.created_at, u.nombre as usuario_nombre
                 FROM quotations q
                 LEFT JOIN usuarios u ON u.id = (SELECT usuario_id FROM mensajes WHERE id = q.mensaje_id LIMIT 1)
                 WHERE q.cycle_id = ?
                 ORDER BY q.created_at DESC`,
                [cycleId]
            );
            quotations = rows;
        } else {
            // Fallback por fecha de inicio del ciclo actual
            const startedAt = conversation.current_cycle_started_at;
            const baseQuery = `
                SELECT q.id, q.conversation_id, q.cycle_id, q.quotation_number as numero_cotizacion,
                       q.amount as monto, q.file_path, q.created_at, u.nombre as usuario_nombre
                FROM quotations q
                LEFT JOIN usuarios u ON u.id = (SELECT usuario_id FROM mensajes WHERE id = q.mensaje_id LIMIT 1)
                WHERE q.conversation_id = ?
            `;

            if (startedAt) {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `${baseQuery} AND q.created_at >= ? ORDER BY q.created_at DESC`,
                    [conversationId, startedAt]
                );
                quotations = rows;
            } else {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `${baseQuery} ORDER BY q.created_at DESC`,
                    [conversationId]
                );
                quotations = rows;
            }
        }

        return new Response(JSON.stringify({
            ok: true,
            ciclo_actual: currentCycleNumber,
            cycle_id: cycleId,
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
