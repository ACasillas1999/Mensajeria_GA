import type { APIRoute } from 'astro';
import 'dotenv/config';
import { pool } from '../../lib/db';
import crypto from 'crypto';
import { processAutoReply } from '../../lib/autoReply';
import { broadcastToConversation } from './events';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Verifica si una conversación está en estado final y resetea el ciclo si es necesario
 * Cuando un cliente en estado final vuelve a escribir, se:
 * 1. Guarda el ciclo completado en conversation_cycles
 * 2. Incrementa cycle_count
 * 3. Resetea el estado al configurado (auto_reset_to_status_id) o al estado por defecto
 */
async function checkAndResetCycle(convId: number) {
  try {
    console.log(`[Cycle Reset DEBUG] ========== Iniciando checkAndResetCycle para conversación ${convId} ==========`);

    // Obtener información de la conversación y su estado actual
    const [convRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id,
        c.status_id,
        c.cycle_count,
        c.current_cycle_started_at,
        c.asignado_a,
        cs.is_final,
        cs.auto_reset_to_status_id,
        cs.name as status_name
      FROM conversaciones c
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      WHERE c.id = ?`,
      [convId]
    );

    if (convRows.length === 0) {
      console.log(`[Cycle Reset DEBUG] Conversación ${convId} NO encontrada en la base de datos`);
      return;
    }

    const conv = convRows[0];
    console.log(`[Cycle Reset DEBUG] Conversación encontrada:`, {
      id: conv.id,
      status_id: conv.status_id,
      status_name: conv.status_name,
      is_final: conv.is_final,
      auto_reset_to_status_id: conv.auto_reset_to_status_id,
      cycle_count: conv.cycle_count,
      current_cycle_started_at: conv.current_cycle_started_at
    });

    // Si no está en estado final, no hacer nada
    if (!conv.is_final) {
      console.log(`[Cycle Reset DEBUG] Estado "${conv.status_name}" NO es final (is_final=${conv.is_final}). No se resetea el ciclo.`);
      return;
    }

    console.log(`[Cycle Reset] Conversación ${convId} en estado final "${conv.status_name}", completando ciclo...`);

    // Obtener el último field_data del estado actual
    const [lastHistoryRows] = await pool.query<RowDataPacket[]>(
      `SELECT field_data
       FROM conversation_status_history
       WHERE conversation_id = ? AND new_status_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [convId, conv.status_id]
    );

    const cycleData = lastHistoryRows.length > 0 && lastHistoryRows[0].field_data
      ? lastHistoryRows[0].field_data
      : null;

    // Contar mensajes del ciclo actual
    const [msgCountRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM mensajes
       WHERE conversacion_id = ?
         AND creado_en >= ?`,
      [convId, conv.current_cycle_started_at || new Date()]
    );

    const totalMessages = msgCountRows[0]?.total || 0;

    // 1. Guardar el ciclo completado en conversation_cycles
    const newCycleNumber = (conv.cycle_count || 0) + 1;

    await pool.query(
      `INSERT INTO conversation_cycles
       (conversation_id, cycle_number, started_at, completed_at,
        initial_status_id, final_status_id, total_messages, assigned_to, cycle_data)
       VALUES (?, ?, ?, NOW(), NULL, ?, ?, ?, ?)`,
      [
        convId,
        newCycleNumber,
        conv.current_cycle_started_at || new Date(),
        conv.status_id,
        totalMessages,
        conv.asignado_a || null,
        cycleData
      ]
    );

    console.log(`[Cycle Reset] Ciclo #${newCycleNumber} guardado con ${totalMessages} mensajes`);

    // 2. Determinar estado de reset
    let resetStatusId = conv.auto_reset_to_status_id;

    // Si no hay auto_reset_to_status_id, usar el estado por defecto
    if (!resetStatusId) {
      const [defaultStatusRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM conversation_statuses
         WHERE is_default = TRUE AND is_active = TRUE
         LIMIT 1`
      );

      if (defaultStatusRows.length === 0) {
        // Si no hay estado default, usar el primero activo
        const [firstStatusRows] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM conversation_statuses
           WHERE is_active = TRUE
           ORDER BY display_order ASC
           LIMIT 1`
        );
        resetStatusId = firstStatusRows[0]?.id || conv.status_id;
      } else {
        resetStatusId = defaultStatusRows[0].id;
      }
    }

    // 3. Resetear la conversación al nuevo ciclo
    await pool.query(
      `UPDATE conversaciones
       SET status_id = ?,
           cycle_count = ?,
           current_cycle_started_at = NOW()
       WHERE id = ?`,
      [resetStatusId, newCycleNumber, convId]
    );

    // 4. Registrar el cambio de estado en el historial
    await pool.query(
      `INSERT INTO conversation_status_history
       (conversation_id, old_status_id, new_status_id, changed_by, change_reason)
       VALUES (?, ?, ?, NULL, 'Ciclo completado - Reset automático')`,
      [convId, conv.status_id, resetStatusId]
    );

    // 5. Registrar evento del sistema
    const [newStatusRows] = await pool.query<RowDataPacket[]>(
      `SELECT name, icon FROM conversation_statuses WHERE id = ?`,
      [resetStatusId]
    );

    const newStatusName = newStatusRows[0]?.name || 'Nuevo';
    const newStatusIcon = newStatusRows[0]?.icon || '🔄';

    await pool.query(
      `INSERT INTO conversation_events
       (conversacion_id, tipo, texto, evento_data)
       VALUES (?, 'cambio_estado', ?, ?)`,
      [
        convId,
        `🔄 Ciclo #${newCycleNumber} completado - Estado reseteado a ${newStatusIcon} ${newStatusName}`,
        JSON.stringify({
          cycle_number: newCycleNumber,
          old_status_id: conv.status_id,
          new_status_id: resetStatusId,
          reason: 'Cliente volvió a escribir después de completar ciclo'
        })
      ]
    );

    console.log(`[Cycle Reset] Conversación ${convId} reseteada a estado "${newStatusName}" (ciclo #${newCycleNumber})`);

  } catch (error) {
    console.error('[Cycle Reset] Error:', error);
    // No lanzar error para no interrumpir el procesamiento del webhook
  }
}

