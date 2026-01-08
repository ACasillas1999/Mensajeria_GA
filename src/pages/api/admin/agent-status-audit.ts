import type { APIRoute } from 'astro';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../../lib/db';

export const GET: APIRoute = async ({ locals, url }) => {
  const user = (locals as any).user as { rol: string } | undefined;
  if (!user || String(user.rol).toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
  }

  const agentIdParam = url.searchParams.get('agent_id');
  const agentId = Number(agentIdParam);
  if (!agentIdParam || Number.isNaN(agentId)) {
    return new Response(JSON.stringify({ ok: false, error: 'agent_id requerido' }), { status: 400 });
  }

  try {
    const [agentRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, nombre, email FROM usuarios WHERE id = ? LIMIT 1',
      [agentId]
    );

    if (agentRows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Agente no encontrado' }), { status: 404 });
    }

    const [statusRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, is_final, is_active, display_order
       FROM conversation_statuses
       WHERE is_active = TRUE
          OR id IN (
            SELECT DISTINCT new_status_id
            FROM conversation_status_history
            WHERE changed_by = ?
          )
       ORDER BY display_order ASC, id ASC`,
      [agentId]
    );

    const [completedCycles] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id AS cycle_id,
        cc.conversation_id,
        cc.cycle_number,
        cc.started_at,
        cc.completed_at,
        c.wa_user,
        c.wa_profile_name
       FROM conversation_cycles cc
       LEFT JOIN conversaciones c ON c.id = cc.conversation_id
       WHERE cc.assigned_to = ?
       ORDER BY cc.started_at DESC`,
      [agentId]
    );

    const [activeConversations] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id AS conversation_id,
        c.cycle_count,
        c.current_cycle_started_at,
        c.wa_user,
        c.wa_profile_name
       FROM conversaciones c
       WHERE c.asignado_a = ?
         AND c.current_cycle_started_at IS NOT NULL`,
      [agentId]
    );

    const [completedCounts] = await pool.query<RowDataPacket[]>(
      `SELECT
        cc.id AS cycle_id,
        csh.new_status_id,
        COUNT(*) AS status_count
       FROM conversation_cycles cc
       JOIN conversation_status_history csh
         ON csh.conversation_id = cc.conversation_id
        AND csh.created_at >= cc.started_at
        AND csh.created_at <= cc.completed_at
       WHERE cc.assigned_to = ?
         AND csh.changed_by = ?
       GROUP BY cc.id, csh.new_status_id`,
      [agentId, agentId]
    );

    const [activeCounts] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.id AS conversation_id,
        csh.new_status_id,
        COUNT(*) AS status_count
       FROM conversaciones c
       JOIN conversation_status_history csh
         ON csh.conversation_id = c.id
        AND csh.created_at >= c.current_cycle_started_at
       WHERE c.asignado_a = ?
         AND c.current_cycle_started_at IS NOT NULL
         AND csh.changed_by = ?
       GROUP BY c.id, csh.new_status_id`,
      [agentId, agentId]
    );

    const countsByCycleId = new Map<string, Record<string, number>>();

    for (const row of completedCounts) {
      if (!row.new_status_id) continue;
      const key = String(row.cycle_id);
      const statusKey = String(row.new_status_id);
      if (!countsByCycleId.has(key)) countsByCycleId.set(key, {});
      countsByCycleId.get(key)![statusKey] = Number(row.status_count || 0);
    }

    for (const row of activeCounts) {
      if (!row.new_status_id) continue;
      const key = `active-${row.conversation_id}`;
      const statusKey = String(row.new_status_id);
      if (!countsByCycleId.has(key)) countsByCycleId.set(key, {});
      countsByCycleId.get(key)![statusKey] = Number(row.status_count || 0);
    }

    const cycles = [
      ...completedCycles.map((cycle) => ({
        cycle_id: String(cycle.cycle_id),
        conversation_id: cycle.conversation_id,
        cycle_number: cycle.cycle_number,
        started_at: cycle.started_at,
        completed_at: cycle.completed_at,
        is_active: false,
        wa_user: cycle.wa_user,
        wa_profile_name: cycle.wa_profile_name,
      })),
      ...activeConversations.map((conv) => ({
        cycle_id: `active-${conv.conversation_id}`,
        conversation_id: conv.conversation_id,
        cycle_number: Number(conv.cycle_count || 0) + 1,
        started_at: conv.current_cycle_started_at,
        completed_at: null,
        is_active: true,
        wa_user: conv.wa_user,
        wa_profile_name: conv.wa_profile_name,
      })),
    ].sort((a, b) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
      return bTime - aTime;
    });

    const summaryCounts: Record<string, number> = {};
    const conversationIds = new Set<number>();

    for (const cycle of cycles) {
      conversationIds.add(Number(cycle.conversation_id));
      const cycleCounts = countsByCycleId.get(cycle.cycle_id) || {};
      for (const [statusId, count] of Object.entries(cycleCounts)) {
        summaryCounts[statusId] = (summaryCounts[statusId] || 0) + Number(count || 0);
      }
    }

    const cyclesWithCounts = cycles.map((cycle) => ({
      ...cycle,
      counts: countsByCycleId.get(cycle.cycle_id) || {},
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        agent: {
          id: agentRows[0].id,
          nombre: agentRows[0].nombre,
          email: agentRows[0].email,
        },
        statuses: statusRows.map((s) => ({
          id: s.id,
          name: s.name,
          is_final: Boolean(s.is_final),
          is_active: Boolean(s.is_active),
          display_order: s.display_order ?? 0,
        })),
        summary: {
          total_conversations: conversationIds.size,
          total_cycles: cycles.length,
          counts: summaryCounts,
        },
        cycles: cyclesWithCounts,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Agent status audit error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || 'Error' }),
      { status: 500 }
    );
  }
};
