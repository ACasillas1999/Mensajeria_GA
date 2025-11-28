/**
 * Sistema de auto-aprendizaje: Sugerencias automáticas de reglas
 * Analiza mensajes no reconocidos y sugiere crear nuevas reglas
 */

import { pool } from './db';
import { findSimilarRules, isEmbeddingServiceEnabled } from './embeddings';

interface RuleSuggestion {
  id: number;
  suggested_phrase: string;
  occurrence_count: number;
  first_seen: Date;
  last_seen: Date;
  status: 'pending' | 'approved' | 'rejected' | 'auto_created';
  priority_score: number;
  closest_existing_rule_id: number | null;
  closest_existing_score: number | null;
}

/**
 * Obtiene configuración del sistema de sugerencias
 */
async function getSetting(key: string): Promise<string | null> {
  const [rows] = await pool.query(
    'SELECT setting_value FROM auto_reply_settings WHERE setting_key = ?',
    [key]
  );
  return (rows as any[])[0]?.setting_value || null;
}

/**
 * Procesa mensajes no reconocidos y genera sugerencias
 * Se ejecuta periódicamente o después de cada mensaje no reconocido
 */
export async function processRuleSuggestions(): Promise<void> {
  try {
    const enabled = (await getSetting('suggestions_enabled')) === 'true';
    if (!enabled) return;

    const minOccurrences = parseInt((await getSetting('suggestion_min_occurrences')) || '5', 10);
    const timeWindowDays = parseInt((await getSetting('suggestion_time_window_days')) || '7', 10);
    const similarityThreshold = parseFloat((await getSetting('suggestion_similarity_threshold')) || '0.75');

    // Obtener mensajes no reconocidos recientes que no están en ninguna sugerencia
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

    const [unprocessedMessages] = await pool.query(
      `SELECT um.id, um.message_text, um.closest_match_id, um.closest_match_score
       FROM unrecognized_messages um
       WHERE um.created_at >= ?
         AND um.resolved = FALSE
         AND NOT EXISTS (
           SELECT 1 FROM suggestion_messages sm WHERE sm.unrecognized_message_id = um.id
         )
       ORDER BY um.created_at DESC
       LIMIT 100`,
      [cutoffDate]
    );

    const messages = unprocessedMessages as Array<{
      id: number;
      message_text: string;
      closest_match_id: number | null;
      closest_match_score: number | null;
    }>;

    if (messages.length === 0) return;

    console.log(`[Suggestions] Processing ${messages.length} unrecognized messages`);

    // Agrupar mensajes similares
    const groups = await groupSimilarMessages(messages, similarityThreshold);

    // Crear o actualizar sugerencias
    for (const group of groups) {
      if (group.messages.length >= minOccurrences) {
        await createOrUpdateSuggestion(group);
      } else {
        // Si no alcanza el mínimo, añadir a una sugerencia existente si es muy similar
        await tryAddToExistingSuggestion(group, similarityThreshold);
      }
    }

    console.log(`[Suggestions] Created/updated suggestions for ${groups.length} groups`);
  } catch (error) {
    console.error('Error processing rule suggestions:', error);
  }
}

/**
 * Agrupa mensajes similares usando embeddings o texto exacto
 */
async function groupSimilarMessages(
  messages: Array<{ id: number; message_text: string }>,
  threshold: number
): Promise<Array<{ phrase: string; messages: Array<{ id: number; message_text: string; similarity: number }> }>> {
  const groups: Array<{
    phrase: string;
    messages: Array<{ id: number; message_text: string; similarity: number }>;
  }> = [];

  const embeddingEnabled = await isEmbeddingServiceEnabled();

  for (const message of messages) {
    let addedToGroup = false;

    if (embeddingEnabled) {
      // TODO: Implementar agrupación por embeddings
      // Por ahora usamos texto exacto/similar
    }

    // Agrupar por texto similar (simple matching)
    for (const group of groups) {
      const similarity = calculateTextSimilarity(message.message_text, group.phrase);
      if (similarity >= threshold) {
        group.messages.push({
          id: message.id,
          message_text: message.message_text,
          similarity,
        });
        addedToGroup = true;
        break;
      }
    }

    // Si no se añadió a ningún grupo, crear uno nuevo
    if (!addedToGroup) {
      groups.push({
        phrase: message.message_text,
        messages: [{ id: message.id, message_text: message.message_text, similarity: 1.0 }],
      });
    }
  }

  return groups;
}

/**
 * Calcula similitud entre dos textos (simple Jaccard similarity)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '');

  const t1 = normalize(text1);
  const t2 = normalize(text2);

  if (t1 === t2) return 1.0;

  const words1 = new Set(t1.split(/\s+/));
  const words2 = new Set(t2.split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Crea o actualiza una sugerencia basada en un grupo de mensajes
 */
