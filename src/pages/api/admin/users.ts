import type { APIRoute } from "astro";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../../lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email().max(190),
  nombre: z.string().min(2).max(190),
  password: z.string().min(8).max(100),
  rol: z.enum(["AGENTE","ADMIN"]),
  sucursal_id: z.number().int().nullable().optional()
});

export const GET: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { rol:string } | undefined;
  if (!user || (user.rol||'').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  const url = new URL(request.url);
  const qRol = url.searchParams.get("rol") || "";
  const qSuc = url.searchParams.get("sucursal_id") || "";
  const params:any[] = [];
  let where = "WHERE 1=1";
  if (qRol) { where += " AND u.rol = ?"; params.push(qRol); }
  if (qSuc) { where += " AND u.sucursal_id = ?"; params.push(Number(qSuc)); }

  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.sucursal_id,
           s.nombre AS sucursal
    FROM usuarios u
    LEFT JOIN sucursales s ON s.id = u.sucursal_id
    ${where}
    ORDER BY u.id DESC
    `,
    params
  );
  return new Response(JSON.stringify({ ok:true, items: rows }), { headers: { "Content-Type":"application/json" }});
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user as { rol:string } | undefined;
  if (!user || (user.rol||'').toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
  }
  try {
    const body = createSchema.parse(await request.json());
    const [dup] = await pool.query<RowDataPacket[]>("SELECT id FROM usuarios WHERE email=? LIMIT 1", [body.email]);
    if (dup.length) return new Response(JSON.stringify({ ok:false, error:"Email ya registrado" }), { status:409 });

    const pass_hash = await bcrypt.hash(body.password, 12);
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO usuarios (email, nombre, pass_hash, rol, activo, sucursal_id)
       VALUES (?,?,?,?,1,?)`,
      [body.email, body.nombre, pass_hash, body.rol, body.sucursal_id ?? null]
    );
    return new Response(JSON.stringify({ ok:true, id: res.insertId }), { status:201, headers:{ "Content-Type":"application/json" }});
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || "Error" }), { status:400 });
  }
};
