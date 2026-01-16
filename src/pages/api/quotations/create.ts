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

        // Obtener el cycle_id actual de la conversación
        // Primero intentar obtener un ciclo activo
        const [activeCycleRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM conversation_cycles 
             WHERE conversation_id = ? 
             AND completed_at IS NULL 
             ORDER BY started_at DESC 
             LIMIT 1`,
            [conversacion_id]
        );

        let cycle_id = activeCycleRows.length > 0 ? activeCycleRows[0].id : null;

        // Si no hay ciclo activo, obtener el último ciclo completado
        if (!cycle_id) {
            const [lastCycleRows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM conversation_cycles 
                 WHERE conversation_id = ? 
                 ORDER BY started_at DESC 
                 LIMIT 1`,
                [conversacion_id]
            );
            cycle_id = lastCycleRows.length > 0 ? lastCycleRows[0].id : null;
        }

        // Insertar cotización en la tabla correcta 'quotations'
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO quotations 
             (conversation_id, cycle_id, quotation_number, amount, mensaje_id, file_path)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [conversacion_id, cycle_id, numero_cotizacion, monto, mensaje_id || null, archivo_url || null]
        );

        // Obtener la cotización creada
        const [newQuotation] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM quotations WHERE id = ?',
            [result.insertId]
        );

        // Registrar evento del sistema
        const eventoTexto = `Cotización ${numero_cotizacion} enviada por $${Number(monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

        await pool.execute(
            `INSERT INTO conversation_events (conversacion_id, tipo, usuario_id, texto, evento_data)
             VALUES (?, ?, ?, ?, ?)`,
            [
                conversacion_id,
                'cotizacion',
                user.id,
                eventoTexto,
                JSON.stringify({
                    quotation_id: result.insertId,
                    numero_cotizacion: numero_cotizacion,
                    monto: monto,
                    cycle_id: cycle_id
                })
            ]
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
