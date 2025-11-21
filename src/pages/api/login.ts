import type { APIRoute } from "astro";
import { z } from "zod";
import { pool } from "../../lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";

const bodySchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(8).max(100), // 🔧 alineado a 8
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password } = bodySchema.parse(await request.json());

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.nombre, u.email, u.pass_hash, u.rol, u.activo,
              u.sucursal_id, s.nombre AS sucursal
       FROM usuarios u
       LEFT JOIN sucursales s ON s.id = u.sucursal_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return new Response(JSON.stringify({ ok:false, error:"Credenciales inválidas" }), { status: 401 });
    }

    const u = rows[0];
    if (!u.activo) {
      return new Response(JSON.stringify({ ok:false, error:"Usuario inactivo" }), { status: 403 });
    }

    const ok = await bcrypt.compare(password, u.pass_hash);
    if (!ok) {
      return new Response(JSON.stringify({ ok:false, error:"Credenciales inválidas" }), { status: 401 });
    }

    const token = jwt.sign(
      { sub: u.id, rol: u.rol, nombre: u.nombre, sucursal_id: u.sucursal_id ?? null, sucursal: u.sucursal ?? null },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "8h" }
    );

    const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
    const base = import.meta.env.BASE_URL || "/";
    const cookie = [
      `auth=${token}`,
      "HttpOnly",
      `Path=${base}`,
      "SameSite=Lax",
      // 8h
      "Max-Age=28800",
      isProd ? "Secure" : "",
    ].filter(Boolean).join("; ");

    return new Response(
      JSON.stringify({
        ok: true,
        token,
        user: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, sucursal_id: u.sucursal_id ?? null, sucursal: u.sucursal ?? null },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (err: any) {
    // Si el error es de Zod, devuelve mensajes legibles
    if (err?.issues) {
      return new Response(JSON.stringify({ ok:false, error: err.issues.map((i:any)=>i.message).join(" | ") }), { status: 400 });
    }
    return new Response(JSON.stringify({ ok:false, error: err?.message || "Error" }), { status: 500 });
  }
};
