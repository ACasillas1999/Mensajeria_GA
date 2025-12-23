import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';

/**
 * POST: Cambiar estado de una conversación (mantiene compatibilidad con código antiguo)
 * PATCH: Nueva forma recomendada de cambiar estado
 * Ambos registran el cambio en el histórico
 */
async function changeConversationStatus(
  conversationId: number,
  newStatusId: number,
  userId: number,
  userName: string,
  reason?: string,
  fieldData?: string
) {
  // Obtener estado actual
  const [current] = await pool.query(
    'SELECT status_id FROM conversaciones WHERE id = ?',
    [conversationId]
  );

  if ((current as any[]).length === 0) {
    throw new Error('Conversación no encontrada');
  }

  const oldStatusId = (current as any[])[0].status_id;

  // Solo actualizar si realmente cambió
  if (oldStatusId !== newStatusId) {
    // Obtener nombres de estados
    const [oldStatus] = await pool.query(
      'SELECT name, icon FROM conversation_statuses WHERE id = ?',
      [oldStatusId]
    );
    const [newStatus] = await pool.query(
      'SELECT name, icon FROM conversation_statuses WHERE id = ?',
      [newStatusId]
    );

    const oldStatusName = (oldStatus as any[])[0]?.name || 'Sin estado';
    const oldStatusIcon = (oldStatus as any[])[0]?.icon || '';
    const newStatusName = (newStatus as any[])[0]?.name || `Estado ${newStatusId}`;
    const newStatusIcon = (newStatus as any[])[0]?.icon || '';

    // Actualizar estado
    await pool.query('UPDATE conversaciones SET status_id = ? WHERE id = ?', [
      newStatusId,
      conversationId,
    ]);

    // Registrar en histórico
    await pool.query(
      `INSERT INTO conversation_status_history
       (conversation_id, old_status_id, new_status_id, changed_by, change_reason, field_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversationId, oldStatusId, newStatusId, userId, reason || null, fieldData || null]
    );

    // Registrar evento del sistema (visible en el chat)
    const texto = `${userName} cambió el estado de ${oldStatusIcon} ${oldStatusName} a ${newStatusIcon} ${newStatusName}`;
    await pool.query(
      `INSERT INTO conversation_events (conversacion_id, tipo, usuario_id, texto, evento_data)
       VALUES (?, 'cambio_estado', ?, ?, ?)`,
      [
        conversationId,
        userId,
        texto,
        JSON.stringify({
          old_status_id: oldStatusId,
          new_status_id: newStatusId,
          old_status_name: oldStatusName,
          new_status_name: newStatusName,
          reason: reason || null,
          field_data: fieldData ? JSON.parse(fieldData) : null
        })
      ]
    );
  }

  // Obtener nombre del nuevo estado
  const [newStatus] = await pool.query(
    'SELECT name FROM conversation_statuses WHERE id = ?',
    [newStatusId]
  );

  return (newStatus as any[])[0]?.name || newStatusId;
}

/**
 * POST: Cambiar estado (compatibilidad con código antiguo que usa estado_actual)
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number; rol: string; nombre: string } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { id, estado } = body; // formato antiguo: { id, estado: 'NUEVA'|'ABIERTA'|'RESUELTA' }

    if (!id || !estado) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere id y estado' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mapear nombre de estado antiguo a ID del nuevo sistema
    const [statusRow] = await pool.query(
      'SELECT id FROM conversation_statuses WHERE UPPER(name) = UPPER(?) AND is_active = TRUE LIMIT 1',
      [estado]
    );

    if ((statusRow as any[]).length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: `Estado "${estado}" no encontrado` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statusId = (statusRow as any[])[0].id;

    // Verificar permisos: admin puede actualizar cualquiera; otros solo si están asignados
    if (String(user.rol || '').toLowerCase() !== 'admin') {
      const [rows] = await pool.query(
        'SELECT asignado_a FROM conversaciones WHERE id = ? LIMIT 1',
        [id]
      );
      if ((rows as any[]).length === 0 || (rows as any[])[0].asignado_a !== user.id) {
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    await changeConversationStatus(id, statusId, user.id, user.nombre);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error changing conversation status (POST):', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * PATCH: Cambiar estado de una conversación usando status_id directamente
 * Registra el cambio en el histórico
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number; rol: string; nombre: string } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { conversation_id, status_id, reason, field_data } = body;

    if (!conversation_id || !status_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere conversation_id y status_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statusName = await changeConversationStatus(conversation_id, status_id, user.id, user.nombre, reason, field_data);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Estado cambiado a: ${statusName}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error changing conversation status (PATCH):', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * GET: Obtener histórico de cambios de estado de una conversación
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conversationId = url.searchParams.get('conversation_id');
    if (!conversationId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere conversation_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [rows] = await pool.query(
      `SELECT
        h.*,
        old_s.name AS old_status_name,
        old_s.color AS old_status_color,
        old_s.icon AS old_status_icon,
        new_s.name AS new_status_name,
        new_s.color AS new_status_color,
        new_s.icon AS new_status_icon,
        u.nombre AS changed_by_name
       FROM conversation_status_history h
       LEFT JOIN conversation_statuses old_s ON h.old_status_id = old_s.id
       LEFT JOIN conversation_statuses new_s ON h.new_status_id = new_s.id
       LEFT JOIN usuarios u ON h.changed_by = u.id
       WHERE h.conversation_id = ?
       ORDER BY h.created_at DESC`,
      [conversationId]
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching status history:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
