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

// Función para obtener el número de variables de una plantilla
async function getTemplateVariableCount(templateName: string): Promise<number> {
    try {
        const [rows] = await pool.query<any[]>(
            'SELECT body_text FROM plantillas WHERE nombre = ? LIMIT 1',
            [templateName]
        );

        if (rows.length === 0) {
            console.log(`⚠️ Plantilla "${templateName}" no encontrada en BD. Asumiendo 0 variables.`);
            return 0;
        }

        const bodyText = rows[0].body_text;
        const matches = bodyText?.match(/\{\{(\d+)\}\}/g) || [];
        console.log(`📋 Plantilla "${templateName}" tiene ${matches.length} variable(s)`);
        return matches.length;
    } catch (error) {
        console.error(`Error consultando plantilla "${templateName}":`, error);
        return 0;
    }
}


// Función para enviar WhatsApp
// Función para enviar WhatsApp (Plantilla con variables opcionales)
async function sendWhatsAppAlert(to: string, templateName: string, variables: string[] = []) {
    if (!WABA_TOKEN || !WABA_PHONE_ID) {
        console.error('Faltan credenciales WABA');
        return;
    }

    const cleanTo = to.replace(/\D/g, '');

    try {
        const payload: any = {
            messaging_product: "whatsapp",
            to: cleanTo,
            type: "template",
            template: {
                name: templateName,
                language: { code: "es_MX" }
            }
        };

        // Agregar componentes solo si hay variables
        if (variables.length > 0) {
            payload.template.components = [{
                type: "body",
                parameters: variables.map(v => ({
                    type: "text",
                    text: v
                }))
            }];
        }

        console.log(`[SLA] Enviando plantilla "${templateName}" a ${cleanTo}:`, JSON.stringify(payload.template, null, 2));

        await axios.post(
            `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/messages`,
            payload,
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

        // Límite máximo: solo considerar mensajes de las últimas 48 horas
        const maxAgeSeconds = 48 * 60 * 60; // 48 horas
        const oldestAllowedTime = nowUnix - maxAgeSeconds;

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
                AND m.ts < ? -- Ya pasó el tiempo (umbral SLA)
                AND m.ts > ? -- Pero no más antiguo que 48 horas
                -- Excluir si ya se notificó recientemente para ESTE mensaje (evitar spam)
                AND NOT EXISTS (
                    SELECT 1 FROM agent_notifications an 
                    WHERE an.conversacion_id = c.id 
                    AND an.mensaje_id = m.id 
                    AND an.tipo = 'sla_breach'
                )
        `;

        const [rows] = await pool.query<any[]>(query, [cutOffTime, oldestAllowedTime]);

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

            // Calcular tiempo de espera
            const timeDiffMinutes = Math.floor((nowUnix - conv.last_msg_ts) / 60);

            // Obtener número de variables que necesita la plantilla
            const varCount = await getTemplateVariableCount(templateName);

            // Datos base disponibles
            let clienteInfo = conv.wa_profile_name || conv.wa_user;
            // Si el nombre es solo puntuación o muy corto, usar el teléfono
            if (!clienteInfo || clienteInfo.trim().length <= 1 || /^[.\-_]+$/.test(clienteInfo)) {
                clienteInfo = conv.wa_user || "Cliente";
            }
            const tiempoEspera = `${timeDiffMinutes} minutos`;
            const conversacionId = `#${conv.id}`;
            const ultimoMensaje = conv.last_msg_body?.substring(0, 50) || "";
            const fechaHora = new Date().toLocaleString('es-MX');

            // A quién notificar? Construir mapa de teléfono -> nombre
            const recipients = new Map<string, string>(); // teléfono -> nombre

            // Si está asignado, notificar al agente
            if (conv.asignado_a && conv.agente_telefono) {
                recipients.set(conv.agente_telefono, conv.agente_nombre);
                console.log(`✅ Agente asignado agregado: ${conv.agente_nombre} (${conv.agente_telefono})`);
            } else if (conv.asignado_a && !conv.agente_telefono) {
                console.log(`⚠️ Agente ${conv.agente_nombre} (ID: ${conv.asignado_a}) NO tiene teléfono registrado`);
            }

            // SIEMPRE notificar también a los admins configurados
            if (notifyUnassignedIds.length > 0) {
                const [admins] = await pool.query<any[]>(
                    `SELECT telefono, nombre FROM usuarios WHERE id IN (?) AND telefono IS NOT NULL`,
                    [notifyUnassignedIds]
                );
                admins.forEach((a: any) => recipients.set(a.telefono, a.nombre));
            }

            // Enviar WhatsApps con variables personalizadas
            if (recipients.size > 0) {
                for (const [phone, nombre] of recipients) {
                    // Construir variables personalizadas para este destinatario
                    // Cada persona recibe un mensaje con SU PROPIO nombre
                    const nombreParaVariable = nombre;

                    const templateVariables: string[] = [];
                    if (varCount >= 1) templateVariables.push(nombreParaVariable);
                    if (varCount >= 2) templateVariables.push(clienteInfo);
                    if (varCount >= 3) templateVariables.push(`no ha contestado en ${tiempoEspera}`);
                    if (varCount >= 4) templateVariables.push(conversacionId);
                    if (varCount >= 5) templateVariables.push(ultimoMensaje);
                    if (varCount >= 6) templateVariables.push(fechaHora);

                    console.log(`Conv #${conv.id} -> ${nombre} (${phone}): Variables:`, templateVariables);
                    await sendWhatsAppAlert(phone, templateName, templateVariables, conv.id, nombre);
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
