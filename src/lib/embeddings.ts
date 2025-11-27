/**
 * Cliente para el servicio de embeddings local
 * Proporciona matching inteligente basado en semántica
 */

import { pool } from './db';

interface EmbeddingMatch {
  id: number;
  score: number;
  text: string;
}

interface SimilarityResponse {
  query: string;
  matches: EmbeddingMatch[];
  total_checked: number;
  threshold: number;
}

/**
 * Obtiene la URL del servicio de embeddings desde configuración
 */
async function getEmbeddingServiceUrl(): Promise<string> {
  const [rows] = await pool.query(
    'SELECT setting_value FROM auto_reply_settings WHERE setting_key = ?',
    ['embedding_service_url']
  );
  return (rows as any[])[0]?.setting_value || 'http://localhost:5001';
}

/**
 * Verifica si el servicio de embeddings está habilitado
 */
export async function isEmbeddingServiceEnabled(): Promise<boolean> {
  const [rows] = await pool.query(
    'SELECT setting_value FROM auto_reply_settings WHERE setting_key = ?',
    ['embedding_service_enabled']
  );
  return (rows as any[])[0]?.setting_value === 'true';
}

/**
 * Obtiene el umbral de similitud configurado
 */
async function getSimilarityThreshold(): Promise<number> {
  const [rows] = await pool.query(
    'SELECT setting_value FROM auto_reply_settings WHERE setting_key = ?',
    ['embedding_similarity_threshold']
  );
  return parseFloat((rows as any[])[0]?.setting_value || '0.7');
}

/**
 * Verifica si el servicio de embeddings está disponible
 */
export async function checkEmbeddingServiceHealth(): Promise<boolean> {
  try {
    const url = await getEmbeddingServiceUrl();
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 segundos timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Genera embeddings para un texto
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const url = await getEmbeddingServiceUrl();
    const response = await fetch(`${url}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text] }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.embeddings?.[0] || null;
  } catch (err) {
    console.error('Error generating embedding:', err);
    return null;
  }
}

/**
 * Genera y guarda embeddings para todas las reglas activas
 */
export async function generateAllRuleEmbeddings(): Promise<number> {
  const [rows] = await pool.query(
    'SELECT id, trigger_keywords FROM auto_replies WHERE is_active = TRUE'
  );

  const rules = rows as Array<{ id: number; trigger_keywords: string }>;
  let updated = 0;

  for (const rule of rules) {
    const embedding = await generateEmbedding(rule.trigger_keywords);
    if (embedding) {
      await pool.query(
        `UPDATE auto_replies
         SET embedding_vector = ?, embedding_generated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(embedding), rule.id]
      );
      updated++;
    }
  }

  return updated;
}

/**
 * Busca reglas de auto-respuesta usando embeddings
 * Retorna las reglas que tienen alta similitud semántica con el texto
 */
export async function findSimilarRules(
  messageText: string
): Promise<Array<{ id: number; score: number; priority: number }>> {
  try {
    // Verificar si está habilitado
    const enabled = await isEmbeddingServiceEnabled();
    if (!enabled) return [];

    // Obtener reglas activas con embeddings
    const [rows] = await pool.query(
      `SELECT id, trigger_keywords, embedding_vector, priority
       FROM auto_replies
       WHERE is_active = TRUE AND embedding_vector IS NOT NULL`
    );

    const rules = rows as Array<{
      id: number;
      trigger_keywords: string;
      embedding_vector: string;
      priority: number;
    }>;

    if (rules.length === 0) return [];

    // Preparar referencias para el servicio
    const references = rules.map((r) => ({
      id: r.id,
      text: r.trigger_keywords,
      priority: r.priority,
    }));

    // Llamar al servicio de embeddings
    const url = await getEmbeddingServiceUrl();
    const threshold = await getSimilarityThreshold();

    const response = await fetch(`${url}/similarity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: messageText,
        references,
        threshold,
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.error('Embedding service error:', response.statusText);
      return [];
    }

    const data: SimilarityResponse = await response.json();

    // Combinar scores con prioridad
    return data.matches.map((match) => {
      const rule = rules.find((r) => r.id === match.id);
      return {
        id: match.id,
        score: match.score,
        priority: rule?.priority || 0,
      };
    });
  } catch (err) {
    console.error('Error finding similar rules:', err);
    return [];
  }
}

/**
 * Genera embedding para una regla específica
 */
export async function updateRuleEmbedding(ruleId: number): Promise<boolean> {
  try {
    const [rows] = await pool.query(
      'SELECT trigger_keywords FROM auto_replies WHERE id = ?',
      [ruleId]
    );

    const rule = (rows as any[])[0];
    if (!rule) return false;

    const embedding = await generateEmbedding(rule.trigger_keywords);
    if (!embedding) return false;

    await pool.query(
      `UPDATE auto_replies
       SET embedding_vector = ?, embedding_generated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(embedding), ruleId]
    );

    return true;
  } catch (err) {
    console.error('Error updating rule embedding:', err);
    return false;
  }
}
