import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

// API optimizada para vista rápida - solo lo esencial
export const GET: APIRoute = async ({ request }) => {
    const startTime = Date.now();
    try {
        const url = new URL(request.url);
        const cid = url.searchParams.get("conversation_id");

        console.log(`[API /messages/quick] Request for conversation ${cid}`);

        if (!cid) {
            return new Response(JSON.stringify({ ok: false, error: "conversation_id requerido" }), { status: 400 });
        }

        // Query ultra-optimizada: solo campos esenciales, sin joins, solo 20 mensajes
        const [rows] = await pool.query<RowDataPacket[]>(
            `
      SELECT 
        id,
        cuerpo,
        from_me,
        tipo,
        media_url,
        mime_type,
        ts,
        wa_msg_id,
        status
      FROM mensajes
      WHERE conversacion_id = ?
      ORDER BY ts DESC
      LIMIT 20
      `,
            [cid]
        );

        const items = rows.reverse().map(r => ({
            id: r.id,
            text: r.cuerpo || "",
            sender: r.from_me ? "me" : "them",
            tipo: r.tipo,
            media_url: r.media_url || null,
            mime_type: r.mime_type || null,
            ts: r.ts,
            wa_msg_id: r.wa_msg_id || null,
            status: r.status || null,
        }));

        const duration = Date.now() - startTime;
        console.log(`[API /messages/quick] Completed in ${duration}ms, returning ${items.length} items`);

        return new Response(JSON.stringify({ ok: true, items }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e: any) {
        console.error(`[API /messages/quick] ERROR:`, e?.message || e);
        return new Response(JSON.stringify({ ok: false, error: e?.message || "Error" }), { status: 500 });
    }
};
