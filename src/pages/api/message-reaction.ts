import type { APIRoute } from "astro";
import { z } from "zod";
import axios from "axios";
import { pool } from "../../lib/db";

const WABA_TOKEN = process.env.WABA_TOKEN || "";
const WABA_PHONE_ID =
  process.env.WABA_PHONE_ID || process.env.WABA_PHONE_NUMBER_ID || "";

const bodySchema = z.object({
  mensaje_id: z.number().int().positive(),
  emoji: z.string().min(1).max(8),
});

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: "No autenticado" }),
        { status: 401 }
      );
    }
    if (!WABA_TOKEN || !WABA_PHONE_ID) {
      return new Response(
        JSON.stringify({ ok: false, error: "Faltan WABA_TOKEN/WABA_PHONE_ID" }),
        { status: 500 }
      );
    }

    const raw = await request.json();
    const { mensaje_id, emoji } = bodySchema.parse(raw);

    // Obtener datos del mensaje
    const [rows] = await pool.query(
      `SELECT m.wa_msg_id, c.wa_user
         FROM mensajes m
         JOIN conversaciones c ON c.id = m.conversacion_id
        WHERE m.id = ?
        LIMIT 1`,
      [mensaje_id]
    );

    const row: any = (rows as any[])[0];
    if (!row) {
      return new Response(
        JSON.stringify({ ok: false, error: "Mensaje no encontrado" }),
        { status: 404 }
      );
    }

    const waMsgId: string | null = row.wa_msg_id || null;
    const waUser: string | null = row.wa_user || null;

    if (!waMsgId || !waUser) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No hay wa_msg_id o wa_user para reaccionar",
        }),
        { status: 400 }
      );
    }

    // Enviar reacción a WhatsApp Cloud API
    const payload: any = {
      messaging_product: "whatsapp",
      to: waUser,
      type: "reaction",
      reaction: {
        message_id: waMsgId,
        emoji,
      },
    };

    const waRes = await axios.post(
      `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WABA_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Guardar reacción en BD (última reacción enviada por un agente)
    await pool.query(
      `UPDATE mensajes
          SET reaction_emoji = ?, reaction_by = ?
        WHERE id = ?`,
      [emoji, user.id, mensaje_id]
    );

    return new Response(
      JSON.stringify({ ok: true, data: waRes.data }),
      { status: 200 }
    );
  } catch (err: any) {
    if (err?.issues) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err.issues.map((i: any) => i.message).join(" | "),
        }),
        { status: 400 }
      );
    }
    const isAxios = axios.isAxiosError(err);
    const status = (isAxios && err.response?.status) || 500;
    const msg =
      (isAxios && err.response?.data?.error?.message) ||
      err?.message ||
      "Error enviando reacción";
    console.error("REACTION ERROR:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status }
    );
  }
};

