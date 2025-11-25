import type { APIRoute } from "astro";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../../lib/db";
import { z } from "zod";

// Listar sucursales
export const GET: APIRoute = async ({ locals }) => {
  const user = (locals as any).user as { rol: string } | undefined;
  if (!user || (user.rol || "").toLowerCase() !== "admin") {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status: 403 });
  }
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, nombre FROM sucursales ORDER BY nombre ASC");
  return new Response(JSON.stringify({ ok: true, items: rows }), {
    headers: { "Content-Type": "application/json" },
  });
};

const createSchema = z.object({
  nombre: z.string().min(2).max(190),
});

// Crear sucursal
export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { rol: string } | undefined;
  if (!user || (user.rol || "").toLowerCase() !== "admin") {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());

    const [dup] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM sucursales WHERE nombre = ? LIMIT 1",
      [body.nombre]
    );
    if (dup.length) {
      return new Response(JSON.stringify({ ok: false, error: "Ya existe una sucursal con ese nombre" }), {
        status: 409,
      });
    }

    const [res] = await pool.execute<ResultSetHeader>(
      "INSERT INTO sucursales (nombre) VALUES (?)",
      [body.nombre]
    );

    return new Response(
      JSON.stringify({ ok: true, id: res.insertId, nombre: body.nombre }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    const msg = e?.issues
      ? (e.issues as any[]).map((i) => i.message).join(" | ")
      : e?.message || "Error";
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 400 });
  }
};
