import type { APIRoute } from 'astro'
import 'dotenv/config'

export const GET: APIRoute = async ({ params }) => {
  try {
    const mediaId = params.id!
    const base = `https://graph.facebook.com/${process.env.WABA_VERSION || 'v20.0'}`
    const token = process.env.WABA_TOKEN!

    // 1) metadata -> url + mime_type
    const metaRes = await fetch(`${base}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!metaRes.ok) return new Response(await metaRes.text(), { status: metaRes.status })
    const meta = await metaRes.json() as { url: string, mime_type?: string }

    // 2) descarga binaria autenticada
    const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } })
    if (!bin.ok || !bin.body) return new Response(await bin.text(), { status: bin.status })

    return new Response(bin.body, {
      status: 200,
      headers: {
        'Content-Type': meta.mime_type || bin.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300'
      }
    })
  } catch (e:any) {
    return new Response(`Media proxy error: ${e?.message || e}`, { status: 500 })
  }
}
