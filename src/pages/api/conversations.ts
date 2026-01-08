import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../lib/db";

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const estado = url.searchParams.get("estado")?.trim().toUpperCase() || ""; // NUEVA|ABIERTA|RESUELTA (legacy)
    const statusId = url.searchParams.get("status_id") || ""; // Nuevo sistema
    const sucursalId = url.searchParams.get("sucursal_id") || "";
    const limit  = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    const params: any[] = [];
    let where = "WHERE 1=1";
    if (search) {
      // Buscar en nombre, teléfono, ID de conversación, o contenido de mensajes
      where += ` AND (
        c.wa_profile_name LIKE CONCAT('%', ?, '%')
        OR c.wa_user LIKE CONCAT('%', ?, '%')
        OR CAST(c.id AS CHAR) LIKE CONCAT('%', ?, '%')
        OR EXISTS (
          SELECT 1 FROM mensajes m
          WHERE m.conversacion_id = c.id
          AND m.cuerpo LIKE CONCAT('%', ?, '%')
          LIMIT 1
        )
      )`;
      params.push(search, search, search, search);
    }

    // Filtro por status_id (nuevo sistema)
    if (statusId) {
      where += " AND c.status_id = ?";
      params.push(statusId);
    }
    // Fallback: filtro por estado legacy
    else if (estado && ["NUEVA","ABIERTA","RESUELTA"].includes(estado)) {
      where += " AND c.estado = ?";
      params.push(estado);
    }

    if (sucursalId) {
      const sucIdNum = Number(sucursalId);
      if (!Number.isNaN(sucIdNum)) {
        where += " AND u.sucursal_id = ?";
        params.push(sucIdNum);
      }
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
        c.id,
        c.wa_user,
        COALESCE(c.wa_profile_name, c.wa_user, CONCAT('Chat ', c.id)) AS title,
        COALESCE(c.ultimo_msg, '') AS last_text,
        COALESCE(c.ultimo_ts, UNIX_TIMESTAMP(c.creado_en)) AS last_at,
        c.estado,
        c.status_id,
        cs.name AS status_name,
        cs.color AS status_color,
        cs.icon AS status_icon,
        c.asignado_a,
        u.nombre AS asignado_nombre,
        u.sucursal_id AS asignado_sucursal_id,
        s.nombre AS asignado_sucursal,
        c.dentro_ventana_24h,
        COALESCE(cus.is_archived, FALSE) AS is_archived,
        COALESCE(cus.is_favorite, FALSE) AS is_favorite
      FROM conversaciones c
      LEFT JOIN usuarios u ON u.id = c.asignado_a
      LEFT JOIN sucursales s ON s.id = u.sucursal_id
      LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
      LEFT JOIN conversation_user_status cus ON cus.conversacion_id = c.id AND cus.usuario_id = ?
      ${where}
      ORDER BY last_at DESC
      LIMIT ? OFFSET ?
      `,
      [user.id, ...params, limit, offset]
    );

    return new Response(JSON.stringify({ ok: true, items: rows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Error" }), { status: 500 });
  }
};