/**
 * Procesa eventos de llamadas de WhatsApp Business
 */
async function processCallEvent(value: any) {
  try {
    const call = value?.call;
    if (!call) return;

    const callId = call.id;
    const from = call.from;
    const to = call.to;
    const timestamp = Number(call.timestamp || Date.now() / 1000);
    const status = call.status ? call.status.toLowerCase() : 'initiated'; // Normalizar a minúsculas

    // Determinar dirección de la llamada
    // Si el 'from' NO es nuestro número de negocio, es una llamada entrante del cliente
    const BUSINESS_PHONE = process.env.WABA_PHONE_NUMBER_ID || process.env.WABA_PHONE_ID;
    const isInbound = from && from !== BUSINESS_PHONE;
    const direction = isInbound ? 'inbound' : 'outbound';

    // Buscar o crear conversación
    let convId: number;
    const [found] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM conversaciones WHERE wa_user=? LIMIT 1',
      [from]
    );

    if (found.length) {
      convId = found[0].id;
    } else {
      const [ins] = await pool.query(
        'INSERT INTO conversaciones (wa_user, estado) VALUES (?, "ABIERTA")',
        [from]
      );
      convId = (ins as any).insertId;
    }

    // Insertar o actualizar el registro de llamada
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, duration_seconds FROM whatsapp_calls WHERE wa_call_id=? LIMIT 1',
      [callId]
    );

    if (existing.length) {
      // Actualizar llamada existente
      const duration = call.duration_seconds || existing[0].duration_seconds || 0;
      const endTime = (status === 'completed' || status === 'failed') ? new Date(timestamp * 1000) : null;

      await pool.query(
        `UPDATE whatsapp_calls
         SET status=?, duration_seconds=?, end_time=?, metadata=?, actualizado_en=CURRENT_TIMESTAMP
         WHERE wa_call_id=?`,
        [status, duration, endTime, JSON.stringify(call), callId]
      );
    } else {
      // Crear nuevo registro de llamada
      await pool.query(
        `INSERT INTO whatsapp_calls
         (conversacion_id, wa_call_id, direction, from_number, to_number, status, start_time, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [convId, callId, direction, from, to, status, new Date(timestamp * 1000), JSON.stringify(call)]
      );
    }

    // Actualizar permisos si es una llamada iniciada por negocio
    if (direction === 'outbound' && (status === 'no_answer' || status === 'rejected' || status === 'missed')) {
      await pool.query(
        `UPDATE call_permissions
         SET consecutive_unanswered = consecutive_unanswered + 1
         WHERE conversacion_id=?`,
        [convId]
      );
    } else if (direction === 'outbound' && status === 'completed') {
      // Resetear contador si la llamada fue completada
      await pool.query(
        `UPDATE call_permissions
         SET consecutive_unanswered = 0
         WHERE conversacion_id=?`,
        [convId]
      );
    }

    // Emitir evento en tiempo real para notificar a los clientes conectados
    console.log('Broadcasting call event to conversation:', convId);
    broadcastToConversation(convId, 'call', {
      conversation_id: convId,
      call_id: callId,
      direction,
      from,
      to,
      status,
      timestamp
    });

    console.log('Call event processed:', { callId, direction, status });
  } catch (err) {
    console.error('Error processing call event:', err);
  }
}

/**
 * Valida la firma X-Hub-Signature-256 de Meta/WhatsApp
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;

  const appSecret = process.env.WABA_APP_SECRET;
  if (!appSecret) {
    console.warn('WABA_APP_SECRET no configurado - saltando validación de firma');
    return true; // En desarrollo permitir sin firma, pero loguear warning
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/** VERIFICACIÓN (GET) */
export const GET: APIRoute = async ({ request }) => {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode') ?? '';
  const token = (u.searchParams.get('hub.verify_token') ?? '').trim();
  const challenge = u.searchParams.get('hub.challenge') ?? '';
  const expected = (process.env.WABA_VERIFY_TOKEN ?? '').trim();

  console.log('WEBHOOK VERIFY', { mode, match: token === expected });
  if (mode === 'subscribe' && token && token === expected) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
};

/** EVENTOS (POST) */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Leer el body como texto para validar firma
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // Validar firma de Meta
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('WEBHOOK: Firma inválida');
      return new Response('Invalid signature', { status: 401 });
    }

    const data = JSON.parse(rawBody);
    console.log('WEBHOOK EVENT (raw):', JSON.stringify(data).slice(0, 400), '...');

    const entries = data?.entry ?? [];
    for (const e of entries) {
      const changes = e?.changes ?? [];
      for (const c of changes) {
        // Procesar eventos de llamadas
        const calls = c?.value?.calls;
        if (Array.isArray(calls) && calls.length > 0) {
          for (const call of calls) {
            await processCallEvent({ ...c.value, call });
          }
          continue;
        }

        // (opcional) ignorar otros campos que no sean messages
        if (c.field && c.field !== 'messages') {
          continue;
        }

        // 1) ESTADOS (✓/✓✓/✓✓ azul o errores)
        const statuses = c?.value?.statuses;
        if (Array.isArray(statuses) && statuses.length) {
          for (const s of statuses) {
            const wa_msg_id = s.id;
            const st = s.status as 'sent' | 'delivered' | 'read' | 'failed';
            const ts = Number(s.timestamp || Date.now() / 1000);
            const err = s.errors?.[0];

            await pool.query(
              `UPDATE mensajes
                 SET status=?, status_ts=?, error_code=?, error_title=?, error_message=?
               WHERE wa_msg_id=?`,
              [st, ts, err?.code ?? null, err?.title ?? null, err?.details ?? null, wa_msg_id]
            );
          }
          continue; // listo con este change
        }

        // 2) REACCIONES ENTRANTES (cuando el cliente reacciona a nuestros mensajes)
        const reactions = c?.value?.messages?.filter((m: any) => m.type === 'reaction') || [];
        for (const r of reactions) {
          const emoji = r.reaction?.emoji;
          const msgId = r.reaction?.message_id; // wa_msg_id del mensaje al que reacciona

          if (emoji && msgId) {
            // Actualizar el mensaje en BD con la reacción del cliente
            await pool.query(
              `UPDATE mensajes SET client_reaction_emoji=? WHERE wa_msg_id=?`,
              [emoji, msgId]
            );
          }
        }

        // 3) MENSAJES ENTRANTES (excluir reacciones, ya las procesamos arriba)
        const allMsgs = c?.value?.messages as any[] | undefined;
        const contacts = c?.value?.contacts as any[] | undefined;
        if (!allMsgs || !contacts) continue;

        // Filtrar solo mensajes que NO son reacciones
        const msgs = allMsgs.filter((m: any) => m.type !== 'reaction');
        if (msgs.length === 0) continue;

        const from = msgs[0]?.from;
        const profileName = contacts[0]?.profile?.name || null;

        console.log(`[Webhook DEBUG] ===== Mensaje ENTRANTE recibido =====`);
        console.log(`[Webhook DEBUG] De: ${from} (${profileName})`);
        console.log(`[Webhook DEBUG] Total mensajes en este change: ${msgs.length}`);

        // upsert conversación del remitente (una vez por change)
        let convId: number;
        const [found] = await pool.query('SELECT id FROM conversaciones WHERE wa_user=? LIMIT 1', [from]);
        if ((found as any[]).length) {
          convId = (found as any[])[0].id;
        } else {
          const [ins] = await pool.query(
            'INSERT INTO conversaciones (wa_user, wa_profile_name, estado) VALUES (?,?, "NUEVA")',
            [from, profileName]
          );
          convId = (ins as any).insertId;
        }

        // guardar cada mensaje (idempotente por wa_msg_id)
        for (const m of msgs) {
          const ts = Number(m.timestamp || Date.now() / 1000);
          const tipo = m.type as string;

          let cuerpo = '';
          let media_id: string | null = null;
          let mime_type: string | null = null;

          // Capturar información de mensaje citado (reply/quote)
          let replied_to_wa_id: string | null = null;
          let replied_to_msg_id: number | null = null;
          let replied_to_text: string | null = null;

          if (m.context && m.context.id) {
            replied_to_wa_id = m.context.id;

            // Buscar el mensaje citado en nuestra BD por su wa_msg_id
            const [quotedMsgRows] = await pool.query<RowDataPacket[]>(
              'SELECT id, cuerpo, tipo FROM mensajes WHERE wa_msg_id = ? LIMIT 1',
              [replied_to_wa_id]
            );

            if (quotedMsgRows.length > 0) {
              replied_to_msg_id = quotedMsgRows[0].id;
              // Guardar el texto citado para visualización rápida
              if (quotedMsgRows[0].tipo === 'text') {
                replied_to_text = quotedMsgRows[0].cuerpo;
              } else {
                // Para otros tipos, mostrar el tipo de mensaje
                replied_to_text = quotedMsgRows[0].cuerpo; // Ya tiene formato [Imagen], [Audio], etc.
              }
            }
          }

          switch (tipo) {
            case 'text':
              cuerpo = m.text?.body || '';
              break;

            case 'audio':
              media_id = m.audio?.id || null;
              mime_type = m.audio?.mime_type || null;
              cuerpo = '[Audio]';
              break;

            case 'image':
              media_id = m.image?.id || null;
              mime_type = m.image?.mime_type || null;
              cuerpo = m.image?.caption || '[Imagen]';
              break;

            case 'video':
              media_id = m.video?.id || null;
              mime_type = m.video?.mime_type || null;
              cuerpo = m.video?.caption || '[Video]';
              break;

            case 'document':
              media_id = m.document?.id || null;
              mime_type = m.document?.mime_type || null;
              cuerpo = m.document?.filename || '[Documento]';
              break;

            case 'sticker':
              media_id = m.sticker?.id || null;
              mime_type = m.sticker?.mime_type || null;
              cuerpo = '[Sticker]';
              break;

            case 'interactive': {
              const ir = m.interactive;
              if (ir?.type === 'button_reply') cuerpo = ir.button_reply?.title || '[Botón]';
              else if (ir?.type === 'list_reply') cuerpo = ir.list_reply?.title || '[Lista]';
              else cuerpo = '[Interacción]';
              break;
            }

            case 'location':
              cuerpo = `[Ubicación ${m.location?.latitude},${m.location?.longitude}]`;
              break;

            case 'contacts':
              cuerpo = `[Contacto ${m.contacts?.[0]?.name?.formatted_name || ''}]`;
              break;

            default:
              cuerpo = `[${tipo}]`;
          }

          const [insertResult] = await pool.query(
            `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, media_id, mime_type, replied_to_msg_id, replied_to_wa_id, replied_to_text)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               ts=VALUES(ts),
               cuerpo=VALUES(cuerpo),
               media_id=VALUES(media_id),
               mime_type=VALUES(mime_type),
               replied_to_msg_id=VALUES(replied_to_msg_id),
               replied_to_wa_id=VALUES(replied_to_wa_id),
               replied_to_text=VALUES(replied_to_text)`,
            [convId, 0, tipo, cuerpo, m.id, ts, media_id, mime_type, replied_to_msg_id, replied_to_wa_id, replied_to_text]
          );

          const mensajeId = (insertResult as any).insertId;

          await pool.query(
            `UPDATE conversaciones
               SET wa_profile_name=?, ultimo_msg=?, ultimo_ts=?, estado=IF(estado='NUEVA','ABIERTA',estado)
             WHERE id=?`,
            [profileName, cuerpo, ts, convId]
          );

          // Nota: Los ciclos ahora se completan manualmente por el agente usando el botón "Completar Ciclo"
          // Ya no se resetean automáticamente cuando el cliente envía un mensaje

          // Crear notificación si la conversación está asignada a un agente
          if (mensajeId) {
            const [convInfo] = await pool.query<RowDataPacket[]>(
              'SELECT asignado_a FROM conversaciones WHERE id=? AND asignado_a IS NOT NULL',
              [convId]
            );
            if (convInfo.length > 0 && convInfo[0].asignado_a) {
              try {
                await pool.query(
                  `INSERT INTO agent_notifications (usuario_id, conversacion_id, mensaje_id, tipo, leida)
                   VALUES (?, ?, ?, 'nuevo_mensaje', FALSE)`,
                  [convInfo[0].asignado_a, convId, mensajeId]
                );
              } catch (e) {
                console.error('Error creating message notification:', e);
                // No fallar el webhook si falla la notificación
              }
            }
          }

          // Procesar auto-respuesta solo para mensajes de texto entrantes
          if (tipo === 'text' && cuerpo) {
            // Ejecutar en segundo plano para no demorar la respuesta del webhook
            processAutoReply(convId, cuerpo, from).catch((err) => {
              console.error('Auto-reply error:', err);
            });
          }
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err: any) {
    console.error('WEBHOOK ERROR:', err?.message || err);
    return new Response('BAD_REQUEST', { status: 400 });
  }
};
