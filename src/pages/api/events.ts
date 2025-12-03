import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';

/**
 * Server-Sent Events endpoint para actualizaciones en tiempo real
 * Mejor alternativa a polling para Astro SSR
 */

// Store de clientes conectados
const clients = new Map<string, {
  controller: ReadableStreamDefaultController;
  userId: number;
  conversationId?: number;
  lastCheck: number;
}>();

// Función para enviar evento a un cliente específico
function sendEvent(clientId: string, event: string, data: any) {
  const client = clients.get(clientId);
  if (client) {
    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.controller.enqueue(new TextEncoder().encode(message));
    } catch {
      clients.delete(clientId);
    }
  }
}

// Función para broadcast a todos los clientes de una conversación
export function broadcastToConversation(conversationId: number, event: string, data: any) {
  console.log(`[SSE] Broadcasting ${event} to conversation ${conversationId}, total clients:`, clients.size);
  let sentCount = 0;
  clients.forEach((client, clientId) => {
    if (client.conversationId === conversationId) {
      console.log(`[SSE] Sending ${event} to client ${clientId}`);
      sendEvent(clientId, event, data);
      sentCount++;
    }
  });
  console.log(`[SSE] Sent ${event} to ${sentCount} clients for conversation ${conversationId}`);
}

// Función para broadcast a todos los clientes
export function broadcastToAll(event: string, data: any) {
  clients.forEach((_, clientId) => {
    sendEvent(clientId, event, data);
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user;
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversation_id');

  const clientId = `${user.sub}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let intervalId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      clients.set(clientId, {
        controller,
        userId: user.sub,
        conversationId: conversationId ? Number(conversationId) : undefined,
        lastCheck: Math.floor(Date.now() / 1000),
      });

      // Enviar heartbeat cada 30 segundos para mantener la conexión
      intervalId = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(intervalId);
          clients.delete(clientId);
        }
      }, 30000);

      // Polling interno cada 3 segundos para detectar nuevos mensajes
      const pollInterval = setInterval(async () => {
        const client = clients.get(clientId);
        if (!client) {
          clearInterval(pollInterval);
          return;
        }

        try {
          if (client.conversationId) {
            // Verificar nuevos mensajes en la conversación
            const [rows] = await pool.query(
              `SELECT m.id, m.conversacion_id, m.from_me, m.tipo, m.cuerpo, m.wa_msg_id, m.ts, m.status,
                      m.media_id, m.mime_type, m.is_auto_reply, m.usuario_id, u.nombre AS usuario_nombre
               FROM mensajes m
               LEFT JOIN usuarios u ON u.id = m.usuario_id
               WHERE m.conversacion_id = ? AND m.ts > ?
               ORDER BY m.ts ASC
               LIMIT 50`,
              [client.conversationId, client.lastCheck]
            );

            const messages = rows as any[];
            if (messages.length > 0) {
              sendEvent(clientId, 'messages', messages);
              client.lastCheck = Math.max(...messages.map(m => Number(m.ts)));
            }

            // Verificar cambios de estado
            const [statusRows] = await pool.query(
              `SELECT id, status FROM mensajes
               WHERE conversacion_id = ? AND from_me = 1 AND status_ts > ?`,
              [client.conversationId, client.lastCheck - 5]
            );
            if ((statusRows as any[]).length > 0) {
              sendEvent(clientId, 'status', statusRows);
            }

            // Verificar nuevos comentarios internos
            const [commentRows] = await pool.query(
              `SELECT c.id, c.conversacion_id, c.usuario_id, u.nombre AS usuario_nombre,
                      c.comentario, c.creado_en
               FROM comentarios_internos c
               LEFT JOIN usuarios u ON u.id = c.usuario_id
               WHERE c.conversacion_id = ? AND UNIX_TIMESTAMP(c.creado_en) > ?
               ORDER BY c.creado_en ASC`,
              [client.conversationId, client.lastCheck]
            );
            if ((commentRows as any[]).length > 0) {
              sendEvent(clientId, 'comments', commentRows);
            }
          } else {
            // Verificar nuevas conversaciones o actualizaciones
            const [rows] = await pool.query(
              `SELECT c.id, c.wa_user, c.wa_profile_name, c.estado, c.ultimo_msg, c.ultimo_ts,
                      c.asignado_a, u.nombre as asignado_nombre
               FROM conversaciones c
               LEFT JOIN usuarios u ON u.id = c.asignado_a
               WHERE c.ultimo_ts > ?
               ORDER BY c.ultimo_ts DESC
               LIMIT 20`,
              [client.lastCheck]
            );

            if ((rows as any[]).length > 0) {
              sendEvent(clientId, 'conversations', rows);
              client.lastCheck = Math.floor(Date.now() / 1000);
            }
          }
        } catch (err) {
          console.error('SSE poll error:', err);
        }
      }, 3000);

      // Limpiar al cerrar
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        clearInterval(pollInterval);
        clients.delete(clientId);
      });
    },
    cancel() {
      clearInterval(intervalId);
      clients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Para nginx
    },
  });
};
