import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';

function requireAdmin(locals: any): { ok: boolean; error?: string } {
  const user = locals?.user;
  if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
    return { ok: false, error: 'No autorizado' };
  }
  return { ok: true };
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const search = (url.searchParams.get('q') || '').trim();
    const resolvedParam = url.searchParams.get('resolved');
    const from = (url.searchParams.get('from') || '').slice(0, 10);
    const to = (url.searchParams.get('to') || '').slice(0, 10);

    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: any[] = [];

    if (resolvedParam === '0') {
      where.push('um.resolved = 0');
    } else if (resolvedParam === '1') {
      where.push('um.resolved = 1');
    }

    if (from) {
      where.push('um.created_at >= ?');
      params.push(from + ' 00:00:00');
    }
    if (to) {
      where.push('um.created_at <= ?');
      params.push(to + ' 23:59:59');
    }

    if (search) {
      where.push('um.message_text LIKE ?');
      params.push(`%${search}%`);
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.query(
      `
      SELECT
        um.*,
        c.numero as conversacion_numero,
        ar.name as closest_match_name
      FROM unrecognized_messages um
      LEFT JOIN conversaciones c ON um.conversacion_id = c.id
      LEFT JOIN auto_replies ar ON um.closest_match_id = ar.id
      ${whereSql}
      ORDER BY um.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM unrecognized_messages um ${whereSql}`,
      params
    );
    const total = (countRows as any[])[0]?.total ?? 0;

    const [statsRows] = await pool.query(
      `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as pending_count
      FROM unrecognized_messages
      `
    );
    const stats = (statsRows as any[])[0] || { total: 0, resolved_count: 0, pending_count: 0 };

    const [topRows] = await pool.query(
      `
      SELECT
        LOWER(TRIM(SUBSTRING(message_text, 1, 200))) as text_snippet,
        COUNT(*) as count
      FROM unrecognized_messages
      GROUP BY text_snippet
      HAVING COUNT(*) >= 1
      ORDER BY count DESC
      LIMIT 10
      `
    );

    return new Response(
      JSON.stringify({
        ok: true,
        items: rows,
        pagination: { page, pageSize, total },
        stats,
        top: topRows,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const body = await request.json();
    const id = Number(body?.id || 0);
    const resolved = body?.resolved;

    if (!Number.isFinite(id) || id <= 0) {
      return new Response(JSON.stringify({ ok: false, error: 'id requerido' }), { status: 400 });
    }

    if (resolved === undefined) {
      return new Response(JSON.stringify({ ok: false, error: 'resolved requerido' }), {
        status: 400,
      });
    }

    await pool.query('UPDATE unrecognized_messages SET resolved = ? WHERE id = ?', [
      resolved ? 1 : 0,
      id,
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

