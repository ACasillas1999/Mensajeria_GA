import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * POST /api/quotations/create
 * Crea una nueva cotización asociada a una conversación
 */
export const POST: APIRoute = async ({ request, locals }) => {
    const user = (locals as any).user;
    if (!user) {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { conversacion_id, numero_cotizacion, monto, mensaje_id, archivo_url } = body;

        // Validaciones
        if (!conversacion_id || !numero_cotizacion || !monto) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'Faltan campos requeridos: conversacion_id, numero_cotizacion, monto'
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

        // Insertar cotización
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO cotizaciones 
             (conversacion_id, ciclo_numero, numero_cotizacion, monto, mensaje_id, archivo_url, usuario_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [conversacion_id, ciclo_actual, numero_cotizacion, monto, mensaje_id || null, archivo_url || null, user.id]
        );

        // Obtener la cotización creada
        const [newQuotation] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM cotizaciones WHERE id = ?',
            [result.insertId]
        );

        return new Response(JSON.stringify({
            ok: true,
            quotation: newQuotation[0]
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('Error creating quotation:', e);
        return new Response(JSON.stringify({
            ok: false,
            error: e.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
