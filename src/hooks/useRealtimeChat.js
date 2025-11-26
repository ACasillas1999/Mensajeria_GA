import { useEffect, useRef, useCallback } from 'react';

const BASE = import.meta.env.BASE_URL || '';

/**
 * Hook para recibir actualizaciones en tiempo real via SSE
 * @param {Object} options
 * @param {number} options.conversationId - ID de la conversación a escuchar (opcional)
 * @param {function} options.onMessage - Callback cuando llegan nuevos mensajes
 * @param {function} options.onStatus - Callback cuando cambian estados de mensajes
 * @param {function} options.onConversations - Callback cuando se actualizan conversaciones
 * @param {function} options.onComments - Callback cuando se crean nuevos comentarios internos
 * @param {boolean} options.enabled - Si está habilitado (default: true)
 */
export function useRealtimeChat({
  conversationId,
  onMessage,
  onStatus,
  onConversations,
  onComments,
  enabled = true,
} = {}) {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Limpiar conexión anterior
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = conversationId
      ? `${BASE}/api/events?conversation_id=${conversationId}`.replace(/\/\//g, '/')
      : `${BASE}/api/events`.replace(/\/\//g, '/');

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[SSE] Conectado');
        reconnectAttempts.current = 0;
      };

      es.onerror = (err) => {
        console.error('[SSE] Error:', err);
        es.close();

        // Reconectar con backoff exponencial
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Reconectando...');
          connect();
        }, delay);
      };

      // Escuchar eventos de mensajes
      es.addEventListener('messages', (e) => {
        try {
          const messages = JSON.parse(e.data);
          onMessage?.(messages);
        } catch {}
      });

      // Escuchar eventos de estado
      es.addEventListener('status', (e) => {
        try {
          const statuses = JSON.parse(e.data);
          onStatus?.(statuses);
        } catch {}
      });

      // Escuchar eventos de conversaciones
      es.addEventListener('conversations', (e) => {
        try {
          const conversations = JSON.parse(e.data);
          onConversations?.(conversations);
        } catch {}
      });

      // Escuchar eventos de comentarios internos
      es.addEventListener('comments', (e) => {
        try {
          const comments = JSON.parse(e.data);
          onComments?.(comments);
        } catch {}
      });

    } catch (err) {
      console.error('[SSE] Error al crear conexión:', err);
    }
  }, [conversationId, enabled, onMessage, onStatus, onConversations, onComments]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Función para reconectar manualmente
  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return { reconnect };
}

export default useRealtimeChat;
