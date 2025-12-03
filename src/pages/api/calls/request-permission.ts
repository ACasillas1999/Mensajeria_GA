import type { APIRoute } from 'astro';
import axios from 'axios';
import { pool } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_ID = process.env.WABA_PHONE_NUMBER_ID || process.env.WABA_PHONE_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

/**
 * API para solicitar permiso al usuario para poder llamarlo
 * Envía un mensaje de permiso que el usuario debe aprobar
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

    // Verificar si ya existe un permiso activo
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id, permission_status, permission_requested_at
       FROM call_permissions
       WHERE conversacion_id=?`,
      [conversation_id]
    );

    if (existing.length && existing[0].permission_status === 'approved') {
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'El usuario ya ha dado permiso para llamadas',
          status: 'approved'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar límite de solicitudes (1 por día, 2 por semana según la doc)
    if (existing.length) {
      const lastRequest = new Date(existing[0].permission_requested_at);
      const hoursSinceLastRequest = (Date.now() - lastRequest.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastRequest < 24) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Solo se puede solicitar permiso una vez cada 24 horas',
            code: 'RATE_LIMIT'
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Enviar solicitud de permiso a través de la API de WhatsApp
    const messageUrl = `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_ID}/messages`;

    const response = await axios.post(
      messageUrl,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'call_permission_request',
          body: {
            text: 'Nos gustaría poder llamarte por WhatsApp para brindarte un mejor servicio. ¿Nos autorizas a hacerlo?'
          },
          action: {
            name: 'request_call_permission'
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WABA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const messageId = response.data?.messages?.[0]?.id;

    if (!messageId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo enviar la solicitud de permiso' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Registrar o actualizar el permiso en la base de datos
    if (existing.length) {
      await pool.query(
        `UPDATE call_permissions
         SET permission_status='pending', permission_requested_at=NOW(), actualizado_en=NOW()
         WHERE conversacion_id=?`,
        [conversation_id]
      );
    } else {
      const [conv] = await pool.query<RowDataPacket[]>(
        'SELECT wa_user FROM conversaciones WHERE id=?',
        [conversation_id]
      );

      await pool.query(
        `INSERT INTO call_permissions
         (conversacion_id, wa_user, permission_status, permission_requested_at)
         VALUES (?, ?, 'pending', NOW())`,
        [conversation_id, conv[0].wa_user]
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message_id: messageId,
        message: 'Solicitud de permiso enviada correctamente'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error requesting call permission:', err?.response?.data || err?.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Error al solicitar permiso';
    return new Response(
      JSON.stringify({ ok: false, error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
