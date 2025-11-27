import type { APIRoute } from 'astro';
import {
  generateAllRuleEmbeddings,
  checkEmbeddingServiceHealth,
  isEmbeddingServiceEnabled
} from '../../lib/embeddings';

/**
 * Endpoint para generar embeddings de todas las reglas
 * POST /api/generate-embeddings
 *
 * Uso:
 * curl -X POST http://localhost:4321/api/generate-embeddings
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    // Verificar autenticación
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si el servicio está habilitado
    const enabled = await isEmbeddingServiceEnabled();
    if (!enabled) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Embedding service is disabled. Enable it in auto_reply_settings.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si el servicio está disponible
    const healthy = await checkEmbeddingServiceHealth();
    if (!healthy) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Embedding service is not available. Make sure it is running on port 5001.'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generar embeddings
    const updated = await generateAllRuleEmbeddings();

    return new Response(
      JSON.stringify({
        ok: true,
        updated,
        message: `Successfully generated embeddings for ${updated} rules`
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

/**
 * Obtiene el estado del servicio de embeddings
 * GET /api/generate-embeddings
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const user = (locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const enabled = await isEmbeddingServiceEnabled();
    const healthy = enabled ? await checkEmbeddingServiceHealth() : false;

    return new Response(
      JSON.stringify({
        ok: true,
        enabled,
        healthy,
        status: healthy ? 'operational' : enabled ? 'offline' : 'disabled'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
