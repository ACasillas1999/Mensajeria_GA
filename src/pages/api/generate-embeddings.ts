import type { APIRoute } from 'astro';
import {
  checkEmbeddingServiceHealth,
  isEmbeddingServiceEnabled,
  generateAllRuleEmbeddings,
} from '../../lib/embeddings';

function requireAdmin(locals: any): { ok: boolean; error?: string } {
  const user = locals?.user;
  if (!user || user.rol !== 'ADMIN') {
    return { ok: false, error: 'No autorizado' };
  }
  return { ok: true };
}

/**
 * GET /api/generate-embeddings
 * Verifica el estado del servicio de embeddings
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const enabled = await isEmbeddingServiceEnabled();
    const healthy = await checkEmbeddingServiceHealth();

    return new Response(
      JSON.stringify({
        ok: true,
        enabled,
        healthy,
        status: healthy ? 'operational' : 'offline',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error checking embedding service:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/generate-embeddings
 * Regenera embeddings para todas las reglas activas
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    const auth = requireAdmin(locals);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const enabled = await isEmbeddingServiceEnabled();
    if (!enabled) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'El servicio de embeddings está desactivado. Actívalo en la configuración.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const healthy = await checkEmbeddingServiceHealth();
    if (!healthy) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'El servicio de embeddings no está disponible. Verifica que esté corriendo en el puerto 5001.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await generateAllRuleEmbeddings();

    return new Response(
      JSON.stringify({
        ok: true,
        updated,
        message: `Embeddings generados exitosamente para ${updated} reglas`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error generating embeddings:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
