import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * GET /api/admin/sla-settings
 * Obtiene la configuración actual de SLA
 */
export const GET: APIRoute = async ({ locals }) => {
    const user = (locals as any).user;
    if (!user || user.rol !== 'ADMIN') {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM sla_settings LIMIT 1');

        if (rows.length === 0) {
            // Retornar defaults si no existe
            return new Response(JSON.stringify({
                ok: true,
                settings: {
                    unanswered_threshold_minutes: 15,
                    grace_period_minutes: 120,
                    notify_unassigned_json: [],
                    template_name: 'plantilla_test',
                    assignment_template_name: '',
                    active: false
                }
            }));
        }

        const settings = rows[0];
        // Parsear JSON si viene como string
        if (typeof settings.notify_unassigned_json === 'string') {
            try {
                settings.notify_unassigned_json = JSON.parse(settings.notify_unassigned_json);
            } catch { }
        }

        return new Response(JSON.stringify({ ok: true, settings }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
    }
};

/**
 * POST /api/admin/sla-settings
 * Actualiza la configuración de SLA
 */
export const POST: APIRoute = async ({ request, locals }) => {
    const user = (locals as any).user;
    if (!user || user.rol !== 'ADMIN') {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403 });
    }

    try {
        const body = await request.json();
        const { unanswered_threshold_minutes, grace_period_minutes, notify_unassigned_json, active, template_name, assignment_template_name } = body;

        // Validaciones básicas
        if (typeof unanswered_threshold_minutes !== 'number' || typeof grace_period_minutes !== 'number') {
            return new Response(JSON.stringify({ ok: false, error: 'Invalid numeric values' }), { status: 400 });
        }

        const notifyJson = JSON.stringify(notify_unassigned_json || []);
        const isActive = active ? 1 : 0;
        const tplName = template_name || 'plantilla_test';

        // Upsert (aunque idealmente ya existe por el script SQL)
        const [check] = await pool.query<RowDataPacket[]>('SELECT id FROM sla_settings LIMIT 1');

        if (check.length > 0) {
            await pool.query(
                `UPDATE sla_settings 
                 SET unanswered_threshold_minutes = ?, 
                     grace_period_minutes = ?, 
                     notify_unassigned_json = ?, 
                     active = ?,
                     template_name = ?,
                     assignment_template_name = ?
                 WHERE id = ?`,
                [unanswered_threshold_minutes, grace_period_minutes, notifyJson, isActive, tplName, assignment_template_name || null, check[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO sla_settings (unanswered_threshold_minutes, grace_period_minutes, notify_unassigned_json, active, template_name, assignment_template_name)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [unanswered_threshold_minutes, grace_period_minutes, notifyJson, isActive, tplName, assignment_template_name || null]
            );
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
    }
};
