import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';

/**
 * GET: Obtener todos los estados
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

    const activeOnly = url.searchParams.get('active') === '1';

    let query = 'SELECT * FROM conversation_statuses';
    if (activeOnly) {
      query += ' WHERE is_active = TRUE';
    }
    query += ' ORDER BY display_order ASC';

    const [rows] = await pool.query(query);

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching conversation statuses:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * POST: Crear nuevo estado
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { name, color, icon, description, display_order } = body;

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El nombre es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO conversation_statuses (name, color, icon, description, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name.trim(),
        color || '#64748b',
        icon || '📋',
        description || null,
        display_order || 0,
      ]
    );

    return new Response(
      JSON.stringify({ ok: true, id: (result as any).insertId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating conversation status:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Ya existe un estado con ese nombre' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * PATCH: Actualizar estado existente
 */
export const PATCH: APIRoute = async ({ request, locals, url }) => {
  try {
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere ID del estado' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { name, color, icon, description, display_order, is_active, is_default } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (is_default !== undefined) {
      // Si se marca como default, quitar default de los demás
      if (is_default) {
        await pool.query('UPDATE conversation_statuses SET is_default = FALSE');
      }
      updates.push('is_default = ?');
      values.push(is_default ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No hay campos para actualizar' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    values.push(id);

    await pool.query(
      `UPDATE conversation_statuses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return new Response(
      JSON.stringify({ ok: true, message: 'Estado actualizado' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating conversation status:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Ya existe un estado con ese nombre' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * DELETE: Eliminar estado (solo si no tiene conversaciones asignadas)
 */
export const DELETE: APIRoute = async ({ locals, url }) => {
  try {
    const user = locals?.user;
    if (!user || String(user.rol || '').toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Se requiere ID del estado' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si es el estado por defecto
    const [defaultCheck] = await pool.query(
      'SELECT is_default FROM conversation_statuses WHERE id = ?',
      [id]
    );

    if ((defaultCheck as any[])[0]?.is_default) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se puede eliminar el estado por defecto' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si hay conversaciones con este estado
    const [count] = await pool.query(
      'SELECT COUNT(*) as total FROM conversaciones WHERE status_id = ?',
      [id]
    );

    if ((count as any[])[0]?.total > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `No se puede eliminar este estado porque tiene ${(count as any[])[0].total} conversaciones asignadas`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await pool.query('DELETE FROM conversation_statuses WHERE id = ?', [id]);

    return new Response(
      JSON.stringify({ ok: true, message: 'Estado eliminado' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error deleting conversation status:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
