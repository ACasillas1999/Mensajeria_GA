import { useState, useEffect, useRef, memo } from 'react';

const BASE = import.meta.env.BASE_URL || '';

const QuickChatModal = memo(function QuickChatModal({ conversationId, onClose, onOpenFull }) {
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [conversationId]);

  async function loadData() {
    setLoading(true);
    try {
      // Cargar conversación y mensajes en paralelo
      const [convRes, msgsRes] = await Promise.all([
        fetch(`${BASE}/api/conversations/${conversationId}`.replace(/\/\//g, '/')),
        fetch(`${BASE}/api/messages/quick?conversation_id=${conversationId}`.replace(/\/\//g, '/'))
      ]);

      const convData = await convRes.json();
      const msgsData = await msgsRes.json();

      if (convData.ok) setConversation(convData.conversation);
      if (msgsData.ok) setMessages(msgsData.items || []);
    } catch (err) {
      console.error('Error loading quick view:', err);
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          text: newMessage.trim()
        })
      });

      if (res.ok) {
        setNewMessage('');
        // Recargar mensajes
        setTimeout(loadData, 500);
      }
    } catch (err) {
      console.error('Error sending:', err);
    } finally {
      setSending(false);
    }
  }

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-950 rounded-xl border border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-700/50 flex items-center justify-center text-emerald-300 font-bold">
              {conversation?.title?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">
                {conversation?.title || 'Cargando...'}
              </h3>
              <p className="text-xs text-slate-400">{conversation?.wa_user}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFull}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600/20 border border-emerald-700 text-emerald-300 hover:bg-emerald-600/30 transition"
            >
              🔗 Abrir completo
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-800 transition flex items-center justify-center text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-2"></div>
                <div className="text-sm text-slate-400">Cargando mensajes...</div>
              </div>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-400">
              No hay mensajes
            </div>
          )}

          {!loading && messages.map(m => (
            <div
              key={m.id}
              className={`max-w-[75%] px-3 py-2 rounded-lg ${
                m.sender === 'me'
                  ? 'ml-auto bg-emerald-600/20 border border-emerald-700'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{m.text}</div>
              <div className="text-[10px] text-slate-400 mt-1">
                {new Date(m.ts * 1000).toLocaleTimeString('es-MX', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <form onSubmit={sendMessage} className="p-4 border-t border-slate-800 bg-slate-900/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje rápido..."
              disabled={sending}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-emerald-400 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            💡 Tip: Presiona ESC para cerrar
          </div>
        </form>
      </div>
    </div>
  );
});

export default QuickChatModal;
