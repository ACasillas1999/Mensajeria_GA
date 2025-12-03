import type { APIRoute } from 'astro';
import axios from 'axios';
import { pool } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_ID = process.env.WABA_PHONE_NUMBER_ID || process.env.WABA_PHONE_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

/**
 * API para iniciar una llamada desde el negocio a un usuario
 * Requiere que el usuario haya dado permiso previamente
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { conversation_id, to } = body;

    if (!conversation_id || !to) {
      return new Response(
        JSON.stringify({ ok: false, error: 'conversation_id y to son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que la conversación existe
    const [conv] = await pool.query<RowDataPacket[]>(
      'SELECT id, wa_user FROM conversaciones WHERE id=?',
      [conversation_id]
    );

    if (!conv.length) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Conversación no encontrada' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar permisos de llamada (opcional - solo advertir si hay problemas)
    const [perm] = await pool.query<RowDataPacket[]>(
      `SELECT permission_status, consecutive_unanswered, permission_expires_at
       FROM call_permissions
       WHERE conversacion_id=?`,
      [conversation_id]
    );

    // Verificar límite de llamadas consecutivas sin respuesta si existe el registro
    if (perm.length && perm[0].consecutive_unanswered >= 4) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Se ha alcanzado el límite de llamadas sin respuesta consecutivas.',
          code: 'TOO_MANY_UNANSWERED'
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar límite diario de llamadas por usuario
    const [settings] = await pool.query<RowDataPacket[]>(
      'SELECT setting_value FROM call_settings WHERE setting_key=?',
      ['max_daily_calls_per_user']
    );
    const maxDailyCalls = settings.length ? parseInt(settings[0].setting_value) : 10;

    const [callCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM whatsapp_calls
       WHERE conversacion_id=? AND direction='outbound' AND start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [conversation_id]
    );

    if (callCount[0].count >= maxDailyCalls) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Se ha alcanzado el límite de ${maxDailyCalls} llamadas por día para este usuario`,
          code: 'DAILY_LIMIT_REACHED'
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Iniciar la llamada a través de la API de WhatsApp
    const callUrl = `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_ID}/calls`;

    const response = await axios.post(
      callUrl,
      {
        to,
        type: 'voice'
      },
      {
        headers: {
          'Authorization': `Bearer ${WABA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const callId = response.data?.id;

    if (!callId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo iniciar la llamada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Registrar la llamada en la base de datos
    await pool.query(
      `INSERT INTO whatsapp_calls
       (conversacion_id, wa_call_id, direction, from_number, to_number, status, start_time, usuario_id)
       VALUES (?, ?, 'outbound', ?, ?, 'initiated', NOW(), ?)`,
      [conversation_id, callId, WABA_PHONE_ID, to, user.sub]
    );

    return new Response(
      JSON.stringify({
        ok: true,
        call_id: callId,
        message: 'Llamada iniciada correctamente'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error initiating call:', err?.response?.data || err?.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Error al iniciar llamada';
    return new Response(
      JSON.stringify({ ok: false, error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
