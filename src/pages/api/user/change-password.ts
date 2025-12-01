import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import bcrypt from 'bcryptjs';

// PATCH: Cambiar contraseña del usuario
export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const userId = cookies.get('userId')?.value;
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validaciones
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ ok: false, error: 'Contraseñas requeridas' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener usuario actual
    const [rows] = await pool.query(
      'SELECT id, password_hash FROM usuarios WHERE id = ?',
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

    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return new Response(JSON.stringify({ ok: false, error: 'Contraseña actual incorrecta' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await pool.query(
      'UPDATE usuarios SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );

    return new Response(JSON.stringify({ ok: true, message: 'Contraseña actualizada correctamente' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Error al cambiar contraseña' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
