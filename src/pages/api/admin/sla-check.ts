
import { type APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import axios from 'axios';
import type { RowDataPacket } from 'mysql2/promise';

export const POST: APIRoute = async ({ locals }) => {

    const logs: string[] = [];
    function log(msg: string) {
        logs.push(`[${new Date().toISOString()}] ${msg}`);
        console.log(msg);
    }

    try {
        log("Iniciando chequeo manual SLA...");

        const WABA_TOKEN = process.env.WABA_TOKEN;
        const WABA_PHONE_ID = process.env.WABA_PHONE_ID || process.env.WABA_PHONE_NUMBER_ID;

        if (!WABA_TOKEN || !WABA_PHONE_ID) {
            log("❌ Error: Faltan variables de entorno WABA_TOKEN / WABA_PHONE_ID");
            return new Response(JSON.stringify({ ok: false, logs }), { headers: { 'Content-Type': 'application/json' } });
        }

        // 1. Obtener configuración
        const [settingsRows] = await pool.query<RowDataPacket[]>('SELECT * FROM sla_settings WHERE active = 1 LIMIT 1');
        if (settingsRows.length === 0) {
            log('⚠️ SLA inactivo o sin configuración en BD.');
            return new Response(JSON.stringify({ ok: true, logs, message: "SLA Inactivo" }), { headers: { 'Content-Type': 'application/json' } });
        }

        const config = settingsRows[0];
        const thresholdMinutes = config.unanswered_threshold_minutes;
        const graceMinutes = config.grace_period_minutes;
        const templateName = config.template_name || 'plantilla_test';
        let notifyUnassignedIds: number[] = [];
        try {
            notifyUnassignedIds = typeof config.notify_unassigned_json === 'string'
                ? JSON.parse(config.notify_unassigned_json)
                : (config.notify_unassigned_json || []);
        } catch { }

        log(`Config encontrada: Umbral=${thresholdMinutes}min, Gracia=${graceMinutes}min, Tpl=${templateName}`);

        // 2. Buscar conversaciones
        const thresholdSeconds = thresholdMinutes * 60;
        const nowUnix = Math.floor(Date.now() / 1000);
        const cutOffTime = nowUnix - thresholdSeconds;

        const query = `
            SELECT 
                c.id, 
                c.wa_user, 
                c.wa_profile_name, 
                c.asignado_a,
                c.status_id,
                u.nombre as agente_nombre,
                u.telefono as agente_telefono,
                m.ts as last_msg_ts,
                m.cuerpo as last_msg_body
            FROM conversaciones c
            JOIN mensajes m ON c.id = m.conversacion_id 
            LEFT JOIN usuarios u ON c.asignado_a = u.id
            LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
            WHERE 
                cs.is_final = 0 
                AND m.id = (SELECT id FROM mensajes WHERE conversacion_id = c.id ORDER BY ts DESC LIMIT 1) 
                AND m.from_me = 0 
                AND m.ts < ? 
                AND NOT EXISTS (
                    SELECT 1 FROM agent_notifications an 
                    WHERE an.conversacion_id = c.id 
                    AND an.mensaje_id = m.id 
                    AND an.tipo = 'sla_breach'
                )
        `;

        const [rows] = await pool.query<any[]>(query, [cutOffTime]);

        if (rows.length === 0) {
            log('✅ Ninguna conversación infringe SLA (o ya fueron notificadas).');
        } else {
            log(`⚠️ Encontradas ${rows.length} conversaciones desatendidas.`);
        }

        let sentCount = 0;

        for (const conv of rows) {
            // Verificar gracia
            const [cycleRows] = await pool.query<any[]>(
                'SELECT completed_at FROM conversation_cycles WHERE conversation_id = ? ORDER BY completed_at DESC LIMIT 1',
                [conv.id]
            );

            if (cycleRows.length > 0) {
                const lastCycleTime = new Date(cycleRows[0].completed_at).getTime() / 1000;
                if ((nowUnix - lastCycleTime) < (graceMinutes * 60)) {
                    log(`Saltando conv #${conv.id} por periodo de gracia.`);
                    continue;
                }
            }

            const timeDiffMinutes = Math.floor((nowUnix - conv.last_msg_ts) / 60);
            const alertMsg = `⚠️ ALERTA SLA: Conversación pendiente por ${timeDiffMinutes} min.`;

            const phonesToNotify = new Set<string>();
            if (conv.asignado_a && conv.agente_telefono) {
                phonesToNotify.add(conv.agente_telefono);
                log(`Agente asignado: ${conv.agente_nombre} (${conv.agente_telefono})`);
            } else if (!conv.asignado_a && notifyUnassignedIds.length > 0) {
                const [admins] = await pool.query<any[]>(
                    `SELECT telefono, nombre FROM usuarios WHERE id IN (?) AND telefono IS NOT NULL`,
                    [notifyUnassignedIds]
                );
                admins.forEach((a: any) => {
                    phonesToNotify.add(a.telefono);
                    log(`Admin a notificar: ${a.nombre} (${a.telefono})`);
                });
            }

            if (phonesToNotify.size === 0) {
                log(`❌ Conv #${conv.id}: Sin destinatarios válidos (sin teléfonos).`);
                continue;
            }

            for (const phone of phonesToNotify) {
                const cleanTo = phone.replace(/\D/g, '');
                log(`Enviando WhatsApp a ${cleanTo} usando plantilla '${templateName}'...`);

                try {
                    await axios.post(
                        `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/messages`,
                        {
                            messaging_product: "whatsapp",
                            to: cleanTo,
                            type: "template",
                            template: {
                                name: templateName,
                                language: { code: "es_MX" }
                            }
                        },
                        { headers: { Authorization: `Bearer ${WABA_TOKEN}` } }
                    );
                    log(`✅ Enviado OK a ${cleanTo}`);
                    sentCount++;
                } catch (error: any) {
                    const errDetail = error.response?.data?.error?.message || error.message;
                    log(`❌ Error enviando a ${cleanTo}: ${errDetail}`);
                }
            }

            // Registrar notificación
            let logUserId = conv.asignado_a || (notifyUnassignedIds.length > 0 ? notifyUnassignedIds[0] : null);
            if (logUserId) {
                await pool.query(
                    `INSERT INTO agent_notifications (usuario_id, conversacion_id, mensaje_id, tipo, leida)
                     VALUES (?, ?, (SELECT id FROM mensajes WHERE conversacion_id=? ORDER BY ts DESC LIMIT 1), 'sla_breach', 0)`,
                    [logUserId, conv.id, conv.id]
                );
            }
        }

        return new Response(JSON.stringify({ ok: true, logs, sentCount }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e: any) {
        log(`❌ Error General: ${e.message}`);
        return new Response(JSON.stringify({ ok: false, logs, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
