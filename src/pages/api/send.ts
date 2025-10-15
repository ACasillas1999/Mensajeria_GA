// src/pages/api/send.ts
import type { APIRoute } from "astro";
import axios from "axios";
import FormData from "form-data";
import { pool } from "../../lib/db";
import { sendText } from "../../lib/whatsapp";

const WABA_TOKEN = process.env.WABA_TOKEN || "";
const WABA_PHONE_ID = process.env.WABA_PHONE_ID || process.env.WABA_PHONE_NUMBER_ID || "";

async function uploadToWABA(file: File) {
  if (!WABA_TOKEN || !WABA_PHONE_ID) throw new Error("Faltan WABA_TOKEN/WABA_PHONE_ID");
  const buf = Buffer.from(await file.arrayBuffer());
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buf, { filename: file.name, contentType: file.type });
  form.append("type", file.type || "application/octet-stream");

  const { data } = await axios.post(
    `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/media`,
    form,
    { headers: { Authorization: `Bearer ${WABA_TOKEN}`, ...form.getHeaders() } }
  );
  return data?.id as string;
}

async function sendMediaWABA({ to, type, media_id, caption }:{
  to: string; type: "image"|"video"|"audio"|"document"; media_id: string; caption?: string
}) {
  const body: any = {
    messaging_product: "whatsapp",
    to,
    type,
    [type]: { id: media_id }
  };
  if (caption && (type === "image" || type === "video" || type === "document")) {
    body[type].caption = caption;
  }
  const { data } = await axios.post(
    `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/messages`,
    body,
    { headers: { Authorization: `Bearer ${WABA_TOKEN}` } }
  );
  return data;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ct = request.headers.get("content-type") || "";

    // --- JSON (solo texto) ---
    if (ct.includes("application/json")) {
      const { conversacion_id, to, text } = await request.json();
      const now = Math.floor(Date.now()/1000);
      const data = await sendText({ to, body: text });
      const msgId = data?.messages?.[0]?.id || null;

      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status)
         VALUES (?,?,?,?,?,?,?)`,
        [conversacion_id, 1, "text", text, msgId, now, "sent"]
      );
      await pool.query(
        `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?`,
        [text, now, conversacion_id]
      );
      return new Response(JSON.stringify({ ok:true, data }), { status: 200 });
    }

    // --- FORM-DATA (archivo y/o texto) ---
    const form = await request.formData();
    const conversacion_id = String(form.get("conversacion_id") || form.get("conversation_id") || "");
    const to = String(form.get("to") || "");
    const text = String(form.get("text") || form.get("cuerpo") || "");
    const file = form.get("file");

    if (!conversacion_id || !to) {
      return new Response(JSON.stringify({ ok:false, error:"conversacion_id y to requeridos" }), { status: 400 });
    }
    if (!(file instanceof File) && !text) {
      return new Response(JSON.stringify({ ok:false, error:"Mensaje vacío" }), { status: 400 });
    }

    const now = Math.floor(Date.now()/1000);

    // Si hay archivo: subir → enviar según tipo
    if (file instanceof File) {
      const mime = file.type || "application/octet-stream";
      const media_id = await uploadToWABA(file);

      let wabaResp: any;
      let tipo: "image"|"video"|"audio"|"document" = "document";
      if (mime.startsWith("image/"))  tipo = "image";
      else if (mime.startsWith("video/")) tipo = "video";
      else if (mime.startsWith("audio/")) tipo = "audio";

      wabaResp = await sendMediaWABA({
        to, type: tipo, media_id, caption: text || undefined
      });
      const msgId = wabaResp?.messages?.[0]?.id || null;

      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, media_id, mime_type)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [conversacion_id, 1, tipo, text || `[${tipo}]`, msgId, now, "sent", media_id, mime]
      );
      await pool.query(
        `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?`,
        [text || `[${tipo}]`, now, conversacion_id]
      );

      return new Response(JSON.stringify({ ok:true, data: wabaResp }), { status: 200 });
    }

    // Si no hay archivo, pero viene form-data con solo texto (por compatibilidad)
    const data = await sendText({ to, body: text });
    const msgId = data?.messages?.[0]?.id || null;
    await pool.query(
      `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status)
       VALUES (?,?,?,?,?,?,?)`,
      [conversacion_id, 1, "text", text, msgId, now, "sent"]
    );
    await pool.query(
      `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?`,
      [text, now, conversacion_id]
    );
    return new Response(JSON.stringify({ ok:true, data }), { status:200 });

  } catch (err:any) {
    const isAxios = axios.isAxiosError(err);
    const status = (isAxios && err.response?.status) || 500;
    const payload = isAxios
      ? {
          code: err.response?.data?.error?.code,
          title: err.response?.data?.error?.title,
          message: err.response?.data?.error?.message,
          details: err.response?.data?.error?.error_data,
        }
      : { message: String(err?.message || err) };
    console.error("SEND ERROR:", { status, payload });
    return new Response(JSON.stringify({ ok:false, error: payload }), { status });
  }
};
