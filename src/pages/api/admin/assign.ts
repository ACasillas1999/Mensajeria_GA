import type { APIRoute } from "astro";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { id: number; rol: string; nombre: string } | undefined;
  if (!user || (user.rol || '').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  const { conversacion_id, user_id } = await request.json();
  if (!conversacion_id) return new Response(JSON.stringify({ ok:false, error:"conversacion_id requerido" }), { status:400 });

  // Obtener el asignado actual antes de cambiar
  const [convRows] = await pool.query<RowDataPacket[]>(
    "SELECT asignado_a FROM conversaciones WHERE id = ?",
    [conversacion_id]
  );
  const asignadoAnterior = convRows[0]?.asignado_a || null;

  const [res] = await pool.execute<ResultSetHeader>(
    "UPDATE conversaciones SET asignado_a = ? WHERE id = ?",
    [user_id ?? null, conversacion_id]
  );

  if (res.affectedRows > 0) {
    try {
      // Obtener nombres de usuarios
      let nombreNuevo = null;
      let nombreAnterior = null;

      if (user_id) {
        const [nuevoRows] = await pool.query<RowDataPacket[]>(
          "SELECT nombre FROM usuarios WHERE id = ?",
          [user_id]
        );
        nombreNuevo = nuevoRows[0]?.nombre || `Usuario ${user_id}`;
      }

      if (asignadoAnterior) {
        const [anteriorRows] = await pool.query<RowDataPacket[]>(
          "SELECT nombre FROM usuarios WHERE id = ?",
          [asignadoAnterior]
        );
        nombreAnterior = anteriorRows[0]?.nombre || `Usuario ${asignadoAnterior}`;
      }

      // Determinar el texto del evento
      let texto = '';
      let tipoEvento: 'asignacion' | 'reasignacion' = 'asignacion';

      if (!asignadoAnterior && user_id) {
        // Nueva asignación
        texto = `Conversación asignada a ${nombreNuevo} por ${user.nombre}`;
        tipoEvento = 'asignacion';
      } else if (asignadoAnterior && user_id && asignadoAnterior !== user_id) {
        // Reasignación
        texto = `Conversación reasignada de ${nombreAnterior} a ${nombreNuevo} por ${user.nombre}`;
        tipoEvento = 'reasignacion';
      } else if (asignadoAnterior && !user_id) {
        // Desasignación
        texto = `Conversación desasignada de ${nombreAnterior} por ${user.nombre}`;
        tipoEvento = 'asignacion';
      }

      // Registrar evento del sistema
      if (texto) {
        await pool.execute(
          `INSERT INTO conversation_events (conversacion_id, tipo, usuario_id, texto, evento_data)
           VALUES (?, ?, ?, ?, ?)`,
          [
            conversacion_id,
            tipoEvento,
            user.id,
            texto,
            JSON.stringify({
              asignado_anterior: asignadoAnterior,
              asignado_nuevo: user_id,
              nombre_anterior: nombreAnterior,
              nombre_nuevo: nombreNuevo
            })
          ]
        );
      }

      // Si se asignó a un usuario (no se desasignó), crear notificación
      if (user_id) {
        await pool.execute(
          `INSERT INTO agent_notifications (usuario_id, conversacion_id, tipo, leida)
           VALUES (?, ?, 'asignacion', FALSE)`,
          [user_id, conversacion_id]
        );
      }
    } catch (e) {
      console.error('Error creating assignment notification/event:', e);
      // No fallar la asignación si falla la notificación o evento
    }
  }

  return new Response(JSON.stringify({ ok:true, affected: res.affectedRows }), { headers: { "Content-Type":"application/json" }});
};
