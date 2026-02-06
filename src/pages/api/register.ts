import type { APIRoute } from "astro";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../lib/db";

const bodySchema = z.object({
  email: z.string().email().max(190),
  nombre: z.string().min(2).max(190),
  password: z.string().min(8).max(100),     // 🔧 mínimo 8
  confirmar: z.string().min(8).max(100),    // 🔧 mínimo 8
  rol: z.enum(["AGENTE", "ADMIN", "GERENTE"]).default("AGENTE"),
}).refine((d) => d.password === d.confirmar, {
  path: ["confirmar"],
  message: "Las contraseñas no coinciden",
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = bodySchema.parse(await request.json());

    const [dup] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
      [data.email]
    );
    if (dup.length) {
      return new Response(JSON.stringify({ ok: false, error: "Email ya registrado" }), { status: 409 });
    }

    const pass_hash = await bcrypt.hash(data.password, 12);

    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO usuarios (email, nombre, pass_hash, rol, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [data.email, data.nombre, pass_hash, data.rol]
    );

    return new Response(
      JSON.stringify({ ok: true, id: res.insertId }),
      { headers: { "Content-Type": "application/json" }, status: 201 }
    );
  } catch (err: any) {
    if (err?.issues) {
      // Errores de Zod bonitos
      const mensajes = err.issues.map((i: any) => i.message);
      return new Response(JSON.stringify({ ok:false, error: mensajes.join(" | ") }), { status: 400 });
    }
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Error" }), { status: 500 });
  }

};
