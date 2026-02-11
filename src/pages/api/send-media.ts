import type { APIRoute } from 'astro'
import { pool } from '../../lib/db'
import { sendImageLink, sendDocumentLink, sendAudioLink, sendVideoLink } from '../../lib/whatsapp'
import axios from 'axios'
import path from 'node:path'

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = (locals as any).user as { id: number } | undefined;
    const usuario_id = user?.id || null;

    const { conversacion_id, to, kind, url, caption = '' } = await request.json()
    const now = Math.floor(Date.now() / 1000)

    // Ventana 24h: último inbound
    const [rows] = await pool.query(
      'SELECT MAX(ts) AS last_in FROM mensajes WHERE conversacion_id=? AND from_me=0',
      [conversacion_id]
    )
    const lastIn = (rows as any[])[0]?.last_in ?? null
    const within24h = lastIn && (now - Number(lastIn) <= 24 * 3600)
    if (!within24h) {
      return new Response(JSON.stringify({ ok: false, requires_template: true, error: { message: 'Fuera de 24h' } }), { status: 409 })
    }

    // Envío por tipo
    let data: any
    if (kind === 'image') data = await sendImageLink({ to, link: url, caption })
    else if (kind === 'audio') data = await sendAudioLink({ to, link: url })
    else if (kind === 'video') data = await sendVideoLink({ to, link: url, caption })
    else {
      let filename = 'documento.pdf';
      try {
        const urlObj = new URL(url);
        filename = path.basename(urlObj.pathname) || 'documento.pdf';
      } catch (e) { }
      data = await sendDocumentLink({ to, link: url, caption, filename })
    }

    const msgId = data?.messages?.[0]?.id || null

    // Guarda mensaje saliente con media_url
    await pool.query(
      `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, media_url, usuario_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [conversacion_id, 1, kind, caption || `[${kind}]`, msgId, now, 'sent', url, usuario_id]
    )

    // Set default status if conversation doesn't have one
    const [statusCheck] = await pool.query(
      `SELECT status_id FROM conversaciones WHERE id=?`,
      [conversacion_id]
    );
    const currentStatusId = (statusCheck as any[])[0]?.status_id;

    if (currentStatusId) {
      await pool.query(
        'UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=? WHERE id=?',
        [caption || `[${kind}]`, now, conversacion_id]
      );
    } else {
      await pool.query(
        'UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, status_id=(SELECT id FROM conversation_statuses WHERE is_default=TRUE LIMIT 1) WHERE id=?',
        [caption || `[${kind}]`, now, conversacion_id]
      );
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200 })
  } catch (err: any) {
    const status = axios.isAxiosError(err) ? (err.response?.status || 500) : 500
    const payload = axios.isAxiosError(err) ? err.response?.data?.error : { message: String(err?.message || err) }
    console.error('SEND-MEDIA ERROR:', payload)
    return new Response(JSON.stringify({ ok: false, error: payload }), { status })
  }
}
