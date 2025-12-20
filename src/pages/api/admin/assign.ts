import type { APIRoute } from "astro";
import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { rol: string } | undefined;
  if (!user || (user.rol || '').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  const { conversacion_id, user_id } = await request.json();
  if (!conversacion_id) return new Response(JSON.stringify({ ok:false, error:"conversacion_id requerido" }), { status:400 });

  const [res] = await pool.execute<ResultSetHeader>(
    "UPDATE conversaciones SET asignado_a = ? WHERE id = ?",
    [user_id ?? null, conversacion_id]
  );

  // Si se asignó a un usuario (no se desasignó), crear notificación
  if (user_id && res.affectedRows > 0) {
    try {
      await pool.execute(
        `INSERT INTO agent_notifications (usuario_id, conversacion_id, tipo, leida)
         VALUES (?, ?, 'asignacion', FALSE)`,
        [user_id, conversacion_id]
      );
    } catch (e) {
      console.error('Error creating assignment notification:', e);
      // No fallar la asignación si falla la notificación
    }
  }

  return new Response(JSON.stringify({ ok:true, affected: res.affectedRows }), { headers: { "Content-Type":"application/json" }});
};
