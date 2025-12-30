import type { APIRoute } from 'astro';
import axios from 'axios';
import { pool } from '../../lib/db';

const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_ACCOUNT_ID = process.env.WABA_ACCOUNT_ID || process.env.WABA_BUSINESS_ID;
const WABA_PHONE_ID = process.env.WABA_PHONE_NUMBER_ID || process.env.WABA_PHONE_ID;
const WABA_VERSION = process.env.WABA_VERSION || 'v20.0';

const syncTemplates: APIRoute = async ({ locals }) => {
  try {
    const user = (locals as any).user;
    if (!user || !user.rol || user.rol.toUpperCase() !== 'ADMIN') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Solo administradores pueden sincronizar plantillas' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!WABA_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Falta WABA_TOKEN en las variables de entorno' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Primero obtener el WABA ID desde el Phone Number
    let wabaAccountId;

    try {
      if (WABA_PHONE_ID) {
        console.log('Obteniendo WABA Account ID desde Phone Number...');
        const phoneInfo = await axios.get(
          `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_ID}`,
          {
            headers: { Authorization: `Bearer ${WABA_TOKEN}` },
            params: { fields: 'id,verified_name,code_verification_status,display_phone_number,quality_rating,account_mode' },
          }
        );

        // Intentar obtener el WABA parent
        try {
          const wabaInfo = await axios.get(
            `https://graph.facebook.com/${WABA_VERSION}/${WABA_PHONE_ID}`,
            {
              headers: { Authorization: `Bearer ${WABA_TOKEN}` },
              params: { fields: 'whatsapp_business_account' },
            }
          );
          wabaAccountId = wabaInfo.data?.whatsapp_business_account?.id;
          console.log('WABA Account ID encontrado:', wabaAccountId);
        } catch (e) {
          console.log('No se pudo obtener WABA desde phone, intentando con Business ID directo...');
        }
      }

      // Si no se encontró, usar el Account ID del .env
      if (!wabaAccountId && WABA_ACCOUNT_ID) {
        wabaAccountId = WABA_ACCOUNT_ID;
      }

      if (!wabaAccountId) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'No se pudo obtener el WhatsApp Business Account ID. Verifica tu configuración.',
            help: 'Necesitas agregar WABA_ACCOUNT_ID en el .env o asegurar que tu token tenga permisos para leer la cuenta.'
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Obtener plantillas del WABA Account
      const templatesUrl = `https://graph.facebook.com/${WABA_VERSION}/${wabaAccountId}/message_templates`;
      console.log('Obteniendo plantillas desde:', templatesUrl);

      const response = await axios.get(templatesUrl, {
        headers: { Authorization: `Bearer ${WABA_TOKEN}` },
        params: { limit: 100 },
      });

      const templates = response.data?.data || [];
      let synced = 0;
      let errors = 0;

      for (const tpl of templates) {
      try {
        const nombre = tpl.name;
        const idioma = tpl.language || 'es';
        const categoria = tpl.category || 'MARKETING';
        const estado = tpl.status || 'PENDING';

        // Solo sincronizar plantillas aprobadas
        if (estado !== 'APPROVED') {
          continue;
        }
        const wa_template_id = tpl.id;

        // Extraer componentes
        let body_text = '';
        let header_text = null;
        let header_type = 'NONE';
        let footer_text = null;
        let buttons = null;

        if (tpl.components && Array.isArray(tpl.components)) {
          for (const comp of tpl.components) {
            if (comp.type === 'BODY' && comp.text) {
              body_text = comp.text;
            } else if (comp.type === 'HEADER') {
              // Header puede ser TEXT, IMAGE, VIDEO, DOCUMENT
              if (comp.format) {
                header_type = comp.format.toUpperCase();
                if (comp.text) {
                  header_text = comp.text;
                }
              } else if (comp.text) {
                header_type = 'TEXT';
                header_text = comp.text;
              }
            } else if (comp.type === 'FOOTER' && comp.text) {
              footer_text = comp.text;
            } else if (comp.type === 'BUTTONS' && comp.buttons) {
              buttons = JSON.stringify(comp.buttons);
            }
          }
        }

        // Insertar o actualizar en BD
        await pool.query(
          `INSERT INTO plantillas
           (nombre, idioma, categoria, estado, body_text, header_type, header_text, footer_text, buttons, wa_template_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             idioma = VALUES(idioma),
             categoria = VALUES(categoria),
             estado = VALUES(estado),
             body_text = VALUES(body_text),
             header_type = VALUES(header_type),
             header_text = VALUES(header_text),
             footer_text = VALUES(footer_text),
             buttons = VALUES(buttons),
             wa_template_id = VALUES(wa_template_id),
             updated_at = CURRENT_TIMESTAMP`,
          [nombre, idioma, categoria, estado, body_text, header_type, header_text, footer_text, buttons, wa_template_id]
        );

        synced++;
      } catch (err) {
        console.error('Error sincronizando plantilla:', tpl.name, err);
        errors++;
      }
    }

      return new Response(
        JSON.stringify({
          ok: true,
          message: `Sincronizadas ${synced} plantillas (${errors} errores)`,
          total: templates.length,
          synced,
          errors,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (innerErr: any) {
      console.error('Error obteniendo plantillas:', innerErr?.response?.data || innerErr?.message);
      return new Response(
        JSON.stringify({
          ok: false,
          error: innerErr?.response?.data?.error?.message || innerErr?.message || 'Error obteniendo plantillas'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    console.error('Error en sync-templates:', err?.response?.data || err?.message);
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Error sincronizando plantillas';
    return new Response(
      JSON.stringify({ ok: false, error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = syncTemplates;
export const GET: APIRoute = syncTemplates;
