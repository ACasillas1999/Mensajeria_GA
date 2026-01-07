import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';

/**
 * GET: Obtener conversaciones agrupadas por estado para vista Pipeline
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const user = locals?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filtros opcionales
    const assignedToMe = url.searchParams.get('assigned_to_me') === '1';
    const assignedTo = url.searchParams.get('assigned_to');

    // Obtener todos los estados activos
    const [statuses] = await pool.query(
      'SELECT * FROM conversation_statuses WHERE is_active = TRUE ORDER BY display_order ASC'
    );

    // Construir query de conversaciones con field_data del historial más reciente
    let conversationsQuery = `
      SELECT
        c.id,
        c.wa_user,
        c.wa_profile_name,
        c.ultimo_msg,
        c.ultimo_ts,
        c.ultimo_msg_entrante_ts,
        c.dentro_ventana_24h,
        c.status_id,
        c.cycle_count,
        cs.name AS status_name,
        cs.color AS status_color,
        cs.icon AS status_icon,
        cs.required_fields,
        u.nombre AS assigned_to_name,
        u.id AS assigned_to_id,
        (
          SELECT csh.field_data
          FROM conversation_status_history csh
          WHERE csh.conversation_id = c.id
            AND csh.new_status_id = c.status_id
            AND csh.field_data IS NOT NULL
          ORDER BY csh.id DESC
          LIMIT 1
        ) AS field_data
      FROM conversaciones c
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      LEFT JOIN usuarios u ON c.asignado_a = u.id
      WHERE cs.is_active = TRUE
    `;

    const params: any[] = [];

    // Filtrar por asignación
    if (assignedToMe) {
      conversationsQuery += ' AND c.asignado_a = ?';
      params.push(user.id);
    } else if (assignedTo) {
      conversationsQuery += ' AND c.asignado_a = ?';
      params.push(assignedTo);
    }

    conversationsQuery += ' ORDER BY c.ultimo_msg_entrante_ts DESC';

    const [conversations] = await pool.query(conversationsQuery, params);

    // Agrupar conversaciones por estado
    const pipeline = (statuses as any[]).map((status) => {
      const statusConversations = (conversations as any[]).filter(
        (c) => c.status_id === status.id
      );

      return {
        status: {
          id: status.id,
          name: status.name,
          color: status.color,
          icon: status.icon,
          display_order: status.display_order,
          required_fields: status.required_fields,
          is_final: status.is_final,
        },
        conversations: statusConversations.map((c) => ({
          id: c.id,
          wa_user: c.wa_user,
          wa_profile_name: c.wa_profile_name,
          ultimo_msg: c.ultimo_msg,
          ultimo_ts: c.ultimo_ts,
          ultimo_msg_entrante_ts: c.ultimo_msg_entrante_ts,
          dentro_ventana_24h: c.dentro_ventana_24h,
          assigned_to_name: c.assigned_to_name,
          assigned_to_id: c.assigned_to_id,
          cycle_count: c.cycle_count, // Número de ciclos completados
          field_data: c.field_data, // Datos de campos personalizados
        })),
        count: statusConversations.length,
      };
    });

    // Métricas generales
    const totalConversations = (conversations as any[]).length;
    const metrics = {
      total: totalConversations,
      by_status: pipeline.map((p) => ({
        status_name: p.status.name,
        count: p.count,
      })),
    };

    return new Response(
      JSON.stringify({
        ok: true,
        pipeline,
        metrics,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching pipeline:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
