import type { APIRoute } from 'astro'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'node:path'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'grupo-ascencio-messaging-app'

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return new Response(JSON.stringify({ ok:false, error:'file_required' }), { status:400 })

    const buf = Buffer.from(await file.arrayBuffer())

    const ext = path.extname(file.name || '')
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || ''}`

    // Deducción simple del tipo para el backend
    const mime = (file.type || '').toLowerCase()
    let kind = mime.startsWith('image/') ? 'image'
               : mime.startsWith('audio/') ? 'audio'
               : mime.startsWith('video/') ? 'video'
               : 'document'

    // Subir a S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: name,
      Body: buf,
      ContentType: mime || 'application/octet-stream',
    }))

    // URL pública del archivo en S3
    const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${name}`

    return new Response(JSON.stringify({ ok:true, url, kind, mime }), { status:200 })
  } catch (e:any) {
    console.error('Upload error:', e)
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'upload_error' }), { status:500 })
  }
}
