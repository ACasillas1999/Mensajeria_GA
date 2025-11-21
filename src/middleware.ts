import { defineMiddleware } from 'astro:middleware';
import jwt from 'jsonwebtoken';

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(';').forEach((kv) => {
    const [k, ...rest] = kv.split('=');
    const key = k.trim();
    const val = rest.join('=').trim();
    if (key) out[key] = decodeURIComponent(val || '');
  });
  return out;
}

// Solo login es público (y assets). Si usas webhooks externos,
// considera agregar '/api/webhook' aquí también.
const base = import.meta.env.BASE_URL || '/';
const PUBLIC_SET = new Set([
  '/login',
  '/api/login',
  '/api/webhook',
  `${base}/login`.replace(/\/\//g, '/'),
  `${base}/api/login`.replace(/\/\//g, '/'),
  `${base}/api/webhook`.replace(/\/\//g, '/'),
]);
// Rutas que deben ser públicas por prefijo (coincide con startsWith)
const PUBLIC_PREFIXES: string[] = [
  '/api/media/',
];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { url, request, locals } = ctx;
  const { pathname } = url;

  // Allow static assets, framework assets, and declared public paths
  const isAsset = /\.(css|js|mjs|png|jpg|jpeg|svg|gif|ico|mp3|webp|woff2?|map)$/i.test(pathname);
  const isFramework = pathname.startsWith('/_image') || pathname.startsWith('/@fs') || pathname.startsWith('/node_modules');
  const isPublicExact = PUBLIC_SET.has(pathname);
  const isPublicPrefix = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublic = isAsset || isFramework || isPublicExact || isPublicPrefix;

  // For APIs: attach user to locals if present
  const isApi = pathname.startsWith('/api/');

  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies['auth'];

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      (locals as any).user = {
        id: payload.sub,
        rol: payload.rol,
        nombre: payload.nombre,
        sucursal_id: payload.sucursal_id ?? null,
        sucursal: payload.sucursal ?? null,
      };
    } catch {
      // invalid token: ignore; user stays undefined
    }
  }

  // Público o assets pasan directo
  if (isPublic) {
    const res = await next();
    try { res.headers.set('x-guard', isPublicExact ? 'public' : 'public-prefix'); } catch {}
    return res;
  }

  // Para APIs no públicas: exigir auth y responder 401 JSON si falta
  if (isApi && !(locals as any).user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'x-guard': 'api-401' },
    });
  }

  // For non-public pages, require auth
  if (!(locals as any).user) {
    const base = import.meta.env.BASE_URL || '/';
    const target = `${base}/login`.replace(/\/\//g, '/') + (pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '');
    const res = Response.redirect(new URL(target, url.origin), 302);
    try { res.headers.set('x-guard', 'redirect'); } catch {}
    return res;
  }

  const ok = await next();
  try { ok.headers.set('x-guard', 'ok'); } catch {}
  return ok;
});

