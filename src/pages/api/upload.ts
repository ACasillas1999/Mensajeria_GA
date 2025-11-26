import type { APIRoute } from 'astro'
import path from 'node:path'
import fs from 'node:fs/promises'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export const POST: APIRoute = async ({ request, url: astroUrl }) => {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return new Response(JSON.stringify({ ok:false, error:'file_required' }), { status:400 })

    // Crear directorio de uploads si no existe
    await fs.mkdir(UPLOAD_DIR, { recursive: true })

    const buf = Buffer.from(await file.arrayBuffer())

    const ext = path.extname(file.name || '')
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || ''}`

    // Deducción simple del tipo para el backend
    const mime = (file.type || '').toLowerCase()
    let kind = mime.startsWith('image/') ? 'image'
               : mime.startsWith('audio/') ? 'audio'
               : mime.startsWith('video/') ? 'video'
               : 'document'

    // Guardar archivo localmente
    const filePath = path.join(UPLOAD_DIR, name)
    await fs.writeFile(filePath, buf)

    // URL pública del archivo (accesible desde /uploads/)
    const origin = astroUrl.origin
    const url = `${origin}/uploads/${name}`

    return new Response(JSON.stringify({ ok:true, url, kind, mime }), { status:200 })
  } catch (e:any) {
    console.error('Upload error:', e)
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'upload_error' }), { status:500 })
  }
}
