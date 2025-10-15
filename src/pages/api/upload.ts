import type { APIRoute } from 'astro'
import fs from 'node:fs/promises'
import path from 'node:path'

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return new Response(JSON.stringify({ ok:false, error:'file_required' }), { status:400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const ext = path.extname(file.name || '')
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || ''}`
    await fs.writeFile(path.join(uploadsDir, name), buf)

    const origin = new URL(request.url).origin // en dev: localhost o tu ngrok
    const url = `${origin}/uploads/${name}`

    // Deducción simple del tipo para el backend
    const mime = (file.type || '').toLowerCase()
    const kind = mime.startsWith('image/') ? 'image'
               : mime.startsWith('audio/') ? 'audio'
               : mime.startsWith('video/') ? 'video'
               : 'document'

    return new Response(JSON.stringify({ ok:true, url, kind, mime }), { status:200 })
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'upload_error' }), { status:500 })
  }
}
