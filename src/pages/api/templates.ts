import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import { z } from 'zod';
import axios from 'axios';
import { mapWaError } from '../../lib/waErrorMap';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WABA_PHONE_NUMBER_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

// GET: Listar plantillas
export const GET: APIRoute = async ({ url }) => {
  try {
    const estado = url.searchParams.get('estado') || '';
    const categoria = url.searchParams.get('categoria') || '';

    let query = 'SELECT * FROM plantillas WHERE 1=1';
    const params: any[] = [];

    if (estado) {
      query += ' AND estado = ?';
      params.push(estado);
    }

    if (categoria) {
      query += ' AND categoria = ?';
      params.push(categoria);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Crear plantilla (local) o enviar template message
const sendTemplateSchema = z.object({
  to: z.string().min(10),
  template_name: z.string().min(1),
  language_code: z.string().default('es'),
  conversacion_id: z.number().optional(),
  variables: z.array(z.string()).optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), { status: 401 });
    }

    const body = sendTemplateSchema.parse(await request.json());

    // Construir componentes con variables
    const components: any[] = [];
    if (body.variables && body.variables.length > 0) {
      components.push({
        type: 'body',
        parameters: body.variables.map(v => ({ type: 'text', text: v })),
      });
    }

    // Enviar a WhatsApp
    const waRes = await axios.post(
      `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: body.to,
        type: 'template',
        template: {
          name: body.template_name,
          language: { code: body.language_code },
          components: components.length > 0 ? components : undefined,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WABA_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const waMessageId = waRes.data?.messages?.[0]?.id;

    // Guardar en BD si hay conversacion_id
    if (body.conversacion_id && waMessageId) {
      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status)
         VALUES (?, 1, 'template', ?, ?, UNIX_TIMESTAMP(), 'sent')`,
        [body.conversacion_id, `[Plantilla: ${body.template_name}]`, waMessageId]
      );

      await pool.query(
        `UPDATE conversaciones SET ultimo_msg = ?, ultimo_ts = UNIX_TIMESTAMP() WHERE id = ?`,
        [`[Plantilla: ${body.template_name}]`, body.conversacion_id]
      );
    }

    return new Response(JSON.stringify({ ok: true, wa_msg_id: waMessageId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const isAxios = axios.isAxiosError(err);
    const status = (isAxios && err.response?.status) || 500;
    const payload = isAxios ? mapWaError(err.response?.data?.error) : { message: err?.message || 'Error' };
    console.error('Error enviando template:', payload, err?.response?.data || err?.message);
    return new Response(JSON.stringify({ ok: false, error: payload }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
