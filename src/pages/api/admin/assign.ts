import type { APIRoute } from "astro";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { id: number; rol: string; nombre: string } | undefined;
  if (!user || (user.rol || '').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
  }
  const { conversacion_id, user_id } = await request.json();
  if (!conversacion_id) return new Response(JSON.stringify({ ok: false, error: "conversacion_id requerido" }), { status: 400 });

  // Obtener el asignado actual antes de cambiar
  const [convRows] = await pool.query<RowDataPacket[]>(
    "SELECT asignado_a FROM conversaciones WHERE id = ?",
    [conversacion_id]
  );
  const asignadoAnterior = convRows[0]?.asignado_a || null;

  const [res] = await pool.execute<ResultSetHeader>(
    "UPDATE conversaciones SET asignado_a = ? WHERE id = ?",
    [user_id ?? null, conversacion_id]
  );

  if (res.affectedRows > 0) {
    try {
      // Obtener nombres de usuarios
      let nombreNuevo = null;
      let nombreAnterior = null;

      if (user_id) {
        const [nuevoRows] = await pool.query<RowDataPacket[]>(
          "SELECT nombre FROM usuarios WHERE id = ?",
          [user_id]
        );
        nombreNuevo = nuevoRows[0]?.nombre || `Usuario ${user_id}`;
      }

      if (asignadoAnterior) {
        const [anteriorRows] = await pool.query<RowDataPacket[]>(
          "SELECT nombre FROM usuarios WHERE id = ?",
          [asignadoAnterior]
        );
        nombreAnterior = anteriorRows[0]?.nombre || `Usuario ${asignadoAnterior}`;
      }

      // Determinar el texto del evento
      let texto = '';
      let tipoEvento: 'asignacion' | 'reasignacion' = 'asignacion';

      if (!asignadoAnterior && user_id) {
        // Nueva asignación
        texto = `Conversación asignada a ${nombreNuevo} por ${user.nombre}`;
        tipoEvento = 'asignacion';
      } else if (asignadoAnterior && user_id && asignadoAnterior !== user_id) {
        // Reasignación
        texto = `Conversación reasignada de ${nombreAnterior} a ${nombreNuevo} por ${user.nombre}`;
        tipoEvento = 'reasignacion';
      } else if (asignadoAnterior && !user_id) {
        // Desasignación
        texto = `Conversación desasignada de ${nombreAnterior} por ${user.nombre}`;
        tipoEvento = 'asignacion';
      }

      // Registrar evento del sistema
      if (texto) {
        await pool.execute(
          `INSERT INTO conversation_events (conversacion_id, tipo, usuario_id, texto, evento_data)
           VALUES (?, ?, ?, ?, ?)`,
          [
            conversacion_id,
            tipoEvento,
            user.id,
            texto,
            JSON.stringify({
              asignado_anterior: asignadoAnterior,
              asignado_nuevo: user_id,
              nombre_anterior: nombreAnterior,
              nombre_nuevo: nombreNuevo
            })
          ]
        );
      }

      // Si se asignó a un usuario (no se desasignó), crear notificación
      if (user_id) {
        await pool.execute(
          `INSERT INTO agent_notifications (usuario_id, conversacion_id, tipo, leida)
           VALUES (?, ?, 'asignacion', FALSE)`,
          [user_id, conversacion_id]
        );

        // Enviar notificación por WhatsApp si está configurada
        try {
          // Obtener configuración de plantilla de asignación
          const [slaConfig] = await pool.query<RowDataPacket[]>(
            'SELECT assignment_template_name FROM sla_settings LIMIT 1'
          );

          const assignmentTemplate = slaConfig[0]?.assignment_template_name;

          if (assignmentTemplate) {
            // Obtener teléfono del agente
            const [agenteRows] = await pool.query<RowDataPacket[]>(
              'SELECT telefono FROM usuarios WHERE id = ? AND telefono IS NOT NULL',
              [user_id]
            );

            if (agenteRows.length > 0) {
              const agenteTelefono = agenteRows[0].telefono;

              // Obtener datos de la conversación
              const [convData] = await pool.query<RowDataPacket[]>(
                `SELECT c.wa_user, c.wa_profile_name, m.cuerpo as last_msg
                 FROM conversaciones c
                 LEFT JOIN mensajes m ON c.id = m.conversacion_id
                 WHERE c.id = ?
                 ORDER BY m.ts DESC LIMIT 1`,
                [conversacion_id]
              );

              if (convData.length > 0) {
                const conv = convData[0];

                // Construir variables
                let clienteInfo = conv.wa_profile_name || conv.wa_user;
                if (!clienteInfo || clienteInfo.trim().length <= 1 || /^[.\-_]+$/.test(clienteInfo)) {
                  clienteInfo = conv.wa_user || "Cliente";
                }
                if (clienteInfo && /^\d{11,}$/.test(clienteInfo.replace(/\D/g, ''))) {
                  const digits = clienteInfo.replace(/\D/g, '');
                  clienteInfo = digits.slice(-10);
                }

                // Detectar cuántas variables necesita la plantilla
                const [tplRows] = await pool.query<RowDataPacket[]>(
                  'SELECT body_text, idioma FROM plantillas WHERE nombre = ?',
                  [assignmentTemplate]
                );

                const bodyText = tplRows[0]?.body_text || '';
                const templateLanguage = tplRows[0]?.idioma || 'es_MX';
                const varMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
                const varCount = varMatches.length;

                // Construir solo las variables necesarias
                const allVariables = [
                  nombreNuevo || "Agente",
                  clienteInfo,
                  `#${conversacion_id}`,
                  conv.last_msg?.substring(0, 50) || "Sin mensajes",
                  new Date().toLocaleString('es-MX')
                ];

                const variables = allVariables.slice(0, varCount);

                // Enviar WhatsApp
                const WABA_TOKEN = process.env.WABA_TOKEN;
                const WABA_PHONE_ID = process.env.WABA_PHONE_ID || process.env.WABA_PHONE_NUMBER_ID;

                if (WABA_TOKEN && WABA_PHONE_ID) {
                  const axios = (await import('axios')).default;
                  const cleanTo = agenteTelefono.replace(/\D/g, '');

                  const payload: any = {
                    messaging_product: "whatsapp",
                    to: cleanTo,
                    type: "template",
                    template: {
                      name: assignmentTemplate,
                      language: { code: templateLanguage },
                      components: [
                        {
                          type: "body",
                          parameters: variables.map(v => ({ type: "text", text: v }))
                        }
                      ]
                    }
                  };

                  try {
                    await axios.post(
                      `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/messages`,
                      payload,
                      { headers: { 'Authorization': `Bearer ${WABA_TOKEN}`, 'Content-Type': 'application/json' } }
                    );

                    // Registrar en log
                    await pool.query(
                      `INSERT INTO sla_notification_log 
                       (conversacion_id, destinatario_nombre, destinatario_telefono, template_name, variables, enviado_exitosamente)
                       VALUES (?, ?, ?, ?, ?, TRUE)`,
                      [conversacion_id, nombreNuevo, cleanTo, assignmentTemplate, JSON.stringify(variables)]
                    );
                  } catch (waError: any) {
                    console.error('Error enviando WhatsApp de asignación:', waError?.response?.data || waError?.message);
                    // Registrar error en log
                    await pool.query(
                      `INSERT INTO sla_notification_log 
                       (conversacion_id, destinatario_nombre, destinatario_telefono, template_name, variables, enviado_exitosamente, error_mensaje)
                       VALUES (?, ?, ?, ?, ?, FALSE, ?)`,
                      [conversacion_id, nombreNuevo, cleanTo, assignmentTemplate, JSON.stringify(variables), waError?.response?.data?.error?.message || waError?.message]
                    );
                  }
                }
              }
            }
          }
        } catch (notifError) {
          console.error('Error en notificación de WhatsApp:', notifError);
          // No fallar la asignación si falla la notificación
        }
      }
    } catch (e) {
      console.error('Error creating assignment notification/event:', e);
      // No fallar la asignación si falla la notificación o evento
    }
  }

  return new Response(JSON.stringify({ ok: true, affected: res.affectedRows }), { headers: { "Content-Type": "application/json" } });
};
