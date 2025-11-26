import { pool } from './db';
import { sendText } from './whatsapp';

interface AutoReplyRule {
  id: number;
  name: string;
  trigger_keywords: string;
  response_text: string;
  priority: number;
  match_type: 'exact' | 'contains' | 'starts_with';
  case_sensitive: boolean;
}

interface BusinessHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

/**
 * Obtiene la configuración de auto-respuestas
 */
async function getSetting(key: string): Promise<string | null> {
  const [rows] = await pool.query(
    'SELECT setting_value FROM auto_reply_settings WHERE setting_key = ?',
    [key]
  );
  return (rows as any[])[0]?.setting_value || null;
}

/**
 * Verifica si el sistema de auto-respuestas está habilitado
 */
async function isAutoReplyEnabled(): Promise<boolean> {
  const enabled = await getSetting('auto_reply_enabled');
  return enabled === 'true';
}

/**
 * Verifica si estamos dentro del horario de atención
 */
async function isWithinBusinessHours(): Promise<boolean> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=domingo, 6=sábado
  const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

  const [rows] = await pool.query(
    `SELECT start_time, end_time, is_active
     FROM business_hours
     WHERE day_of_week = ? AND is_active = TRUE`,
    [dayOfWeek]
  );

  const hours = rows as BusinessHour[];
  if (hours.length === 0) return false;

  const { start_time, end_time } = hours[0];
  return currentTime >= start_time && currentTime <= end_time;
}

/**
 * Cuenta cuántas auto-respuestas se han enviado a una conversación
 */
async function getAutoReplyCount(conversacionId: number): Promise<number> {
  // Contar solo las últimas 24 horas
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM auto_reply_log
     WHERE conversacion_id = ? AND UNIX_TIMESTAMP(sent_at) > ?`,
    [conversacionId, oneDayAgo]
  );

  return (rows as any[])[0]?.count || 0;
}

/**
 * Busca una regla de auto-respuesta que coincida con el mensaje
 */
async function findMatchingRule(messageText: string): Promise<AutoReplyRule | null> {
  const [rows] = await pool.query(
    'SELECT * FROM auto_replies WHERE is_active = TRUE ORDER BY priority DESC'
  );

  const rules = rows as AutoReplyRule[];

  for (const rule of rules) {
    const keywords = rule.trigger_keywords.split(',').map(k => k.trim();
    const text = rule.case_sensitive ? messageText : messageText.toLowerCase();

    for (const keyword of keywords) {
      const kw = rule.case_sensitive ? keyword : keyword.toLowerCase();

      let matches = false;

      switch (rule.match_type) {
        case 'exact':
          matches = text === kw;
          break;
        case 'contains':
          matches = text.includes(kw);
          break;
        case 'starts_with':
          matches = text.startsWith(kw);
          break;
      }

      if (matches) {
        return rule;
      }
    }
  }

  return null;
}

/**
 * Registra una auto-respuesta en el log
 */
async function logAutoReply(
  conversacionId: number,
  autoReplyId: number | null,
  triggerMessage: string,
  responseSent: string
): Promise<void> {
  await pool.query(
    `INSERT INTO auto_reply_log (conversacion_id, auto_reply_id, trigger_message, response_sent)
     VALUES (?, ?, ?, ?)`,
    [conversacionId, autoReplyId, triggerMessage, responseSent]
  );
}

/**
 * Guarda un mensaje de auto-respuesta en la BD
 */
async function saveAutoReplyMessage(
  conversacionId: number,
  responseText: string,
  waMessageId: string | null
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await pool.query(
    `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, is_auto_reply)
     VALUES (?, 1, 'text', ?, ?, ?, 'sent', TRUE)`,
    [conversacionId, responseText, waMessageId, now]
  );

  await pool.query(
    `UPDATE conversaciones SET ultimo_msg = ?, ultimo_ts = ? WHERE id = ?`,
    [responseText, now, conversacionId]
  );
}

/**
 * Procesa un mensaje entrante y envía auto-respuesta si aplica
 */
export async function processAutoReply(
  conversacionId: number,
  messageText: string,
  from: string
): Promise<void> {
  try {
    // 1. Verificar si el sistema está habilitado
    const enabled = await isAutoReplyEnabled();
    if (!enabled) return;

    // 2. Verificar límite de auto-respuestas por conversación
    const maxReplies = parseInt(await getSetting('max_auto_replies_per_conversation') || '3');
    const currentCount = await getAutoReplyCount(conversacionId);
    if (currentCount >= maxReplies) {
      console.log(`Auto-reply limit reached for conversation ${conversacionId}`);
      return;
    }

    // 3. Verificar si estamos dentro de horario
    const withinHours = await isWithinBusinessHours();
    const outOfHoursEnabled = (await getSetting('out_of_hours_enabled') === 'true';

    // Si estamos fuera de horario, enviar mensaje de fuera de horario
    if (!withinHours && outOfHoursEnabled) {
      const outOfHoursMessage = await getSetting('out_of_hours_message');
      if (outOfHoursMessage) {
        const delay = parseInt(await getSetting('auto_reply_delay_seconds') || '2');

        // Esperar un poco para parecer más humano
        await new Promise(resolve => setTimeout(resolve, delay * 1000));

        // Enviar mensaje
        const response = await sendText({ to: from, body: outOfHoursMessage });
        const waMessageId = response?.messages?.[0]?.id || null;

        // Guardar en BD como mensaje automático
        await saveAutoReplyMessage(conversacionId, outOfHoursMessage, waMessageId);

        // Registrar en log
        await logAutoReply(conversacionId, null, messageText, outOfHoursMessage);
        console.log(`Sent out-of-hours auto-reply to ${from}`);
      }
      return;
    }

    // 4. Buscar regla que coincida con el mensaje
    const rule = await findMatchingRule(messageText);
    if (!rule) return;

    // 5. Enviar respuesta automática
    const delay = parseInt(await getSetting('auto_reply_delay_seconds') || '2');
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

    const response = await sendText({ to: from, body: rule.response_text });
    const waMessageId = response?.messages?.[0]?.id || null;

    // Guardar en BD como mensaje automático
    await saveAutoReplyMessage(conversacionId, rule.response_text, waMessageId);

    // 6. Registrar en log
    await logAutoReply(conversacionId, rule.id, messageText, rule.response_text);
    console.log(`Sent auto-reply "${rule.name}" to ${from}`);

  } catch (error) {
    console.error('Error in processAutoReply:', error);
    // No lanzar error para no interrumpir el flujo del webhook
  }
}