async function createOrUpdateSuggestion(group: {
  phrase: string;
  messages: Array<{ id: number; message_text: string; similarity: number }>;
}): Promise<void> {
  // Calcular priority score basado en frecuencia y recencia
  const occurrenceCount = group.messages.length;
  const priorityScore = Math.log(occurrenceCount + 1) * 10; // Score logarítmico

  // Buscar la regla existente más cercana
  let closestRuleId: number | null = null;
  let closestScore: number | null = null;

  try {
    const embeddingEnabled = await isEmbeddingServiceEnabled();
    if (embeddingEnabled) {
      const matches = await findSimilarRules(group.phrase);
      if (matches.length > 0) {
        const best = matches[0];
        closestRuleId = best.id;
        closestScore = best.score;
      }
    }
  } catch (err) {
    console.error('Error finding closest rule:', err);
  }

  // Buscar si ya existe una sugerencia similar
  const [existing] = await pool.query(
    `SELECT id FROM rule_suggestions
     WHERE suggested_phrase = ? AND status = 'pending'
     LIMIT 1`,
    [group.phrase]
  );

  let suggestionId: number;

  if ((existing as any[]).length > 0) {
    // Actualizar sugerencia existente
    suggestionId = (existing as any[])[0].id;

    await pool.query(
      `UPDATE rule_suggestions
       SET occurrence_count = ?,
           priority_score = ?,
           closest_existing_rule_id = ?,
           closest_existing_score = ?,
           last_seen = NOW()
       WHERE id = ?`,
      [occurrenceCount, priorityScore, closestRuleId, closestScore, suggestionId]
    );

    console.log(`[Suggestions] Updated suggestion ${suggestionId}: "${group.phrase}" (${occurrenceCount} occurrences)`);
  } else {
    // Crear nueva sugerencia
    const [result] = await pool.query(
      `INSERT INTO rule_suggestions (
        suggested_phrase,
        occurrence_count,
        priority_score,
        closest_existing_rule_id,
        closest_existing_score
      ) VALUES (?, ?, ?, ?, ?)`,
      [group.phrase, occurrenceCount, priorityScore, closestRuleId, closestScore]
    );

    suggestionId = (result as any).insertId;
    console.log(`[Suggestions] Created suggestion ${suggestionId}: "${group.phrase}" (${occurrenceCount} occurrences)`);
  }

  // Vincular mensajes a la sugerencia
  for (const msg of group.messages) {
    await pool.query(
      `INSERT INTO suggestion_messages (suggestion_id, unrecognized_message_id, similarity_score)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE similarity_score = VALUES(similarity_score)`,
      [suggestionId, msg.id, msg.similarity]
    );
  }
}

/**
 * Intenta añadir un grupo pequeño a una sugerencia existente si es muy similar
 */
async function tryAddToExistingSuggestion(
  group: { phrase: string; messages: Array<{ id: number; message_text: string; similarity: number }> },
  threshold: number
): Promise<void> {
  const [suggestions] = await pool.query(
    `SELECT id, suggested_phrase FROM rule_suggestions WHERE status = 'pending'`
  );

  for (const suggestion of suggestions as any[]) {
    const similarity = calculateTextSimilarity(group.phrase, suggestion.suggested_phrase);

    if (similarity >= threshold) {
      // Añadir mensajes a esta sugerencia
      for (const msg of group.messages) {
        await pool.query(
          `INSERT INTO suggestion_messages (suggestion_id, unrecognized_message_id, similarity_score)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE similarity_score = VALUES(similarity_score)`,
          [suggestion.id, msg.id, msg.similarity]
        );
      }

      // Actualizar contador
      await pool.query(
        `UPDATE rule_suggestions
         SET occurrence_count = occurrence_count + ?,
             priority_score = LOG(occurrence_count + ? + 1) * 10,
             last_seen = NOW()
         WHERE id = ?`,
        [group.messages.length, group.messages.length, suggestion.id]
      );

      console.log(
        `[Suggestions] Added ${group.messages.length} messages to existing suggestion ${suggestion.id}`
      );
      return;
    }
  }
}

/**
 * Obtiene sugerencias pendientes con notificación
 */
export async function getPendingSuggestions(minOccurrences: number = 5): Promise<RuleSuggestion[]> {
  const [rows] = await pool.query(
    `SELECT * FROM rule_suggestions
     WHERE status = 'pending'
       AND occurrence_count >= ?
     ORDER BY priority_score DESC, occurrence_count DESC
     LIMIT 20`,
    [minOccurrences]
  );

  return rows as RuleSuggestion[];
}

/**
 * Aprueba una sugerencia y crea la regla automáticamente
 */
export async function approveSuggestion(
  suggestionId: number,
  responseText: string,
  matchType: 'exact' | 'contains' | 'starts_with' = 'contains'
): Promise<number> {
  // Obtener la sugerencia
  const [rows] = await pool.query('SELECT * FROM rule_suggestions WHERE id = ?', [suggestionId]);

  const suggestion = (rows as any[])[0];
  if (!suggestion) {
    throw new Error('Suggestion not found');
  }

  // Crear la regla
  const [result] = await pool.query(
    `INSERT INTO auto_replies (
      name,
      trigger_keywords,
      response_text,
      priority,
      match_type,
      case_sensitive,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      suggestion.suggested_phrase.substring(0, 100), // Usar primeras 100 chars como nombre
      suggestion.suggested_phrase,
      responseText,
      5, // Prioridad media
      matchType,
      false, // No case-sensitive
      true, // Activa
    ]
  );

  const ruleId = (result as any).insertId;

  // Actualizar sugerencia
  await pool.query(
    `UPDATE rule_suggestions
     SET status = 'approved',
         created_rule_id = ?
     WHERE id = ?`,
    [ruleId, suggestionId]
  );

  // Marcar mensajes relacionados como resueltos
  await pool.query(
    `UPDATE unrecognized_messages um
     INNER JOIN suggestion_messages sm ON um.id = sm.unrecognized_message_id
     SET um.resolved = TRUE
     WHERE sm.suggestion_id = ?`,
    [suggestionId]
  );

  console.log(`[Suggestions] Approved suggestion ${suggestionId} and created rule ${ruleId}`);

  return ruleId;
}

/**
 * Rechaza una sugerencia
 */
export async function rejectSuggestion(suggestionId: number, notes?: string): Promise<void> {
  await pool.query(
    `UPDATE rule_suggestions
     SET status = 'rejected',
         admin_notes = ?
     WHERE id = ?`,
    [notes || null, suggestionId]
  );

  console.log(`[Suggestions] Rejected suggestion ${suggestionId}`);
}
