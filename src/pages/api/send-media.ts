import type { APIRoute } from 'astro'
import { pool } from '../../lib/db'
import { sendImageLink, sendDocumentLink, sendAudioLink, sendVideoLink } from '../../lib/whatsapp'
import axios from 'axios'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { conversacion_id, to, kind, url, caption='' } = await request.json()
    const now = Math.floor(Date.now()/1000)

    // Ventana 24h: último inbound
    const [rows] = await pool.query(
      'SELECT MAX(ts) AS last_in FROM mensajes WHERE conversacion_id=? AND from_me=0',
      [conversacion_id]
    )
    const lastIn = (rows as any[])[0]?.last_in ?? null
    const within24h = lastIn && (now - Number(lastIn) <= 24*3600)
    if (!within24h) {
      return new Response(JSON.stringify({ ok:false, requires_template:true, error:{ message:'Fuera de 24h' } }), { status:409 })
    }

    // Envío por tipo
    let data:any
    if (kind === 'image')     data = await sendImageLink({ to, link:url, caption })
    else if (kind === 'audio')data = await sendAudioLink({ to, link:url })
    else if (kind === 'video')data = await sendVideoLink({ to, link:url, caption })
    else                      data = await sendDocumentLink({ to, link:url, caption })

    const msgId = data?.messages?.[0]?.id || null

    // Guarda mensaje saliente con media_url
    await pool.query(
      `INSERT INTO mensajes (conversacion_id, from_me, tipo, cuerpo, wa_msg_id, ts, status, media_url)
       VALUES (?,?,?,?,?,?,?,?)`,
      [conversacion_id, 1, kind, caption || `[${kind}]`, msgId, now, 'sent', url]
    )
    await pool.query(
      'UPDATE conversaciones SET ultimo_msg=?, ultimo_ts=?, estado="ABIERTA" WHERE id=?',
      [caption || `[${kind}]`, now, conversacion_id]
    )

    return new Response(JSON.stringify({ ok:true, data }), { status:200 })
  } catch (err:any) {
    const status = axios.isAxiosError(err) ? (err.response?.status || 500) : 500
    const payload = axios.isAxiosError(err) ? err.response?.data?.error : { message:String(err?.message||err) }
    console.error('SEND-MEDIA ERROR:', payload)
    return new Response(JSON.stringify({ ok:false, error: payload }), { status })
  }
}
