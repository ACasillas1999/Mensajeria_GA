import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const estado = url.searchParams.get("estado")?.trim().toUpperCase() || ""; // NUEVA|ABIERTA|RESUELTA
    const limit  = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    const params: any[] = [];
    let where = "WHERE 1=1";
    if (search) {
      where +=
        " AND (COALESCE(wa_profile_name, wa_user) LIKE CONCAT('%', ?, '%') OR CAST(id AS CHAR) LIKE CONCAT('%', ?, '%'))";
      params.push(search, search);
    }

    if (estado && ["NUEVA","ABIERTA","RESUELTA"].includes(estado)) {
      where += " AND estado = ?";
      params.push(estado);
    }

    const user = (locals as any).user as { id:number, rol:string } | undefined;
    if (!user) {
      return new Response(JSON.stringify({ ok:false, error:'Unauthorized' }), { status: 401 });
    }
    if (String(user.rol).toLowerCase() !== 'admin') {
      where += " AND asignado_a = ?";
      params.push(user.id);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        id,
        wa_user,
        COALESCE(wa_profile_name, wa_user, CONCAT('Chat ', id)) AS title,
        COALESCE(ultimo_msg, '') AS last_text,
        COALESCE(ultimo_ts, UNIX_TIMESTAMP(creado_en)) AS last_at,
        estado
      FROM conversaciones
      ${where}
      ORDER BY last_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Error" }), { status: 500 });
  }
};
