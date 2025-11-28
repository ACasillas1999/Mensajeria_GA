import type { APIRoute } from 'astro';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const user = (locals as any).user as { rol: string } | undefined;
  if (!user || String(user.rol).toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
  }

  try {
    // Métricas por agente
    const [agentStats] = await pool.query<RowDataPacket[]>(`
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.sucursal_id,
        s.nombre AS sucursal,

        -- Conversaciones asignadas
        COUNT(DISTINCT c.id) AS total_conversaciones,

        -- Mensajes enviados
        COUNT(DISTINCT m.id) AS mensajes_enviados_total,
        SUM(CASE WHEN m.ts >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) THEN 1 ELSE 0 END) AS mensajes_hoy,
        SUM(CASE WHEN m.ts >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY)) THEN 1 ELSE 0 END) AS mensajes_semana,

        -- Última actividad
        MAX(m.ts) AS ultima_actividad_ts

      FROM usuarios u
      LEFT JOIN sucursales s ON s.id = u.sucursal_id
      LEFT JOIN conversaciones c ON c.asignado_a = u.id
      LEFT JOIN mensajes m ON m.conversacion_id = c.id AND m.from_me = 1
      WHERE u.rol != 'admin'
      GROUP BY u.id, u.nombre, u.email, u.sucursal_id, s.nombre
      ORDER BY u.nombre
    `);

    // Conversaciones activas en este momento (con actividad reciente)
    const [activeChats] = await pool.query<RowDataPacket[]>(`
      SELECT
        c.id AS conversacion_id,
        c.wa_user,
        c.wa_profile_name,
        c.estado,
        c.status_id,
        cs.name AS status_name,
        cs.color AS status_color,
        cs.icon AS status_icon,
        c.asignado_a,
        u.nombre AS agente_nombre,
        c.ultimo_msg,
        c.ultimo_ts,
        CASE WHEN c.ultimo_ts >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 5 MINUTE)) THEN 1 ELSE 0 END AS activo_ahora
      FROM conversaciones c
      LEFT JOIN usuarios u ON u.id = c.asignado_a
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      WHERE c.asignado_a IS NOT NULL
        AND c.ultimo_ts >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 HOUR))
      ORDER BY c.ultimo_ts DESC
    `);

    return new Response(
      JSON.stringify({
        ok: true,
        agents: agentStats,
        activeChats: activeChats,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Agent metrics error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || 'Error' }),
      { status: 500 }
    );
  }
};
