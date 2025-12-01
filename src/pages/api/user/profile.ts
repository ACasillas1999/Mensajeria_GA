import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';

// GET: Obtener datos del perfil del usuario
export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;

    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.activo, s.nombre as sucursal
       FROM usuarios u
       LEFT JOIN sucursales s ON u.sucursal_id = s.id
       WHERE u.id = ?`,
      [userId]
    );

    const users = rows as any[];
    if (users.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = users[0];
    return new Response(JSON.stringify({ ok: true, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Error al obtener perfil' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PATCH: Actualizar datos del perfil (nombre y email)
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;

    const body = await request.json();
    const { nombre, email } = body;

    // Validaciones
    if (!nombre || !email) {
      return new Response(JSON.stringify({ ok: false, error: 'Nombre y email son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Email inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el email no esté en uso por otro usuario
    const [existing] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?',
      [email, userId]
    );

    const existingUsers = existing as any[];
    if (existingUsers.length > 0) {
      return new Response(JSON.stringify({ ok: false, error: 'El email ya está en uso' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Actualizar usuario
    await pool.query(
      'UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?',
      [nombre.trim(), email.trim(), userId]
    );

    return new Response(JSON.stringify({ ok: true, message: 'Perfil actualizado' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Error al actualizar perfil' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
