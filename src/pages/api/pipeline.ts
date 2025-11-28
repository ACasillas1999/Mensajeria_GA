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

    // Construir query de conversaciones
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
        cs.name AS status_name,
        cs.color AS status_color,
        cs.icon AS status_icon,
        u.nombre AS assigned_to_name,
        u.id AS assigned_to_id
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
