import type { RowDataPacket } from 'mysql2/promise';
import { pool } from './db';

/**
 * Returns a valid status id for new conversations.
 * Priority: active default -> first active -> first available -> null.
 */
export async function getFallbackConversationStatusId(): Promise<number | null> {
  const [defaultStatusRows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM conversation_statuses
     WHERE is_default = TRUE AND is_active = TRUE
     ORDER BY display_order ASC, id ASC
     LIMIT 1`
  );

  if (defaultStatusRows.length > 0 && defaultStatusRows[0].id != null) {
    return Number(defaultStatusRows[0].id);
  }

  const [activeStatusRows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM conversation_statuses
     WHERE is_active = TRUE
     ORDER BY display_order ASC, id ASC
     LIMIT 1`
  );

  if (activeStatusRows.length > 0 && activeStatusRows[0].id != null) {
    return Number(activeStatusRows[0].id);
  }

  const [anyStatusRows] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM conversation_statuses
     ORDER BY display_order ASC, id ASC
     LIMIT 1`
  );

  if (anyStatusRows.length > 0 && anyStatusRows[0].id != null) {
    return Number(anyStatusRows[0].id);
  }

  return null;
}
