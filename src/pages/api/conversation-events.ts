// src/pages/api/conversation-events.ts
import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

/**
 * GET: Obtener eventos del sistema de una conversación
 * Estos eventos son internos (asignaciones, cambios de estado, etc)
 * y solo son visibles para los agentes, no se envían al cliente.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const url = new URL(request.url);
    const conversacion_id = url.searchParams.get("conversacion_id");

    if (!conversacion_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "conversacion_id requerido" }),
        { status: 400 }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        ce.id,
        ce.conversacion_id,
        ce.tipo,
        ce.usuario_id,
        ce.texto,
        ce.evento_data,
        ce.creado_en,
        UNIX_TIMESTAMP(ce.creado_en) AS ts,
        u.nombre AS usuario_nombre
      FROM conversation_events ce
      LEFT JOIN usuarios u ON u.id = ce.usuario_id
      WHERE ce.conversacion_id = ?
      ORDER BY ce.creado_en ASC`,
      [conversacion_id]
    );

    return new Response(
      JSON.stringify({
        ok: true,
        items: rows,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error fetching conversation events:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Error" }),
      { status: 500 }
    );
  }
};
