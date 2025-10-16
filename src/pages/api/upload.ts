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
    let name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || ''}`
    const inputPath = path.join(uploadsDir, name)
    await fs.writeFile(inputPath, buf)

    const origin = new URL(request.url).origin // en dev: localhost o tu ngrok
    let url = `${origin}/uploads/${name}`

    // Deducción simple del tipo para el backend
    const mime = (file.type || '').toLowerCase()
    let kind = mime.startsWith('image/') ? 'image'
               : mime.startsWith('audio/') ? 'audio'
               : mime.startsWith('video/') ? 'video'
               : 'document'

    // Intentar convertir audio WEBM a OGG/OPUS para mejor compatibilidad con WhatsApp
    if (kind === 'audio' && mime.includes('webm')) {
  try {
    const ffmpegPath = (await import('ffmpeg-static')).default as unknown as string
    const ffmpeg = (await import('fluent-ffmpeg')).default
    // @ts-ignore
    ffmpeg.setFfmpegPath(ffmpegPath)

    const base = name.replace(/\.[^.]*$/, '')
    const outName = `${base}.ogg`
    const outPath = path.join(uploadsDir, outName)

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .audioCodec('libopus')
        .format('ogg')
        .on('end', resolve)
        .on('error', reject)
        .save(outPath)
    })

    try { await fs.unlink(inputPath) } catch {}
    name = outName
    url = `${origin}/uploads/${name}`
    kind = 'audio' // se mantiene
  } catch (e) {
    // Si falla la conversión, seguimos sirviendo el .webm original
  }
}

    return new Response(JSON.stringify({ ok:true, url, kind, mime }), { status:200 })
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'upload_error' }), { status:500 })
  }
}
