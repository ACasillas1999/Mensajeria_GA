import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { z } from 'zod';

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
    const onlyActive = url.searchParams.get('active') === '1';

    let sql = 'SELECT * FROM auto_replies';
    const params: any[] = [];
    const where: string[] = [];

    if (onlyActive) {
      where.push('is_active = 1');
    }

    if (search) {
      where.push('(name LIKE ? OR trigger_keywords LIKE ? OR response_text LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY is_active DESC, priority DESC, id ASC';

    const [rows] = await pool.query(sql, params);

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  trigger_keywords: z.string().min(1),
  response_text: z.string().min(1),
  priority: z.number().int().min(0).max(999).default(0),
  match_type: z.enum(['exact', 'contains', 'starts_with']).default('contains'),
  case_sensitive: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const data = await request.json();
    const body = ruleSchema.parse({
      ...data,
      priority: data.priority !== undefined ? Number(data.priority) : undefined,
    });

    const [result] = await pool.query(
      `INSERT INTO auto_replies
       (name, trigger_keywords, response_text, is_active, priority, match_type, case_sensitive)
       VALUES (?,?,?,?,?,?,?)`,
      [
        body.name,
        body.trigger_keywords,
        body.response_text,
        body.is_active ? 1 : 0,
        body.priority,
        body.match_type,
        body.case_sensitive ? 1 : 0,
      ]
    );

    return new Response(JSON.stringify({ ok: true, id: (result as any).insertId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err?.issues) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err.issues.map((i: any) => i.message).join(' | '),
        }),
        { status: 400 }
      );
    }
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

const idFromUrl = (url: URL) => {
  const idStr = url.searchParams.get('id');
  const id = idStr ? Number(idStr) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
};

export const PATCH: APIRoute = async ({ request, url, locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const id = idFromUrl(url);
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'id requerido' }), { status: 400 });
    }

    const data = await request.json();

    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(String(data.name).slice(0, 100));
    }
    if (data.trigger_keywords !== undefined) {
      fields.push('trigger_keywords = ?');
      params.push(String(data.trigger_keywords));
    }
    if (data.response_text !== undefined) {
      fields.push('response_text = ?');
      params.push(String(data.response_text));
    }
    if (data.priority !== undefined) {
      fields.push('priority = ?');
      params.push(Number(data.priority) || 0);
    }
    if (data.match_type !== undefined) {
      fields.push('match_type = ?');
      params.push(String(data.match_type));
    }
    if (data.case_sensitive !== undefined) {
      fields.push('case_sensitive = ?');
      params.push(data.case_sensitive ? 1 : 0);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(data.is_active ? 1 : 0);
    }

    if (!fields.length) {
      return new Response(JSON.stringify({ ok: false, error: 'Sin cambios' }), { status: 400 });
    }

    params.push(id);

    await pool.query(`UPDATE auto_replies SET ${fields.join(', ')} WHERE id = ?`, params);

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

export const DELETE: APIRoute = async ({ url, locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: 403 });
    }

    const id = idFromUrl(url);
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'id requerido' }), { status: 400 });
    }

    await pool.query('DELETE FROM auto_replies WHERE id = ?', [id]);

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

