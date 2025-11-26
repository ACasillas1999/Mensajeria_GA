import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const conversacion_id = url.searchParams.get("conversacion_id");

    if (!conversacion_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "conversacion_id requerido" }),
        { status: 400 }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        c.id,
        c.conversacion_id,
        c.usuario_id,
        u.nombre AS usuario_nombre,
        c.comentario,
        c.creado_en
      FROM comentarios_internos c
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.conversacion_id = ?
      ORDER BY c.creado_en ASC
      `,
      [conversacion_id]
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Error" }),
      { status: 500 }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { conversacion_id, comentario } = body;

    if (!conversacion_id || !comentario?.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "conversacion_id y comentario requeridos" }),
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO comentarios_internos (conversacion_id, usuario_id, comentario) VALUES (?, ?, ?)`,
      [conversacion_id, user.id, comentario.trim()]
    );

    return new Response(
      JSON.stringify({ ok: true, id: (result as any).insertId }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Error" }),
      { status: 500 }
    );
  }
};
