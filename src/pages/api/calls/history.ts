import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * API para obtener el historial de llamadas de una conversación o todas las llamadas
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversation_id');
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
    const offset = Number(url.searchParams.get('offset') || 0);

    let query = `
      SELECT
        c.id,
        c.conversacion_id,
        c.wa_call_id,
        c.direction,
        c.from_number,
        c.to_number,
        c.status,
        c.duration_seconds,
        c.start_time,
        c.end_time,
        c.usuario_id,
        c.notes,
        u.nombre AS usuario_nombre,
        conv.wa_profile_name,
        conv.wa_user
      FROM whatsapp_calls c
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      LEFT JOIN conversaciones conv ON conv.id = c.conversacion_id
    `;

    const params: any[] = [];

    if (conversationId) {
      query += ' WHERE c.conversacion_id=?';
      params.push(conversationId);
    }

    query += ' ORDER BY c.start_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const calls = rows.map(row => ({
      id: row.id,
      conversation_id: row.conversacion_id,
      call_id: row.wa_call_id,
      direction: row.direction,
      from: row.from_number,
      to: row.to_number,
      status: row.status,
      duration_seconds: row.duration_seconds,
      start_time: row.start_time,
      end_time: row.end_time,
      agent_id: row.usuario_id,
      agent_name: row.usuario_nombre,
      contact_name: row.wa_profile_name,
      contact_number: row.wa_user,
      notes: row.notes
    }));

    // Obtener el total de llamadas para paginación
    let countQuery = 'SELECT COUNT(*) as total FROM whatsapp_calls';
    const countParams: any[] = [];

    if (conversationId) {
      countQuery += ' WHERE conversacion_id=?';
      countParams.push(conversationId);
    }

    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0].total;

    return new Response(
      JSON.stringify({
        ok: true,
        calls,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error fetching call history:', err?.message);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Error al obtener historial' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
