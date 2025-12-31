import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import { z } from 'zod';
import axios from 'axios';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WABA_PHONE_NUMBER_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

const startConversationSchema = z.object({
  phone: z.string().min(10),
  template_name: z.string().min(1),
  language_code: z.string().default('es'),
  variables: z.array(z.string()).optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), { status: 401 });
    }

    const body = startConversationSchema.parse(await request.json());

    // Limpiar número de teléfono (quitar espacios, guiones, etc)
    const cleanPhone = body.phone.replace(/\D/g, '');

    // Verificar si ya existe conversación con este número
    const [existing] = await pool.query(
      'SELECT id FROM conversaciones WHERE wa_user = ? LIMIT 1',
      [cleanPhone]
    ) as any;

    let conversacion_id: number;

    if (existing && existing.length > 0) {
      // Ya existe la conversación
      conversacion_id = existing[0].id;
    } else {
      // Crear nueva conversación
      const [result] = await pool.query(
        `INSERT INTO conversaciones (wa_user, estado, ultimo_ts)
         VALUES (?, 'NUEVA', UNIX_TIMESTAMP())`,
        [cleanPhone]
      ) as any;
      conversacion_id = result.insertId;
    }

    // Construir componentes con variables
    const components: any[] = [];
    if (body.variables && body.variables.length > 0) {
      components.push({
        type: 'body',
        parameters: body.variables.map(v => ({ type: 'text', text: v })),
      });
    }

    // Enviar plantilla a WhatsApp
    const waRes = await axios.post(
      `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
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

    // Guardar mensaje en BD
    if (waMessageId) {
      // Obtener el contenido de la plantilla desde la BD
      const [templateRows] = await pool.query(
        `SELECT body_text, header_text, footer_text FROM plantillas WHERE nombre = ? LIMIT 1`,
        [body.template_name]
      );

      let templateContent = `[Plantilla: ${body.template_name}]`;
      let shortContent = `[Plantilla: ${body.template_name}]`;

      if (templateRows && (templateRows as any[]).length > 0) {
        const tpl = (templateRows as any[])[0];
        // Construir el contenido completo con header, body (con variables reemplazadas) y footer
        let fullContent = '';
        if (tpl.header_text) fullContent += `*${tpl.header_text}*\n\n`;

        // Reemplazar variables en el body_text con los parámetros
        let bodyText = tpl.body_text || '';
        if (body.variables && Array.isArray(body.variables)) {
          body.variables.forEach((paramValue: string, idx: number) => {
            bodyText = bodyText.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), paramValue);
          });
        }
        fullContent += bodyText;

        if (tpl.footer_text) fullContent += `\n\n_${tpl.footer_text}_`;

        templateContent = fullContent;
        // Para el preview en la lista, usar solo las primeras 60 caracteres del body
        shortContent = bodyText.substring(0, 60) + (bodyText.length > 60 ? '...' : '');
      }

      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, usuario_id)
         VALUES (?, 1, 'template', ?, ?, UNIX_TIMESTAMP(), 'sent', ?)`,
        [conversacion_id, templateContent, waMessageId, user.id]
      );

      await pool.query(
        `UPDATE conversaciones SET ultimo_msg = ?, ultimo_ts = UNIX_TIMESTAMP() WHERE id = ?`,
        [shortContent, conversacion_id]
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      conversacion_id,
      wa_msg_id: waMessageId
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error iniciando conversación:', err?.response?.data || err?.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Error iniciando conversación';
    return new Response(JSON.stringify({ ok: false, error: errorMsg }), {
      status: err?.response?.status || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
