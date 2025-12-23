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
 * @param {function} options.onCall - Callback cuando llega una llamada
 * @param {boolean} options.enabled - Si está habilitado (default: true)
 */
export function useRealtimeChat({
  conversationId,
  onMessage,
  onStatus,
  onConversations,
  onComments,
  onCall,
  enabled = true,
} = {}) {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // Usar refs para los callbacks para evitar reconexiones innecesarias
  const callbacksRef = useRef({
    onMessage,
    onStatus,
    onConversations,
    onComments,
    onCall,
  });

  // Actualizar refs cuando cambian los callbacks
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onStatus,
      onConversations,
      onComments,
      onCall,
    };
  }, [onMessage, onStatus, onConversations, onComments, onCall]);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Cerrar conexión anterior completamente
    if (eventSourceRef.current) {
      console.log('[SSE] Cerrando conexión anterior');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Limpiar timeout de reconexión pendiente
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const url = conversationId
      ? `${BASE}/api/events?conversation_id=${conversationId}`.replace(/\/\//g, '/')
      : `${BASE}/api/events`.replace(/\/\//g, '/');

    try {
      console.log('[SSE] Conectando a:', url);
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[SSE] Conectado exitosamente');
        reconnectAttempts.current = 0;
      };

      es.onerror = (err) => {
        console.error('[SSE] Error:', err);

        // Cerrar y limpiar la referencia
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Reconectar con backoff exponencial (solo si está habilitado)
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[SSE] Reconectando...');
            connect();
          }, delay);
        }
      };

      // Escuchar eventos de mensajes
      es.addEventListener('messages', (e) => {
        try {
          const messages = JSON.parse(e.data);
          callbacksRef.current.onMessage?.(messages);
        } catch (err) {
          console.error('[SSE] Error parsing messages:', err);
        }
      });

      // Escuchar eventos de estado
      es.addEventListener('status', (e) => {
        try {
          const statuses = JSON.parse(e.data);
          callbacksRef.current.onStatus?.(statuses);
        } catch (err) {
          console.error('[SSE] Error parsing status:', err);
        }
      });

      // Escuchar eventos de conversaciones
      es.addEventListener('conversations', (e) => {
        try {
          const conversations = JSON.parse(e.data);
          callbacksRef.current.onConversations?.(conversations);
        } catch (err) {
          console.error('[SSE] Error parsing conversations:', err);
        }
      });

      // Escuchar eventos de comentarios internos
      es.addEventListener('comments', (e) => {
        try {
          const comments = JSON.parse(e.data);
          callbacksRef.current.onComments?.(comments);
        } catch (err) {
          console.error('[SSE] Error parsing comments:', err);
        }
      });

      // Escuchar eventos de llamadas
      es.addEventListener('call', (e) => {
        try {
          const callData = JSON.parse(e.data);
          callbacksRef.current.onCall?.(callData);
        } catch (err) {
          console.error('[SSE] Error parsing call:', err);
        }
      });

    } catch (err) {
      console.error('[SSE] Error al crear conexión:', err);
    }
  }, [conversationId, enabled]); // Solo depende de conversationId y enabled

  useEffect(() => {
    connect();

    return () => {
      console.log('[SSE] Limpiando conexión');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  // Función para reconectar manualmente
  const reconnect = useCallback(() => {
    console.log('[SSE] Reconexión manual solicitada');
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return { reconnect };
}

export default useRealtimeChat;
