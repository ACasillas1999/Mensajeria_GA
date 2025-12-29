import type { APIRoute } from 'astro';
import axios from 'axios';
import { z } from 'zod';
import { pool } from '../../../lib/db';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_ACCOUNT_ID = process.env.WABA_ACCOUNT_ID || process.env.WABA_BUSINESS_ID;
const WABA_PHONE_ID = process.env.WABA_PHONE_NUMBER_ID || process.env.WABA_PHONE_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

const buttonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string().min(1).max(25),
  url: z.string().url().optional(),
  phone_number: z.string().optional(),
});

const templateSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: 'Usa solo letras, numeros y guiones bajos, iniciando con letra',
  }),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  language: z.string().min(4).max(10),
  headerText: z.string().max(60).optional().nullable(),
  bodyText: z.string().min(1).max(1024),
  footerText: z.string().max(60).optional().nullable(),
  buttons: z.array(buttonSchema).max(3).optional(),
});

async function resolveWabaId() {
  // Prefer explicit WABA account id
  if (WABA_ACCOUNT_ID) return WABA_ACCOUNT_ID;
  if (!WABA_PHONE_ID) return null;

  try {
    const wabaInfo = await axios.get(
      `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_ID}`,
      {
        headers: { Authorization: `Bearer ${WABA_TOKEN}` },
        params: { fields: 'whatsapp_business_account' },
      }
    );
    return wabaInfo.data?.whatsapp_business_account?.id || null;
  } catch (err) {
    console.error('No se pudo obtener WABA ID desde el phone:', err?.response?.data || err?.message);
    return null;
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user || (user.rol || '').toUpperCase() !== 'ADMIN') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Solo administradores pueden crear plantillas' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!WABA_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Falta WABA_TOKEN en las variables de entorno' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = templateSchema.parse(await request.json());

    const name = payload.name.trim().toLowerCase();
    const language = payload.language.trim();
    const category = payload.category;
    const headerText = payload.headerText?.trim() || null;
    const bodyText = payload.bodyText.trim();
    const footerText = payload.footerText?.trim() || null;
    const buttons = (payload.buttons || []).map((b) => ({
      type: b.type,
      text: b.text.trim(),
      url: b.url?.trim(),
      phone_number: b.phone_number?.trim(),
    }));

    // Validate per-button required fields
    for (const b of buttons) {
      if (b.type === 'URL' && !b.url) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Boton URL requiere el campo url' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (b.type === 'PHONE_NUMBER' && !b.phone_number) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Boton de telefono requiere phone_number' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const wabaId = await resolveWabaId();
    if (!wabaId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo resolver el WABA ID (configura WABA_ACCOUNT_ID o WABA_PHONE_ID)' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const components: any[] = [];
    if (headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
    }
    components.push({ type: 'BODY', text: bodyText });
    if (footerText) {
      components.push({ type: 'FOOTER', text: footerText });
    }
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.type === 'URL' ? { url: b.url } : {}),
          ...(b.type === 'PHONE_NUMBER' ? { phone_number: b.phone_number } : {}),
        })),
      });
    }

    const graphRes = await axios.post(
      `https://graph.facebook.com/${WABA_VERSION}/${wabaId}/message_templates`,
      {
        name,
        category,
        language,
        components,
        allow_category_change: true,
      },
      {
        headers: {
          Authorization: `Bearer ${WABA_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const templateId = graphRes.data?.id || null;
    const status = graphRes.data?.status || 'PENDING';

    let saved = true;
    try {
      await pool.query(
        `INSERT INTO plantillas
         (nombre, idioma, categoria, estado, body_text, header_text, footer_text, buttons, wa_template_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           idioma = VALUES(idioma),
           categoria = VALUES(categoria),
           estado = VALUES(estado),
           body_text = VALUES(body_text),
           header_text = VALUES(header_text),
           footer_text = VALUES(footer_text),
           buttons = VALUES(buttons),
           wa_template_id = VALUES(wa_template_id),
           updated_at = CURRENT_TIMESTAMP`,
        [
          name,
          language,
          category,
          status,
          bodyText,
          headerText,
          footerText,
          buttons.length ? JSON.stringify(buttons) : null,
          templateId,
        ]
      );
    } catch (dbErr) {
      saved = false;
      console.error('No se pudo guardar la plantilla en BD:', dbErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        template_id: templateId,
        status,
        saved,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error creando plantilla:', err?.response?.data || err?.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Error creando plantilla';
    const status = err?.response?.status || 500;
    return new Response(JSON.stringify({ ok: false, error: errorMsg }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
