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
    const { conversacion_id, to, template, lang, params, header_image, header_video, header_document } = body;

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

    // Construir componentes del template
    const components: any[] = [];

    // Agregar header si tiene imagen, video o documento
    if (header_image) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: {
              link: header_image
            }
          }
        ]
      });
    } else if (header_video) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'video',
            video: {
              link: header_video
            }
          }
        ]
      });
    } else if (header_document) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: header_document
            }
          }
        ]
      });
    }

    // Agregar body con parámetros de texto si existen
    if (params && params.length > 0) {
      components.push({
        type: 'body',
        parameters: params.map((p: string) => ({ type: 'text', text: p })),
      });
    }

    // Asignar componentes al template
    if (components.length > 0) {
      payload.template.components = components;
    }

    // DEBUG: Log del payload completo
    console.log('=== ENVIANDO TEMPLATE A WHATSAPP ===');
    console.log('Template:', template);
    console.log('Payload completo:', JSON.stringify(payload, null, 2));
    console.log('====================================');

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
      // Obtener el contenido de la plantilla desde la BD
      const [templateRows] = await pool.query(
        `SELECT body_text, header_text, footer_text FROM plantillas WHERE nombre = ? LIMIT 1`,
        [template]
      );

      let templateContent = `[Plantilla: ${template}]`;
      let shortContent = `[Plantilla: ${template}]`;

      if (templateRows && (templateRows as any[]).length > 0) {
        const tpl = (templateRows as any[])[0];
        // Construir el contenido completo con header, body (con variables reemplazadas) y footer
        let fullContent = '';
        if (tpl.header_text) fullContent += `*${tpl.header_text}*\n\n`;

        // Reemplazar variables en el body_text con los parámetros
        let bodyText = tpl.body_text || '';
        if (params && Array.isArray(params)) {
          params.forEach((paramValue: string, idx: number) => {
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
         VALUES (?, 1, 'template', ?, ?, ?, 'sent', ?)`,
        [conversacion_id, templateContent, waMessageId, now, usuario_id]
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
          [shortContent, now, conversacion_id]
        );
      } else {
        await pool.query(
          `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, status_id=(SELECT id FROM conversation_statuses WHERE is_default=TRUE LIMIT 1) WHERE id=?`,
          [shortContent, now, conversacion_id]
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
