import type { APIRoute } from "astro";
import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "../../../../lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const patchSchema = z.object({
  nombre: z.string().min(2).max(190).optional(),
  email: z.string().email().max(190).optional(),
  rol: z.enum(["AGENTE","ADMIN","GERENTE"]).optional(),
  activo: z.boolean().optional(),
  sucursal_id: z.number().int().nullable().optional(),
  new_password: z.string().min(8).max(100).optional()
});

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const body = patchSchema.parse(await request.json());
  const fields:string[] = [];
  const values:any[] = [];

  for (const [k,v] of Object.entries(body)) {
    if (k === "new_password") continue;
    fields.push(`${k} = ?`);
    values.push(v);
  }

  if (body.new_password) {
    const pass_hash = await bcrypt.hash(body.new_password, 12);
    fields.push("pass_hash = ?");
    values.push(pass_hash);
  }

  if (!fields.length) return new Response(JSON.stringify({ ok:false, error:"Nada que actualizar" }), { status:400 });
  values.push(id);

  const [res] = await pool.execute<ResultSetHeader>(`UPDATE usuarios SET ${fields.join(", ")} WHERE id=?`, values);
  return new Response(JSON.stringify({ ok:true, affected: res.affectedRows }), { headers: { "Content-Type":"application/json" }});
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const [res] = await pool.execute<ResultSetHeader>("UPDATE usuarios SET activo=0 WHERE id=?", [id]);
  return new Response(JSON.stringify({ ok:true, affected: res.affectedRows }), { headers: { "Content-Type":"application/json" }});
};
