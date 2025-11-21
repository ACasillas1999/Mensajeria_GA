/**
 * WebSocket Hub para comunicación en tiempo real
 * Se conecta al servidor Node.js principal
 */

// Almacén de conexiones activas por conversación
type WSConnection = {
  ws: WebSocket;
  userId: number;
  conversationId?: number;
};

const connections = new Map<string, WSConnection>();

// Event emitter simple para notificar cambios
type EventCallback = (data: any) => void;
const eventListeners = new Map<string, Set<EventCallback>>();

export function subscribe(event: string, callback: EventCallback): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);

  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

export function emit(event: string, data: any): void {
  eventListeners.get(event)?.forEach(cb => {
    try {
      cb(data);
    } catch (e) {
      console.error('Error in event listener:', e);
    }
  });
}

// Notificar nuevo mensaje a todos los que escuchan esa conversación
export function notifyNewMessage(conversationId: number, message: any): void {
  emit(`conversation:${conversationId}:message`, message);
  emit('conversations:update', { conversationId, lastMessage: message });
}

// Notificar cambio de estado de mensaje
export function notifyMessageStatus(conversationId: number, messageId: string, status: string): void {
  emit(`conversation:${conversationId}:status`, { messageId, status });
}

// Notificar nueva conversación
export function notifyNewConversation(conversation: any): void {
  emit('conversations:new', conversation);
}
