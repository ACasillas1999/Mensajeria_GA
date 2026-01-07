import { createPool } from 'mysql2/promise';
import 'dotenv/config';
import axios from 'axios';

// Configuración DB (usar las mismas vars de entorno que la app)
const pool = createPool({
    host: process.env.SLA_DB_HOST || process.env.DB_HOST || 'localhost',
    user: process.env.SLA_DB_USER || process.env.DB_USER || 'root',
    password: process.env.SLA_DB_PASSWORD || process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.SLA_DB_NAME || process.env.DB_NAME || 'mensajeria_ga',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('--- SLA Watcher DB Debug ---');
console.log('DB_HOST:', process.env.SLA_DB_HOST || process.env.DB_HOST);
console.log('DB_USER:', process.env.SLA_DB_USER || process.env.DB_USER);
console.log('----------------------------');

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_ID = process.env.WABA_PHONE_ID || process.env.WABA_PHONE_NUMBER_ID;

// Función para enviar WhatsApp
// Función para enviar WhatsApp (Plantilla)
async function sendWhatsAppAlert(to: string, templateName: string, _message: string) {
    if (!WABA_TOKEN || !WABA_PHONE_ID) {
        console.error('Faltan credenciales WABA');
        return;
    }

    const cleanTo = to.replace(/\D/g, '');

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
        console.log(`✅ Alerta (plantilla: ${templateName}) enviada a ${cleanTo}`);
    } catch (error: any) {
        console.error(`❌ Error enviando plantilla a ${cleanTo}:`, error.response?.data || error.message);
    }
}

async function checkSLA() {
    console.log(`[${new Date().toISOString()}] Verificando SLA...`);

    try {
        // 1. Obtener configuración
        const [settingsRows] = await pool.query<any[]>('SELECT * FROM sla_settings WHERE active = 1 LIMIT 1');
        if (settingsRows.length === 0) {
            console.log('SLA inactivo o sin configuración.');
            return;
        }

        const config = settingsRows[0];
        const thresholdMinutes = config.unanswered_threshold_minutes;
        const graceMinutes = config.grace_period_minutes;
        const templateName = config.template_name || 'plantilla_test';
        let notifyUnassignedIds: number[] = [];
        try {
            notifyUnassignedIds = typeof config.notify_unassigned_json === 'string'
                ? JSON.parse(config.notify_unassigned_json)
                : config.notify_unassigned_json;
        } catch { }

        // 2. Buscar conversaciones "calientes"
        // Criterios:
        // - Estado NO final (is_final = 0)
        // - Último mensaje fue del cliente (from_me = 0 en la tabla mensajes... pero optimizamos usando 'ultimo_ts')
        // - Espera: Para saber si el último mensaje fue del cliente, necesitamos ver la tabla mensajes o confiar en lógica app.
        //   Mejor hacemos query a conversaciones join mensajes.

        // Estrategia eficiente:
        // Buscar conversaciones abiertas donde el último mensaje NO es del negocio (from_me=0)
        // Y cuyo timestamp es más antiguo que X minutos.

        const thresholdSeconds = thresholdMinutes * 60;
        const nowUnix = Math.floor(Date.now() / 1000);
        const cutOffTime = nowUnix - thresholdSeconds;

        // Query para encontrar conversaciones desatendidas
        // NOTA: Asumimos que si el último mensaje en la BD (ordenado por ts) tiene from_me=0, es turno del agente.
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
                cs.is_final = 0 -- Solo activas
                AND m.id = (SELECT id FROM mensajes WHERE conversacion_id = c.id ORDER BY ts DESC LIMIT 1) -- Último mensaje
                AND m.from_me = 0 -- Fue del cliente
                AND m.ts < ? -- Ya pasó el tiempo
                -- Excluir si ya se notificó recientemente para ESTE mensaje (evitar spam)
                -- Esto requeriría guardar "last_notified_msg_id".
                -- Por ahora, verificamos si existe notificación en agent_notifications para este mensaje
                AND NOT EXISTS (
                    SELECT 1 FROM agent_notifications an 
                    WHERE an.conversacion_id = c.id 
                    AND an.mensaje_id = m.id 
                    AND an.tipo = 'sla_breach'
                )
        `;

        const [rows] = await pool.query<any[]>(query, [cutOffTime]);

        if (rows.length === 0) {
            console.log('Ninguna conversación infringe SLA.');
            return;
        }

        console.log(`Encontradas ${rows.length} conversaciones desatendidas.`);

        // 3. Procesar alertas
        for (const conv of rows) {

            // Verificación extra: Periodo de gracia (si hubo un ciclo cerrado recientemente)
            // Buscar último ciclo completado
            const [cycleRows] = await pool.query<any[]>(
                'SELECT completed_at FROM conversation_cycles WHERE conversation_id = ? ORDER BY completed_at DESC LIMIT 1',
                [conv.id]
            );

            if (cycleRows.length > 0) {
                const lastCycleTime = new Date(cycleRows[0].completed_at).getTime() / 1000;
                if ((nowUnix - lastCycleTime) < (graceMinutes * 60)) {
                    console.log(`Saltando conv ${conv.id} por periodo de gracia.`);
                    continue;
                }
            }

            // Construir mensaje alerta
            const timeDiffMinutes = Math.floor((nowUnix - conv.last_msg_ts) / 60);
            const alertMsg = `⚠️ ALERTA SLA: Conversación pendiente por ${timeDiffMinutes} min.\nCliente: ${conv.wa_profile_name || conv.wa_user}\nÚltimo msl: "${conv.last_msg_body?.substring(0, 50)}..."`;

            // A quién notificar?
            const phonesToNotify = new Set<string>();

            if (conv.asignado_a && conv.agente_telefono) {
                phonesToNotify.add(conv.agente_telefono);
            } else if (!conv.asignado_a && notifyUnassignedIds.length > 0) {
                // Notificar a lista de "sin asignar"
                const [admins] = await pool.query<any[]>(
                    `SELECT telefono FROM usuarios WHERE id IN (?) AND telefono IS NOT NULL`,
                    [notifyUnassignedIds]
                );
                admins.forEach((a: any) => phonesToNotify.add(a.telefono));
            }

            // Enviar WhatsApps
            if (phonesToNotify.size > 0) {
                for (const phone of phonesToNotify) {
                    await sendWhatsAppAlert(phone, templateName, alertMsg);
                }
            } else {
                console.log(`Conv ${conv.id}: No hay teléfonos configurados para notificar.`);
            }

            // Registrar notificación en BD para no repetir (usamos agent_notifications como log también)
            // Si no está asignado, usamos el primer admin ID o un placeholder (ej: null si la tabla lo permite, o el sistema)
            // La tabla requiere usuario_id. Usaremos el asignado O el primero de la lista config.

            let logUserId = conv.asignado_a;
            if (!logUserId && notifyUnassignedIds.length > 0) logUserId = notifyUnassignedIds[0];

            if (logUserId) {
                await pool.query(
                    `INSERT INTO agent_notifications (usuario_id, conversacion_id, mensaje_id, tipo, leida)
                     VALUES (?, ?, (SELECT id FROM mensajes WHERE conversacion_id=? ORDER BY ts DESC LIMIT 1), 'sla_breach', 0)`,
                    [logUserId, conv.id, conv.id]
                );
            }
        }

    } catch (e) {
        console.error('Error en checkSLA:', e);
    }
}

// Ejecutar
checkSLA().then(() => {
    // Si queremos que se mantenga vivo (comentar para cron)
    // process.exit(0);
    console.log("Terminado. Esperando siguiente ciclo...");
});

// Intervalo (si se corre como servicio persistente)
setInterval(checkSLA, 60 * 1000); // Cada minuto
