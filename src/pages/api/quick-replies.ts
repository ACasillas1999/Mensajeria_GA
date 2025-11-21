import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import { z } from 'zod';

// GET: Listar respuestas rápidas
export const GET: APIRoute = async ({ url }) => {
  try {
    const categoria = url.searchParams.get('categoria') || '';
    const search = url.searchParams.get('search') || '';

    let query = 'SELECT * FROM respuestas_rapidas WHERE activo = 1';
    const params: any[] = [];

    if (categoria) {
      query += ' AND categoria = ?';
      params.push(categoria);
    }

    if (search) {
      query += ' AND (titulo LIKE ? OR contenido LIKE ? OR atajo LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY uso_count DESC, titulo ASC';

    const [rows] = await pool.query(query, params);

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

// POST: Crear respuesta rápida
const createSchema = z.object({
  titulo: z.string().min(1).max(100),
  contenido: z.string().min(1).max(2000),
  categoria: z.string().max(50).optional(),
  atajo: z.string().max(20).optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), { status: 401 });
    }

    const body = createSchema.parse(await request.json());

    const [result] = await pool.query(
      `INSERT INTO respuestas_rapidas (titulo, contenido, categoria, atajo, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [body.titulo, body.contenido, body.categoria || null, body.atajo || null, user.sub]
    );

    return new Response(JSON.stringify({ ok: true, id: (result as any).insertId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err?.issues) {
      return new Response(JSON.stringify({ ok: false, error: err.issues.map((i: any) => i.message).join(' | ') }), { status: 400 });
    }
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
