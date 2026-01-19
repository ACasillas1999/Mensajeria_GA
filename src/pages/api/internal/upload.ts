import type { APIRoute } from 'astro';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = {
    // Imágenes
    'image/jpeg': { ext: 'jpg', category: 'image' },
    'image/jpg': { ext: 'jpg', category: 'image' },
    'image/png': { ext: 'png', category: 'image' },
    'image/gif': { ext: 'gif', category: 'image' },
    'image/webp': { ext: 'webp', category: 'image' },

    // Documentos
    'application/pdf': { ext: 'pdf', category: 'document' },
    'application/msword': { ext: 'doc', category: 'document' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', category: 'document' },
    'application/vnd.ms-excel': { ext: 'xls', category: 'document' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', category: 'document' },
    'application/vnd.ms-powerpoint': { ext: 'ppt', category: 'document' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', category: 'document' },

    // Archivos
    'application/zip': { ext: 'zip', category: 'file' },
    'application/x-rar-compressed': { ext: 'rar', category: 'file' },
    'text/plain': { ext: 'txt', category: 'file' },
    'text/csv': { ext: 'csv', category: 'file' },
};

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const user = (locals as any).user as { id: number } | undefined;
        if (!user) {
            return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return new Response(JSON.stringify({ ok: false, error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validar tamaño
        if (file.size > MAX_FILE_SIZE) {
            return new Response(JSON.stringify({
                ok: false,
                error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validar tipo
        const fileInfo = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES];
        if (!fileInfo) {
            return new Response(JSON.stringify({
                ok: false,
                error: `File type not allowed: ${file.type}`
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Crear estructura de carpetas por fecha
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'internal', String(year), month);

        // Crear directorio si no existe
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // Generar nombre único
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `${timestamp}_${random}.${fileInfo.ext}`;
        const filepath = path.join(uploadDir, filename);

        // Guardar archivo
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filepath, buffer);

        // URL relativa para el frontend
        const url = `/uploads/internal/${year}/${month}/${filename}`;

        return new Response(JSON.stringify({
            ok: true,
            file: {
                url,
                name: file.name,
                size: file.size,
                mime: file.type,
                type: fileInfo.category
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({
            ok: false,
            error: error?.message || 'Upload failed'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
