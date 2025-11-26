// src/pages/api/send.ts
import type { APIRoute } from "astro";
import axios from "axios";
import FormData from "form-data";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { pool } from "../../lib/db";
import { sendText } from "../../lib/whatsapp";

const WABA_TOKEN = process.env.WABA_TOKEN || "";
const WABA_PHONE_ID = process.env.WABA_PHONE_ID || process.env.WABA_PHONE_NUMBER_ID || "";

async function uploadBufferToWABA({
  buffer,
  filename,
  contentType,
}: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}) {
  if (!WABA_TOKEN || !WABA_PHONE_ID) throw new Error("Faltan WABA_TOKEN/WABA_PHONE_ID");
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buffer, { filename, contentType });
  form.append("type", contentType || "application/octet-stream");

  const { data } = await axios.post(
    `https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/media`,
    form,
    { headers: { Authorization: `Bearer ${WABA_TOKEN}`, ...form.getHeaders() } }
  );
  return data?.id as string;
}

// Convierte audio WEBM a OGG/OPUS para compatibilidad con WhatsApp
async function ensureAudioCompatible(file: File): Promise<{ buffer: Buffer; filename: string; mime: string }> {
  const origMime = (file.type || "").toLowerCase();
  // Si no es audio/webm, regresamos el buffer original
  if (!(origMime.startsWith("audio/") && origMime.includes("webm"))) {
    const buf = Buffer.from(await file.arrayBuffer());
    return { buffer: buf, filename: file.name || "audio", mime: origMime || "application/octet-stream" };
  }

  // Transcodificar a OGG/OPUS usando ffmpeg-static
  const ffmpegPath = (await import("ffmpeg-static")).default as unknown as string;
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  // @ts-ignore
  ffmpeg.setFfmpegPath(ffmpegPath);

  const tmpIn = path.join(os.tmpdir(), `in-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`);
  const tmpOut = path.join(os.tmpdir(), `out-${Date.now()}-${Math.random().toString(36).slice(2)}.ogg`);
  const inputBuf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(tmpIn, inputBuf);

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(tmpIn)
      .audioCodec("libopus")
      .format("ogg")
      .on("end", resolve)
      .on("error", reject)
      .save(tmpOut);
  });

  const outBuf = await fs.readFile(tmpOut);
  try {
    await fs.unlink(tmpIn);
  } catch {}
  try {
    await fs.unlink(tmpOut);
  } catch {}
  const base = (file.name || "audio").replace(/\.[^.]*$/, "");
  return { buffer: outBuf, filename: `${base}.ogg`, mime: "audio/ogg" };
}

async function sendMediaWABA({
  to,
  type,
  media_id,
  caption,
}: {
  to: string;
  type: "image" | "video" | "audio" | "document";
  media_id: string;
  caption?: string;
}) {
  const body: any = {
    messaging_product: "whatsapp",
    to,
    type,
    [type]: { id: media_id },
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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    const usuario_id = user?.id || null;

    const ct = request.headers.get("content-type") || "";

    // --- JSON (solo texto) ---
    if (ct.includes("application/json")) {
      const { conversacion_id, to, text } = await request.json();
      const now = Math.floor(Date.now() / 1000);

      // Validación obligatoria de ventana de 24h basada en el último inbound.
      const [rows] = await pool.query(
        "SELECT MAX(ts) AS last_in FROM mensajes WHERE conversacion_id=? AND from_me=0",
        [conversacion_id]
      );
      const lastIn = (rows as any[])[0]?.last_in ?? null;
      const within24h = lastIn && now - Number(lastIn) <= 24 * 3600;
      if (!within24h) {
        return new Response(
          JSON.stringify({
            ok: false,
            requires_template: true,
            error: {
              message:
                "Esta conversaci\u00f3n est\u00e1 fuera de la ventana de 24h, debes usar una plantilla aprobada.",
            },
          }),
          { status: 409 }
        );
      }

      const data = await sendText({ to, body: text });
      const msgId = data?.messages?.[0]?.id || null;

      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, usuario_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [conversacion_id, 1, "text", text, msgId, now, "sent", usuario_id]
      );
      await pool.query(
        `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?`,
        [text, now, conversacion_id]
      );
      return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    }

    // --- FORM-DATA (archivo y/o texto) ---
    const form = await request.formData();
    const conversacion_id = String(form.get("conversacion_id") || form.get("conversation_id") || "");
    const to = String(form.get("to") || "");
    const text = String(form.get("text") || form.get("cuerpo") || "");
    const file = form.get("file");

    if (!conversacion_id || !to) {
      return new Response(JSON.stringify({ ok: false, error: "conversacion_id y to requeridos" }), {
        status: 400,
      });
    }
    if (!(file instanceof File) && !text) {
      return new Response(JSON.stringify({ ok: false, error: "Mensaje vac\u00edo" }), { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    // Validación obligatoria de ventana de 24h también para media.
    const [rows] = await pool.query(
      "SELECT MAX(ts) AS last_in FROM mensajes WHERE conversacion_id=? AND from_me=0",
      [conversacion_id]
    );
    const lastIn = (rows as any[])[0]?.last_in ?? null;
    const within24h = lastIn && now - Number(lastIn) <= 24 * 3600;
    if (!within24h) {
      return new Response(
        JSON.stringify({
          ok: false,
          requires_template: true,
          error: {
            message:
              "Esta conversaci\u00f3n est\u00e1 fuera de la ventana de 24h, debes usar una plantilla aprobada.",
          },
        }),
        { status: 409 }
      );
    }

    // Si hay archivo: subir y enviar según tipo
    if (file instanceof File) {
      // Asegurar formato compatible: convertir WEBM -> OGG/OPUS si aplica
      const compat = await ensureAudioCompatible(file);
      const media_id = await uploadBufferToWABA({
        buffer: compat.buffer,
        filename: compat.filename,
        contentType: compat.mime,
      });

      let wabaResp: any;
      let tipo: "image" | "video" | "audio" | "document" = "document";
      const mime = compat.mime || (file.type || "");
      if (mime.startsWith("image/")) tipo = "image";
      else if (mime.startsWith("video/")) tipo = "video";
      else if (mime.startsWith("audio/")) tipo = "audio";

      wabaResp = await sendMediaWABA({
        to,
        type: tipo,
        media_id,
        caption: text || undefined,
      });
      const msgId = wabaResp?.messages?.[0]?.id || null;

      await pool.query(
        `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, media_id, mime_type, usuario_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [conversacion_id, 1, tipo, text || `[${tipo}]`, msgId, now, "sent", media_id, mime, usuario_id]
      );
      await pool.query(
        `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?`,
        [text || `[${tipo}]`, now, conversacion_id]
      );

      return new Response(JSON.stringify({ ok: true, data: wabaResp }), { status: 200 });
    }

    // Si no hay archivo, pero viene form-data con solo texto (por compatibilidad)
    const data = await sendText({ to, body: text });
    const msgId = data?.messages?.[0]?.id || null;
    await pool.query(
      `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, usuario_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [conversacion_id, 1, "text", text, msgId, now, "sent", usuario_id]
    );
    await pool.query(
      `UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?`,
      [text, now, conversacion_id]
    );
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (err: any) {
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
    return new Response(JSON.stringify({ ok: false, error: payload }), { status });
  }
};
