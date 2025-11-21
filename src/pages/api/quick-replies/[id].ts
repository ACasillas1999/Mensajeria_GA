import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { z } from 'zod';

// PATCH: Actualizar respuesta rápida
const updateSchema = z.object({
  titulo: z.string().min(1).max(100).optional(),
  contenido: z.string().min(1).max(2000).optional(),
  categoria: z.string().max(50).optional(),
  atajo: z.string().max(20).optional(),
  activo: z.boolean().optional(),
});

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), { status: 401 });
    }

    const id = Number(params.id);
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'ID inválido' }), { status: 400 });
    }

    const body = updateSchema.parse(await request.json());

    const sets: string[] = [];
    const values: any[] = [];

    if (body.titulo !== undefined) { sets.push('titulo = ?'); values.push(body.titulo); }
    if (body.contenido !== undefined) { sets.push('contenido = ?'); values.push(body.contenido); }
    if (body.categoria !== undefined) { sets.push('categoria = ?'); values.push(body.categoria || null); }
    if (body.atajo !== undefined) { sets.push('atajo = ?'); values.push(body.atajo || null); }
    if (body.activo !== undefined) { sets.push('activo = ?'); values.push(body.activo ? 1 : 0); }

    if (sets.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Sin cambios' }), { status: 400 });
    }

    values.push(id);
    await pool.query(`UPDATE respuestas_rapidas SET ${sets.join(', ')} WHERE id = ?`, values);

    return new Response(JSON.stringify({ ok: true }), {
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

// DELETE: Eliminar respuesta rápida
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user || user.rol !== 'ADMIN') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), { status: 403 });
    }

    const id = Number(params.id);
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'ID inválido' }), { status: 400 });
    }

    await pool.query('DELETE FROM respuestas_rapidas WHERE id = ?', [id]);

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

// POST: Incrementar uso (cuando se usa una respuesta rápida)
export const POST: APIRoute = async ({ params }) => {
  try {
    const id = Number(params.id);
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'ID inválido' }), { status: 400 });
    }

    await pool.query('UPDATE respuestas_rapidas SET uso_count = uso_count + 1 WHERE id = ?', [id]);

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
