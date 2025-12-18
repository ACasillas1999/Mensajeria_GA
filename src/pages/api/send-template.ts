import type { APIRoute } from 'astro';
import axios from 'axios';
import { pool } from '../../lib/db';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WABA_PHONE_NUMBER_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    const usuario_id = user?.id || null;

    const body = await request.json();
    const { conversacion_id, to, template, lang, params } = body;

    if (!to || !template) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Faltan parámetros: to y template son requeridos' }),
        { status: 400 }
      );
    }

    // Construir el payload para WhatsApp
    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: lang || 'es' },
      },
    };

    // Agregar parámetros si existen
    if (params && params.length > 0) {
      payload.template.components = [
        {
          type: 'body',
          parameters: params.map((p: string) => ({ type: 'text', text: p })),
        },
      ];
    }

    // Enviar a WhatsApp
    const waRes = await axios.post(
      `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WABA_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const waMessageId = waRes.data?.messages?.[0]?.id;
    const now = Math.floor(Date.now() / 1000);

    // Guardar en BD si hay conversacion_id
    if (conversacion_id && waMessageId) {
      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, usuario_id)
         VALUES (?, 1, 'template', ?, ?, ?, 'sent', ?)`,
        [conversacion_id, `[Plantilla: ${template}]`, waMessageId, now, usuario_id]
      );

      // Actualizar conversación
      const [statusCheck] = await pool.query(
        `SELECT status_id FROM conversaciones WHERE id=?`,
        [conversacion_id]
      );
      const currentStatusId = (statusCheck as any[])[0]?.status_id;

      if (currentStatusId) {
        await pool.query(
          `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=? WHERE id=?`,
          [`[Plantilla: ${template}]`, now, conversacion_id]
        );
      } else {
        await pool.query(
          `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, status_id=(SELECT id FROM conversation_statuses WHERE is_default=TRUE LIMIT 1) WHERE id=?`,
          [`[Plantilla: ${template}]`, now, conversacion_id]
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, wa_msg_id: waMessageId, data: waRes.data }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error enviando template:', err?.response?.data || err?.message);
    const isAxios = axios.isAxiosError(err);
    const status = (isAxios && err.response?.status) || 500;
    const errorMsg =
      err?.response?.data?.error?.message || err?.message || 'Error enviando plantilla';

    return new Response(JSON.stringify({ ok: false, error: { message: errorMsg } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
