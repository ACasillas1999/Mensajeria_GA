import type { APIRoute } from "astro";
import { z } from "zod";
import { pool } from "../../lib/db";

const Body = z.object({ id: z.number().int().positive(), estado: z.enum(['NUEVA','ABIERTA','RESUELTA']) });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id:number, rol:string } | undefined;
    if (!user) return new Response(JSON.stringify({ ok:false, error:'Unauthorized' }), { status: 401 });

    const data = await request.json();
    const { id, estado } = Body.parse({ id: Number(data.id), estado: data.estado });

    // Authorization: admin can update any; others only if assigned to them
    if (String(user.rol).toLowerCase() !== 'admin') {
      const [rows] = await pool.query<any[]>(`SELECT asignado_a FROM conversaciones WHERE id=? LIMIT 1`, [id]);
      if (!rows.length || rows[0].asignado_a !== user.id) {
        return new Response(JSON.stringify({ ok:false, error:'Forbidden' }), { status: 403 });
      }
    }

    await pool.query(`UPDATE conversaciones SET estado=? WHERE id=?`, [estado, id]);
    return new Response(JSON.stringify({ ok:true }), { headers: { 'Content-Type':'application/json' } });
  } catch (e:any) {
    if (e?.issues) return new Response(JSON.stringify({ ok:false, error: e.issues.map((i:any)=>i.message).join(' | ') }), { status: 400 });
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'Error' }), { status: 500 });
  }
};
