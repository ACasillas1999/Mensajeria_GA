import { useEffect, useRef, useState, useCallback, memo, lazy, Suspense } from "react";
import MediaModal from "./MediaModal.jsx";
import QuickReplies from "./QuickReplies.jsx";
import ConversationTraceView from "./ConversationTraceView.jsx";

// Lazy load heavy components
const TemplatePicker = lazy(() => import("./TemplatePicker.jsx"));
const LocationPicker = lazy(() => import("./LocationPicker.jsx"));
const LocationMessage = lazy(() => import("./LocationMessage.jsx"));
import { useRealtimeChat } from "../hooks/useRealtimeChat.js";
import { useAppData } from "../contexts/AppDataContext.jsx";

const BASE = import.meta.env.BASE_URL || '';

// sonido (coloca public/ding.mp3) respetando el base path
const ding = typeof Audio !== "undefined"
  ? new Audio(`${BASE}/ding.mp3`.replace(/\/\//g, '/'))
  : null;

/* Muestra imágenes / videos / audios / docs / stickers */
const MediaBubble = memo(function MediaBubble({ m, onOpen, onImageLoad }) {
  const mime = (m.mime_type || "").toLowerCase();
  const kind =
    m.tipo ||
    (mime.startsWith("image/") ? "image" :
     mime.startsWith("video/") ? "video" :
     mime.startsWith("audio/") ? "audio" : "document");

  const src = m.media_url || (m.media_id ? `${BASE}/api/media/${m.media_id}`.replace(/\/\//g, '/') : null);

  // Stickers son imágenes WebP que se muestran más pequeñas
  if (kind === "sticker" && src) {
    return (
      <button onClick={() => onOpen?.("image", src)} className="group">
        <img
          src={src}
          loading="lazy"
          decoding="async"
          className="max-w-[150px] rounded transition-transform group-hover:scale-105"
          alt="sticker"
          onLoad={onImageLoad}
        />
      </button>
    );
  }

  if (kind === "image" && src) {
    return (
      <button onClick={() => onOpen?.("image", src)} className="group">
        <img
          src={src}
          loading="lazy"
          decoding="async"
          className="max-w-xs rounded border border-slate-700 transition-transform group-hover:scale-[1.02]"
          alt="imagen"
          onLoad={onImageLoad}
        />
      </button>
    );
  }

  if (kind === "video" && src) {
    return (
      <div className="relative">
        <video
          src={src}
          className="max-w-md rounded border border-slate-700"
          muted
          controls={false}
        />
        <button
          onClick={() => onOpen?.("video", src)}
          className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
          title="Ver en grande"
        >
          <span className="text-white text-lg bg-black/60 px-3 py-1 rounded">▶ Ver</span>
        </button>
      </div>
    );
  }

  if (kind === "audio" && src) return <audio src={src} controls className="w-64" />;
  if (src && kind === "document") {
    return (
      <a href={src} target="_blank" className="underline text-emerald-300" rel="noreferrer">
        Abrir archivo
      </a>
    );
  }

  return <div className="text-sm whitespace-pre-wrap">{m.text}</div>;
});

function StatusBadge({ s }) {
  if (!s) return null;
  // 'sending' (local), 'sent','delivered','read','failed'
  if (s === "sending")   return <span title="Enviando" className="text-[10px] text-slate-400">⏳</span>;
  if (s === "sent")      return <span title="Enviado" className="text-[10px] text-slate-400">✓</span>;
  if (s === "delivered") return <span title="Entregado" className="text-[10px] text-slate-400">✓✓</span>;
  if (s === "read")      return <span title="Leído" className="text-[10px] text-sky-400">✓✓</span>;
  if (s === "failed")    return <span title="Fallido" className="text-[10px] text-amber-400">⚠️</span>;
  return null;
}

/* Componente para evento del sistema (visible solo para agentes, no se envía al cliente) */
function SystemEvent({ evento }) {
  const iconos = {
    'asignacion': '👤',
    'reasignacion': '🔄',
    'cambio_estado': '📌',
    'nota_sistema': 'ℹ️'
  };

  // Parsear evento_data si existe
  let eventoData = null;
  try {
    eventoData = evento.evento_data
      ? (typeof evento.evento_data === 'string' ? JSON.parse(evento.evento_data) : evento.evento_data)
      : null;
  } catch (e) {
    console.error('Error parsing evento_data:', e);
  }

  // Verificar si hay field_data en el evento
  const fieldData = eventoData?.field_data;

  return (
    <div className="flex justify-center my-3">
      <div className="max-w-lg px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="text-base">{iconos[evento.tipo] || 'ℹ️'}</span>
          <span>{evento.texto}</span>
        </div>

        {/* Mostrar datos de campos personalizados si existen */}
        {fieldData && Object.keys(fieldData).length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 text-left">
            <div className="text-[10px] text-slate-500 mb-2 font-semibold text-center">Información adicional:</div>
            <div className="space-y-1.5 bg-slate-800/30 rounded px-3 py-2">
              {Object.entries(fieldData).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-[11px] text-slate-400 min-w-fit">
                    {key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:
                  </span>
                  <span className="text-[11px] text-emerald-300 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-slate-500 mt-1">
          {new Date(evento.creado_en).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/* Componente para comentario interno en el timeline */
function InlineComment({ comentario }) {
  return (
    <div className="flex justify-start my-3 px-2">
      <div className="max-w-[70%] px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-800/40">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">💬</span>
          <span className="text-xs font-semibold text-amber-300">
            Comentario interno - {comentario.usuario_nombre || 'Usuario'}
          </span>
        </div>
        <div className="text-sm text-amber-100/90 whitespace-pre-wrap">
          {comentario.comentario}
        </div>
        <div className="text-[10px] text-amber-600/60 mt-2">
          {new Date(comentario.creado_en).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/* Modal de campos personalizados al cambiar de estado */
function StatusFieldsModal({ status, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // required_fields puede venir como array (ya parseado por MySQL) o como string JSON
  const fields = status?.required_fields
    ? (Array.isArray(status.required_fields)
        ? status.required_fields
        : JSON.parse(status.required_fields))
    : [];

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validar campos requeridos
    const newErrors = {};
    fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = 'Este campo es obligatorio';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (field) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    const updateValue = (val) => {
      setFormData({ ...formData, [field.name]: val });
      if (errors[field.name]) {
        setErrors({ ...errors, [field.name]: null });
      }
    };

    const commonClasses = "w-full px-3 py-2 bg-slate-900 border rounded outline-none focus:border-emerald-400 " +
      (error ? "border-red-500" : "border-slate-700");

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.placeholder || ''}
            rows={4}
            className={commonClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            className={commonClasses}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            className={commonClasses}
          >
            <option value="">-- Seleccionar --</option>
            {(field.options || []).map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            className={commonClasses}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4">
          <h3 className="text-lg font-bold">
            Información requerida para: <span className="text-emerald-400">{status?.name}</span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Completa los siguientes campos antes de cambiar el estado
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {fields.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <p className="text-red-400 text-xs mt-1">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
              Confirmar cambio de estado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChatPane({ conversation }) {
  const { statuses, quickReplies: allQuickReplies, users, reloadQuickReplies, reloadStatuses } = useAppData();
  const [items, setItems] = useState([]);
  const [systemEvents, setSystemEvents] = useState([]); // Eventos del sistema (asignaciones, cambios de estado)
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]); // IDs de mensajes que coinciden con la búsqueda
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1); // Índice del resultado actual
  const [sseEnabled, setSseEnabled] = useState(false); // Habilitar SSE solo después de carga inicial

  // notificaciones
  const prevIncomingCountRef = useRef(0);
  const initialLoadDone = useRef(false); // Flag para saber si ya pasó la carga inicial
  const isInitialLoad = useRef(true); // Flag para primera carga de conversación
  const abortControllerRef = useRef(null); // Para cancelar requests duplicados

  // modal media
  const [modal, setModal] = useState({ open: false, kind: null, src: null });
  const openMedia = (kind, src) => setModal({ open: true, kind, src });
  const closeMedia = () => setModal({ open: false, kind: null, src: null });
  const [attach, setAttach] = useState({ open:false, items:[] });
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // comentarios internos
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  // selector de reacciones
  const [reactionPicker, setReactionPicker] = useState({ show: false, msgId: null });

  // modal de campos personalizados al cambiar estado
  const [statusChangeModal, setStatusChangeModal] = useState({ show: false, newStatusId: null, status: null });

  // paginación de mensajes
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  // composer
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [insideWindow, setInsideWindow] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null); // tiempo restante en ms
  const [lastInboundTime, setLastInboundTime] = useState(null); // timestamp del último mensaje entrante

  // llamadas
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null); // {call_id, from, to, status}

  // trazabilidad
  const [showTraceView, setShowTraceView] = useState(false);

  // atajos de respuestas rápidas (usar el caché del contexto)
  const shortcuts = allQuickReplies.filter(i => i.atajo);
  // menú de sugerencias de atajos
  const [shortcutSuggestions, setShortcutSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  // audio recorder
  const [recState, setRecState] = useState({ recording:false, seconds:0, blob:null });
  const mediaRef = useRef(null);
  const recTimerRef = useRef(null);
  const chunksRef = useRef([]);
function pickMime() {
  const cand = [
    'audio/webm;codecs=opus', // Chrome/Edge
    'audio/webm',
    'audio/ogg;codecs=opus',  // Firefox
    'audio/ogg',
    'audio/mp4'               // Safari 17+
  ];
  for (const t of cand) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return ''; // dejar que el navegador elija
}

  async function startRecording() {
  try {
    // Verificar soporte del navegador
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('❌ Tu navegador no soporta grabación de audio.\n\nUsa Chrome, Firefox o Edge actualizado.');
      return;
    }

    // 0) Requisito: HTTPS o localhost o red local
    const isLocalNetwork = location.hostname.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\./);
    const secure = location.protocol === 'https:' ||
                   ['localhost','127.0.0.1'].includes(location.hostname) ||
                   isLocalNetwork;

    if (!secure) {
      alert('⚠️ La grabación de audio requiere HTTPS.\n\nTu URL: ' + location.protocol + '//' + location.hostname);
      return;
    }

    // 1) Pide micrófono con constraints razonables
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        noiseSuppression: true,
        echoCancellation: true,
        sampleRate: 48000
      }
    });

    if (!stream || stream.getAudioTracks().length === 0) {
      alert('No hay pista de audio disponible.');
      return;
    }

    // 2) Negocia MIME soportado
    const mimeType = pickMime();
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
    mr.onerror = (ev) => {
      console.error('MediaRecorder error:', ev.error || ev);
      alert('Error del grabador: ' + (ev.error?.message || ev.message || ev));
    };
    mr.onstop = () => {
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      const typeOut = mr.mimeType || (mimeType || 'audio/webm');
      const blob = new Blob(chunksRef.current, { type: typeOut });
      setRecState(s => ({ ...s, recording:false, blob }));
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    };

    mediaRef.current = mr;
    mr.start(250); // timeslice para obtener chunks regulares
    setRecState({ recording:true, seconds:0, blob:null });
    recTimerRef.current = setInterval(
      () => setRecState(s => ({ ...s, seconds: s.seconds + 1 })), 1000
    );
  } catch (e) {
    console.error('No se pudo iniciar la grabación:', e);
    let errorMsg = 'No se pudo iniciar la grabación.';
    if (e?.name === 'NotAllowedError') {
      errorMsg = '❌ Permiso denegado.\n\nDa permiso al micrófono en tu navegador.';
    } else if (e?.name === 'NotFoundError') {
      errorMsg = '❌ No se encontró micrófono.\n\nConecta un micrófono e intenta de nuevo.';
    } else if (e?.message) {
      errorMsg += '\n\n' + e.message;
    }
    alert(errorMsg);
  }
}


  function stopRecording() {
    const mr = mediaRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  }

  async function sendRecorded() {
    if (!recState.blob || !conversation) return;
    try {
      console.log('📤 Enviando audio:', { blobSize: recState.blob.size, blobType: recState.blob.type });

      const fd = new FormData();
      const ext = (recState.blob.type || '').includes('ogg') ? 'ogg' : 'webm';
      const fileName = `audio-${Date.now()}.${ext}`;
      fd.append('file', new File([recState.blob], fileName, { type: recState.blob.type || 'audio/webm' }));
      fd.append('conversacion_id', conversation.id);
      fd.append('to', conversation.wa_user);

      console.log('📨 Enviando audio directamente a /api/send...');
      const tempId = `temp-a-${Date.now()}`;
      setItems(prev => ([...prev, { id: tempId, sender:'me', tipo:'audio', cuerpo: '[Audio]', created_at: new Date().toISOString(), status:'sending' }]));
      requestAnimationFrame(() => scrollToBottom());

      const res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), {
        method: 'POST',
        body: fd
      });

      const j = await res.json();
      console.log('✅ Respuesta send:', j);

      if (res.status === 409 && j?.requires_template) {
        alert('Esta conversación está fuera de la ventana de 24h. Usa una plantilla aprobada.');
        setItems(prev => prev.filter(m => m.id !== tempId));
        return;
      }

      if (!res.ok || !j.ok) {
        const errorMsg = j?.error?.message || j?.error?.title || 'No se pudo enviar el audio';
        console.error('❌ Error en send:', j.error);
        alert(errorMsg);
        setItems(prev => prev.map(m => m.id === tempId ? { ...m, status:'failed' } : m));
        return;
      }

      setItems(prev => prev.map(m => m.id === tempId ? { ...m, status:'sent' } : m));
    } catch (e) {
      console.error('❌ Error crítico enviando audio:', e);
      alert(`Error enviando audio:\n\n${e.message || e}`);
    } finally {
      setRecState({ recording:false, seconds:0, blob:null });
      setTimeout(scrollToBottom, 0);
    }
  }

  // scroll
  const endRef = useRef(null);
  const scrollerRef = useRef(null);
  const scrollToBottom = () => {
    const sc = scrollerRef.current;
    if (sc) {
      // Scroll instantáneo al final
      sc.scrollTop = sc.scrollHeight;
    } else if (endRef.current) {
      // Fallback: usar scrollIntoView
      endRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  };

  // pedir permiso notificaciones
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Cargar eventos del sistema
  async function loadSystemEvents() {
    if (!conversation) return;
    try {
      const r = await fetch(`${BASE}/api/conversation-events?conversacion_id=${conversation.id}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) {
        setSystemEvents(j.items || []);
      }
    } catch (e) {
      console.error('Error loading system events:', e);
    }
  }

  async function load() {
    if (!conversation) return;

    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      console.log(`[ChatPane] ⚠️ Cancelando carga anterior`);
      abortControllerRef.current.abort();
    }

    const loadStartTime = performance.now();
    console.log(`[ChatPane] 🔄 Iniciando carga para conversación ${conversation.id}`);

    // Crear nuevo AbortController para este request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    isInitialLoad.current = true; // Marcar como carga inicial
    setSseEnabled(false); // Deshabilitar SSE durante carga

    try {
      // 1. Cargar mensajes
      const messagesStartTime = performance.now();
      const limit = 50; // Cargar solo 50 mensajes inicialmente
      const qs = new URLSearchParams({ conversation_id: String(conversation.id), limit: String(limit) });
      if (searchQ.trim()) qs.set('q', searchQ.trim());

      const r = await fetch(`${BASE}/api/messages?${qs.toString()}`.replace(/\/\//g, '/'), {
        signal: abortController.signal
      });
      const j = await r.json();
      const messagesTime = performance.now() - messagesStartTime;

      if (j.ok) {
        const messages = j.items || [];
        console.log(`[ChatPane] 📨 Mensajes cargados: ${messages.length} en ${messagesTime.toFixed(0)}ms`);
        setItems(messages);
        setTotalMessages(j.total || messages.length);
        setHasMore(messages.length === limit);
        
        // Cargar eventos del sistema DESPUÉS (no crítico para UI inicial)
        setTimeout(() => loadSystemEvents(), 50);
      }

      const totalTime = performance.now() - loadStartTime;
      console.log(`[ChatPane] ✅ Carga de mensajes completada en ${totalTime.toFixed(0)}ms`);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[ChatPane] ⏹️ Carga cancelada (nueva carga en proceso)`);
        return; // No hacer nada si fue cancelado
      }
      console.error('[ChatPane] ❌ Error en carga:', err);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;

      // Solo hacer scroll múltiple en la carga inicial
      if (isInitialLoad.current) {
        setTimeout(scrollToBottom, 0);
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
        setTimeout(() => {
          isInitialLoad.current = false;
          console.log('[ChatPane] 🎯 Scroll inicial completado');
          // Habilitar SSE DESPUÉS de la carga inicial
          setSseEnabled(true);
          console.log('[ChatPane] 🔌 SSE habilitado');
        }, 500);
      }
    }
  }

  async function loadMore() {
    if (!conversation || loadingMore || !hasMore) return;
    setLoadingMore(true);

    // Guardar la altura del scroll antes de cargar más mensajes
    const sc = scrollerRef.current;
    const scrollHeightBefore = sc?.scrollHeight || 0;

    try {
      const limit = 50;
      const offset = items.length;
      const qs = new URLSearchParams({
        conversation_id: String(conversation.id),
        limit: String(limit),
        offset: String(offset)
      });
      if (searchQ.trim()) qs.set('q', searchQ.trim());
      const r = await fetch(`${BASE}/api/messages?${qs.toString()}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) {
        const newMessages = j.items || [];
        setItems(prev => [...newMessages, ...prev]); // Agregar al inicio (mensajes más antiguos)
        setHasMore(newMessages.length === limit);

        // Restaurar posición de scroll después de agregar mensajes
        setTimeout(() => {
          if (sc) {
            const scrollHeightAfter = sc.scrollHeight;
            const scrollDiff = scrollHeightAfter - scrollHeightBefore;
            sc.scrollTop = scrollDiff;
          }
        }, 0);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // refresco silencioso para que el chat se actualice sin parpadeos
  async function refreshMessages() {
    if (!conversation) return;
    try {
      // Mantener la cantidad actual de mensajes cargados (mínimo 50)
      const currentCount = Math.max(items.length, 50);
      const qs = new URLSearchParams({ conversation_id: String(conversation.id), limit: String(currentCount) });
      if (searchQ.trim()) qs.set('q', searchQ.trim());
      const r = await fetch(`${BASE}/api/messages?${qs.toString()}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) {
        const newItems = j.items || [];
        console.log(`[ChatPane] Refresh: ${newItems.length} mensajes (antes: ${items.length})`);
        setItems(newItems);
      }
    } catch {
      // ignorar errores puntuales
    }
  }

  // Recalcular si la conversaci��n est�� dentro de la ventana de 24h
  useEffect(() => {
    if (!items || items.length === 0) {
      setInsideWindow(true);
      return;
    }
    let lastInbound = 0;
    for (const m of items) {
      if (m.sender === "them") {
        const raw = m.created_at || m.ts || m.timestamp || m.time;
        let t = NaN;
        if (raw) {
          // Si es un timestamp Unix en segundos (10 dígitos), convertir a ms
          if (typeof raw === 'number' && raw < 10000000000) {
            t = raw * 1000;
          } else if (typeof raw === 'number') {
            t = raw; // Ya está en ms
          } else {
            t = new Date(raw).getTime(); // String de fecha
          }
        }
        if (!Number.isNaN(t) && t > lastInbound) lastInbound = t;
      }
    }
    if (!lastInbound) {
      setInsideWindow(true);
      setTimeRemaining(null);
      setLastInboundTime(null);
    } else {
      const diffMs = Date.now() - lastInbound;
      const windowMs = 24 * 3600 * 1000; // 24 horas en ms
      const remaining = windowMs - diffMs;
      setInsideWindow(diffMs <= windowMs);
      setTimeRemaining(remaining > 0 ? remaining : 0);
      setLastInboundTime(lastInbound);
    }
  }, [items]);

  // Actualizar el contador cada minuto
  useEffect(() => {
    if (!lastInboundTime) return;

    const interval = setInterval(() => {
      const diffMs = Date.now() - lastInboundTime;
      const windowMs = 24 * 3600 * 1000;
      const remaining = windowMs - diffMs;
      setInsideWindow(diffMs <= windowMs);
      setTimeRemaining(remaining > 0 ? remaining : 0);
    }, 60000); // actualizar cada minuto

    return () => clearInterval(interval);
  }, [lastInboundTime]);

  // Formatear tiempo restante de forma legible
  function formatTimeRemaining(ms) {
    if (!ms || ms <= 0) return "0h 0m";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  async function runSearch() {
    if (!searchQ.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    try {
      // Hacer búsqueda en el servidor para obtener TODOS los mensajes que coinciden
      const qs = new URLSearchParams({
        conversation_id: String(conversation.id),
        q: searchQ.trim(),
        limit: '500' // Límite alto para obtener todos los resultados
      });
      const res = await fetch(`${BASE}/api/messages?${qs}`.replace(/\/\//g, '/'));
      const json = await res.json();

      if (json.ok && json.items) {
        // Combinar con los mensajes actuales y eliminar duplicados
        const allMessages = [...items];
        json.items.forEach(newMsg => {
          if (!allMessages.find(m => m.id === newMsg.id)) {
            allMessages.push(newMsg);
          }
        });

        // Actualizar los items con todos los mensajes encontrados
        setItems(allMessages.sort((a, b) => {
          const timeA = a.ts || new Date(a.created_at || a.creado_en).getTime() / 1000;
          const timeB = b.ts || new Date(b.created_at || b.creado_en).getTime() / 1000;
          return timeA - timeB;
        }));

        // Obtener IDs de los mensajes que coinciden
        const results = json.items.map(m => m.id);
        setSearchResults(results);

        if (results.length > 0) {
          setCurrentSearchIndex(0);
          scrollToMessage(results[0]);
        } else {
          setCurrentSearchIndex(-1);
        }
      }
    } catch (err) {
      console.error('Error searching messages:', err);
      alert('Error al buscar mensajes');
    }
  }

  function scrollToMessage(messageId) {
    // Add small delay to ensure DOM is ready
    setTimeout(() => {
      const element = document.getElementById(`msg-${messageId}`);
      if (element && scrollerRef.current) {
        // Calcular la posición del elemento relativo al contenedor
        const container = scrollerRef.current;
        const elementTop = element.offsetTop;
        const containerHeight = container.clientHeight;
        const elementHeight = element.clientHeight;

        // Centrar el elemento en el contenedor
        const scrollPosition = elementTop - (containerHeight / 2) + (elementHeight / 2);

        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  function nextSearchResult() {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToMessage(searchResults[nextIndex]);
  }

  function prevSearchResult() {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    scrollToMessage(searchResults[prevIndex]);
  }

  function clearSearch() {
    setSearchQ('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  }
  async function openAttachments() {
    if (!conversation) return;
    try {
      const r = await fetch(`${BASE}/api/conversation-attachments?conversation_id=${conversation.id}&limit=200`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setAttach({ open:true, items: j.items || [] });
    } catch {}
  }
  function closeAttachments() { setAttach({ open:false, items:[] }); }

  // Reaccionar a un mensaje (texto, media o sticker)
  async function reactToMessage(msg, emoji) {
    // Cerrar el picker inmediatamente
    setReactionPicker({ show: false, msgId: null });

    // Actualizar UI optimísticamente
    setItems(prev => prev.map(m => m.id === msg.id ? { ...m, agent_reaction_emoji: emoji } : m));

    try {
      const res = await fetch(`${BASE}/api/message-reaction`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje_id: msg.id, emoji }),
      });

      // Intentar parsear respuesta
      let j;
      try {
        j = await res.json();
      } catch (parseError) {
        console.error('Error parseando respuesta de reacción:', parseError);
        // Si el status es exitoso pero no pudimos parsear, asumir que funcionó
        if (res.ok) return;
        throw new Error('Respuesta inválida del servidor');
      }

      if (!res.ok || !j.ok) {
        console.error('Error en reacción:', j);
        // Revertir cambio optimista si falló
        setItems(prev => prev.map(m => m.id === msg.id ? { ...m, agent_reaction_emoji: null } : m));
        alert(j.error || 'No se pudo enviar la reacción');
      }
    } catch (err) {
      console.error('Error al enviar reacción:', err);
      // Revertir cambio optimista si falló
      setItems(prev => prev.map(m => m.id === msg.id ? { ...m, agent_reaction_emoji: null } : m));
      alert('Error de red al enviar la reacción');
    }
  }


  // Insertar respuesta rápida en el texto
  function handleQuickReplySelect(content) {
    setText(prev => prev + content);
    setShowQuickReplies(false);
  }

  // Cambiar estado de conversación (con o sin campos personalizados)
  async function handleStatusChange(newStatusId, fieldData = null) {
    try {
      const r = await fetch(`${BASE}/api/conversation-status`.replace(/\/\//g, '/'), {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          status_id: newStatusId,
          reason: 'Cambiado desde ChatPane',
          field_data: fieldData ? JSON.stringify(fieldData) : null
        })
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || 'No se pudo actualizar');
      } else {
        const newStatus = statuses.find(s => s.id === newStatusId);
        if (newStatus) {
          conversation.status_id = newStatusId;
          conversation.status_name = newStatus.name;
          conversation.status_color = newStatus.color;
          conversation.status_icon = newStatus.icon;
        }
        // Recargar eventos del sistema para mostrar el cambio
        await loadSystemEvents();
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Error de red al cambiar el estado');
    }
  }

  // Completar ciclo manualmente
  async function handleCompleteCycle() {
    if (!conversation) return;

    const confirmed = confirm(
      `¿Completar el ciclo actual de la conversación?\n\n` +
      `Esto guardará el ciclo #${(conversation.cycle_count || 0) + 1} y reiniciará la conversación al estado inicial.`
    );

    if (!confirmed) return;

    try {
      const r = await fetch(`${BASE}/api/complete-cycle`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversation.id,
          reason: 'Completado manualmente por el agente'
        })
      });

      const j = await r.json();

      if (!j.ok) {
        alert(j.error || 'No se pudo completar el ciclo');
      } else {
        alert(`✅ ${j.message}\n\nLa conversación ha sido reseteada a "${j.new_status.name}"`);

        // Actualizar el estado de la conversación en memoria
        if (j.new_status) {
          conversation.status_id = j.new_status.id;
          conversation.status_name = j.new_status.name;
          conversation.status_icon = j.new_status.icon;
          conversation.cycle_count = j.cycle_number;
        }

        // Recargar eventos del sistema para mostrar el nuevo evento de ciclo completado
        await loadSystemEvents();
      }
    } catch (err) {
      console.error('Error completing cycle:', err);
      alert('Error de red al completar el ciclo');
    }
  }

  // Asignar conversación a un agente
  async function handleAssignAgent(userId) {
    try {
      const r = await fetch(`${BASE}/api/admin/assign`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          conversacion_id: conversation.id,
          user_id: userId || null
        })
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || 'No se pudo asignar');
      } else {
        const assignedUser = users.find(u => u.id === userId);
        conversation.asignado_a = userId;
        conversation.assigned_to_name = assignedUser?.nombre || null;
        // Recargar eventos del sistema para mostrar la asignación
        await loadSystemEvents();
      }
    } catch (err) {
      console.error('Error assigning conversation:', err);
      alert('Error de red al asignar');
    }
  }

  // Cargar comentarios internos
  async function loadComments() {
    if (!conversation) return;
    const startTime = performance.now();
    try {
      const r = await fetch(`${BASE}/api/comentarios?conversacion_id=${conversation.id}`.replace(/\/\//g, '/'), {
        signal: abortControllerRef.current?.signal
      });
      const j = await r.json();
      const fetchTime = performance.now() - startTime;
      if (j.ok) {
        setComments(j.items || []);
        console.log(`[ChatPane] 💬 Comentarios cargados: ${(j.items || []).length} en ${fetchTime.toFixed(0)}ms`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[ChatPane] ⏹️ Carga de comentarios cancelada`);
        return;
      }
      console.error('[ChatPane] ❌ Error cargando comentarios:', err);
    }
  }

  // Crear comentario interno
  async function createComment(e) {
    e?.preventDefault?.();
    if (!conversation || !newComment.trim()) return;
    try {
      const r = await fetch(`${BASE}/api/comentarios`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: conversation.id, comentario: newComment.trim() })
      });
      const j = await r.json();
      if (j.ok) {
        setNewComment("");
        loadComments();
      } else {
        alert(j.error || 'No se pudo crear el comentario');
      }
    } catch {
      alert('Error de red');
    }
  }

  useEffect(() => {
    if (!conversation?.id) return;

    console.log(`[ChatPane] 🚀 useEffect disparado para conversación ${conversation.id}`);
    const effectStartTime = performance.now();

    // Cargar solo mensajes primero (crítico)
    load().then(() => {
      const effectTime = performance.now() - effectStartTime;
      console.log(`[ChatPane] ⚡ Mensajes cargados en ${effectTime.toFixed(0)}ms`);
      
      // Cargar comentarios DESPUÉS (no crítico)
      setTimeout(() => loadComments(), 100);
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('[ChatPane] Error en useEffect:', err);
      }
    });

    return () => {
      // Cancelar cualquier request en progreso al desmontar o cambiar conversación
      if (abortControllerRef.current) {
        console.log(`[ChatPane] 🧹 Limpiando: cancelando requests en progreso`);
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Deshabilitar SSE al desmontar
      setSseEnabled(false);
    };
    /* eslint-disable-next-line */
  }, [conversation?.id]);

  // Autoscroll cuando cambian los mensajes, eventos o comentarios (solo si el usuario está en el fondo o es carga inicial)
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;

    // En la carga inicial, siempre hacer scroll al fondo
    if (isInitialLoad.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
      return;
    }

    // Para actualizaciones, solo hacer scroll automático si el usuario ya estaba cerca del fondo
    const wasNearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 150;

    if (wasNearBottom) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [items.length, systemEvents.length, comments.length]);

  // SSE: Recibir mensajes en tiempo real
  const handleRealtimeMessages = useCallback((newMessages) => {
    if (!Array.isArray(newMessages)) return;

    // Verificar si el usuario está en el fondo del scroll antes de actualizar
    const sc = scrollerRef.current;
    const wasAtBottom = !sc || (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 100);

    setItems((prev) => {
      const existingWaIds = new Set(prev.map(m => m.wa_msg_id).filter(Boolean));
      const existingDbIds = new Set(prev.map(m => m.id).filter(id => !String(id).startsWith('tmp_')));

      const toAdd = newMessages
        .filter(m => !existingWaIds.has(m.wa_msg_id) && !existingDbIds.has(m.id))
        .map(m => ({
          id: m.id,
          conversation_id: m.conversacion_id,
          text: m.cuerpo,
          created_at: new Date(m.ts * 1000).toISOString(),
          sender: m.from_me ? 'me' : 'them',
          tipo: m.tipo,
          status: m.status,
          media_id: m.media_id,
          mime_type: m.mime_type,
          wa_msg_id: m.wa_msg_id,
          usuario_id: m.usuario_id,
          usuario_nombre: m.usuario_nombre,
          is_auto_reply: !!m.is_auto_reply,
        }));

      if (toAdd.length === 0) return prev;

      // Solo hacer scroll si estaba en el fondo
      if (wasAtBottom) {
        requestAnimationFrame(() => scrollToBottom());
      }

      // Reemplazar mensajes temporales con los reales
      const updated = prev.map(m => {
        if (String(m.id).startsWith('tmp_')) {
          // Buscar si alguno de los nuevos mensajes corresponde a este temporal
          const match = toAdd.find(newMsg =>
            newMsg.sender === 'me' &&
            (newMsg.text || '').trim() === (m.text || '').trim() &&
            Math.abs(new Date(newMsg.created_at).getTime() - new Date(m.created_at).getTime()) < 15000
          );
          if (match) {
            return { ...match }; // Reemplazar temporal con real
          }
        }
        return m;
      });

      // Agregar solo los que no reemplazaron temporales
      const replacedIds = new Set(updated.filter(m => !String(m.id).startsWith('tmp_')).map(m => m.id));
      const finalToAdd = toAdd.filter(m => !replacedIds.has(m.id));

      return [...updated, ...finalToAdd];
    });
  }, []);

  // SSE: Actualizar estados de mensajes
  const handleRealtimeStatus = useCallback((statuses) => {
    if (!Array.isArray(statuses)) return;
    setItems((prev) =>
      prev.map(m => {
        const update = statuses.find(s => s.id === m.id);
        return update ? { ...m, status: update.status } : m;
      })
    );
  }, []);

  // SSE: Recibir comentarios internos en tiempo real
  const handleRealtimeComments = useCallback((newComments) => {
    if (!Array.isArray(newComments)) return;
    setComments((prev) => {
      const existingIds = new Set(prev.map(c => c.id));
      const toAdd = newComments.filter(c => !existingIds.has(c.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, []);

  // Manejar eventos de llamadas en tiempo real
  const handleRealtimeCall = useCallback((callData) => {
    if (!callData) return;

    console.log('[Call] Received call event:', callData);

    // Solo mostrar notificación para llamadas entrantes activas
    const activeStatuses = ['initiated', 'ringing', 'in_progress'];
    const endedStatuses = ['completed', 'failed', 'no_answer', 'rejected', 'missed'];

    if (callData.direction === 'inbound' && activeStatuses.includes(callData.status)) {
      console.log('[Call] Showing incoming call notification');
      setIncomingCall(callData);

      // Reproducir sonido si está disponible
      if (ding) {
        ding.play().catch(() => {});
      }

      // Auto-ocultar después de 30 segundos o cuando cambie el estado
      setTimeout(() => {
        setIncomingCall(prev => {
          if (prev?.call_id === callData.call_id) return null;
          return prev;
        });
      }, 30000);
    }

    // Si la llamada termina, ocultar la notificación
    if (endedStatuses.includes(callData.status)) {
      console.log('[Call] Hiding call notification - call ended');
      setIncomingCall(prev => {
        if (prev?.call_id === callData.call_id) return null;
        return prev;
      });
    }
  }, []);

  // Conectar SSE para esta conversación (solo después de carga inicial)
  useRealtimeChat({
    conversationId: conversation?.id,
    onMessage: handleRealtimeMessages,
    onStatus: handleRealtimeStatus,
    onComments: handleRealtimeComments,
    onCall: handleRealtimeCall,
    enabled: !!conversation && sseEnabled, // Solo habilitar después de carga inicial
  });

  // Fallback: Polling cada 30s como respaldo si SSE falla
  useEffect(() => {
    if (!conversation) return;
    const id = setInterval(() => {
      refreshMessages();
    }, 30000); // cada 30 segundos (SSE maneja las actualizaciones en tiempo real)
    return () => clearInterval(id);
  }, [conversation?.id, searchQ]);

  // Resetear contador cuando cambia la conversación
  useEffect(() => {
    const incoming = items.filter(m => m.sender === "them");
    prevIncomingCountRef.current = incoming.length;
    initialLoadDone.current = false; // Marcar que es carga inicial de esta conversación
    isInitialLoad.current = true; // Reset flag de carga inicial
  }, [conversation?.id]);

  // notificaciones + sonido al recibir entrantes nuevos
  useEffect(() => {
    const incoming = items.filter(m => m.sender === "them");
    const prev = prevIncomingCountRef.current;

    // Marcar que la carga inicial ya terminó después del primer render con mensajes
    if (!initialLoadDone.current && items.length > 0) {
      initialLoadDone.current = true;
      prevIncomingCountRef.current = incoming.length;
      return; // No notificar en la carga inicial
    }

    // Solo notificar si ya pasó la carga inicial Y hay MÁS mensajes que antes
    if (initialLoadDone.current && prev > 0 && incoming.length > prev) {
      // sonido
      try {
        if (ding) {
          ding.currentTime = 0;
          ding.play().catch(() => {});
        }
      } catch {}

      // notificación
      if ("Notification" in window && Notification.permission === "granted") {
        const last = incoming[incoming.length - 1];
        const title = conversation?.title || conversation?.wa_user || "Nuevo mensaje";
        const body = (last?.text && String(last.text).slice(0, 80)) || `[${last?.tipo || "mensaje"}]`;
        try { new Notification(title, { body }); } catch {}
      }
    }

    prevIncomingCountRef.current = incoming.length;
  }, [items.length, conversation]);

  // enviar texto/archivo
  async function send(e) {
    e?.preventDefault?.();
    if (!conversation) return;
    if (!text && !file) return;

    const to = conversation.wa_user;
    const conversacion_id = conversation.id;

    // optimista
    const tempId = "tmp_" + Math.random().toString(36).slice(2);
    const optimistic = {
      id: tempId,
      conversation_id: conversacion_id,
      text: text || (file ? "[archivo]" : ""),
      created_at: new Date().toISOString(),
      sender: "me",
      tipo: file ? "document" : "text",
      status: "sending",
    };
    setItems((prev) => [...prev, optimistic]);
    // Scroll inmediato al enviar
    requestAnimationFrame(() => scrollToBottom());

    try {
      let res, j;
      if (file) {
        const fd = new FormData();
        fd.append("conversacion_id", conversacion_id);
        fd.append("to", to);
        if (text) fd.append("text", text);
        fd.append("file", file);
        res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), { method: "POST", body: fd });
      } else {
        res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversacion_id, to, text }),
        });
      }
      j = await res.json();

      if (res.ok && j.ok) {
        setItems((prev) =>
          prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m)
        );
      } else {
        setItems((prev) =>
          prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m)
        );
        if (res.status === 409 && j.requires_template) {
          alert(j.error?.message || "Esta conversaci\u00f3n est\u00e1 fuera de la ventana de 24h, env\u00eda una plantilla desde el bot\u00f3n de plantillas.");
        } else {
          alert(j.error?.message || "No se pudo enviar");
        }
      }
    } catch {
      setItems((prev) =>
        prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m)
      );
      alert("Error de red");
    } finally {
      setText("");
      setFile(null);
      setTimeout(scrollToBottom, 0);
    }
  }

  // reintento
  async function retryMessage(failedMsg) {
    try {
      const to = conversation.wa_user;
      const conversacion_id = conversation.id;

      setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "sending" } : m));

      const res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ conversacion_id, to, text: failedMsg.text || "" })
      });
      const j = await res.json();

      if (res.ok && j.ok) {
        setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "sent" } : m));
      } else {
        setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "failed" } : m));
        if (res.status === 409 && j.requires_template) {
          alert(j.error?.message || "Esta conversaci\u00f3n est\u00e1 fuera de la ventana de 24h, env\u00eda una plantilla desde el bot\u00f3n de plantillas.");
        } else {
          alert(j.error?.message || "No se pudo reenviar");
        }
      }
    } catch {
      setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "failed" } : m));
      alert("Error de red");
    }
  }

  // Enviar ubicación (recibe coordenadas del LocationPicker)
  async function sendLocation(latitude, longitude) {
    if (!conversation) return;

    try {
      const locationText = `[Ubicación ${latitude},${longitude}]`;

      // Enviar como mensaje de texto
      const to = conversation.wa_user;
      const conversacion_id = conversation.id;

      // Mensaje optimista
      const tempId = "tmp_" + Math.random().toString(36).slice(2);
      const optimistic = {
        id: tempId,
        conversation_id: conversacion_id,
        text: locationText,
        created_at: new Date().toISOString(),
        sender: "me",
        tipo: "text",
        status: "sending",
      };
      setItems((prev) => [...prev, optimistic]);
      requestAnimationFrame(() => scrollToBottom());

      // Enviar al backend
      const res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacion_id, to, text: locationText }),
      });
      const j = await res.json();

      if (res.ok && j.ok) {
        setItems((prev) =>
          prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m)
        );
      } else {
        setItems((prev) =>
          prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m)
        );
        alert(j.error?.message || "No se pudo enviar la ubicación");
      }
    } catch (error) {
      alert("Error al enviar la ubicación: " + error.message);
    }
  }

  // Detectar cuando el texto cambia para mostrar sugerencias de atajos
  useEffect(() => {
    if (text.startsWith("/") && text.length > 1) {
      const matches = shortcuts.filter(s => s.atajo && s.atajo.startsWith(text.trim()));
      setShortcutSuggestions(matches);
      setSelectedSuggestion(0);
    } else {
      setShortcutSuggestions([]);
    }
  }, [text, shortcuts]);

  // Seleccionar una sugerencia de atajo
  function selectShortcut(shortcut) {
    setText(shortcut.contenido);
    setShortcutSuggestions([]);
  }

  // Enter para enviar (Shift+Enter = salto), Tab/flechas para navegar atajos
  function onKeyDown(e) {
    // Si hay sugerencias de atajos visibles
    if (shortcutSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev + 1) % shortcutSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev - 1 + shortcutSuggestions.length) % shortcutSuggestions.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectShortcut(shortcutSuggestions[selectedSuggestion]);
        return;
      }
      if (e.key === "Escape") {
        setShortcutSuggestions([]);
        return;
      }
    }

    // Enter normal para enviar
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Marcar como favorita / archivar
  async function toggleFavorite() {
    if (!conversation) return;
    const action = conversation.is_favorite ? 'unfavorite' : 'favorite';
    try {
      const r = await fetch(`${BASE}/api/conversation-user-status`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: conversation.id, action })
      });
      const j = await r.json();
      if (j.ok) {
        conversation.is_favorite = !conversation.is_favorite;
        setItems(prev => [...prev]); // Forzar re-render
      } else {
        alert(j.error || 'No se pudo actualizar');
      }
    } catch (err) {
      alert('Error al marcar como favorito');
    }
  }

  async function toggleArchive() {
    if (!conversation) return;
    const action = conversation.is_archived ? 'unarchive' : 'archive';
    try {
      const r = await fetch(`${BASE}/api/conversation-user-status`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: conversation.id, action })
      });
      const j = await r.json();
      if (j.ok) {
        conversation.is_archived = !conversation.is_archived;
        setItems(prev => [...prev]); // Forzar re-render
      } else {
        alert(j.error || 'No se pudo actualizar');
      }
    } catch (err) {
      alert('Error al archivar');
    }
  }

  // Funciones de llamadas
  async function loadCallHistory() {
    if (!conversation) return;
    try {
      const r = await fetch(
        `${BASE}/api/calls/history?conversation_id=${conversation.id}`.replace(/\/\//g, '/')
      );
      const j = await r.json();
      if (j.ok) {
        setCallHistory(j.calls || []);
        setShowCallHistory(true);
      } else {
        alert(j.error || 'Error cargando historial');
      }
    } catch (err) {
      console.error('Error loading call history:', err);
    }
  }

  if (!conversation) {
    return (
      <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl h-[calc(100vh-14rem)] flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">Selecciona una conversación</p>
      </div>
    );
  }

  return (
    <div className="relative bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl h-full flex flex-col">
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-400/70 border-t-transparent animate-spin" />
          <p className="mt-3 text-sm text-slate-900 dark:text-slate-200 font-medium">Cargando conversacion...</p>
        </div>
      )}
      <div className="flex-shrink-0 h-12 px-4 flex items-center gap-3 border-b border-slate-800">
        <div className="font-medium truncate">{conversation.title || `Chat ${conversation.id}`}</div>
        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">{conversation.wa_user}</div>

        {/* Indicador de ventana de 24h */}
        {insideWindow && timeRemaining ? (
          <div
            className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
              timeRemaining <= 2 * 60 * 60 * 1000
                ? 'bg-amber-900/30 border-amber-600/50 text-amber-300'
                : 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300'
            }`}
            title={`Tiempo restante para enviar mensajes libres: ${formatTimeRemaining(timeRemaining)}`}
          >
            <span>{timeRemaining <= 2 * 60 * 60 * 1000 ? '⏰' : '✓'}</span>
            <span>{formatTimeRemaining(timeRemaining)}</span>
          </div>
        ) : !insideWindow ? (
          <div
            className="text-[10px] px-2 py-0.5 rounded-full border bg-red-900/30 border-red-600/50 text-red-300 flex items-center gap-1"
            title="Fuera de la ventana de 24h - Solo plantillas"
          >
            <span>🔒</span>
            <span>Fuera de ventana</span>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {/* Botón favorito */}
          <button
            type="button"
            onClick={toggleFavorite}
            title={conversation.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            className={`h-8 px-2 rounded text-xs transition ${
              conversation.is_favorite
                ? 'bg-yellow-600/20 border border-yellow-600/60 text-yellow-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            }`}
          >
            {conversation.is_favorite ? '⭐' : '☆'}
          </button>
          {/* Botón archivar */}
          <button
            type="button"
            onClick={toggleArchive}
            title={conversation.is_archived ? "Desarchivar" : "Archivar"}
            className={`h-8 px-2 rounded text-xs ${
              conversation.is_archived
                ? 'bg-slate-700/60 text-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            }`}
          >
            📦
          </button>
          {/* Botón historial de llamadas */}
          <button
            type="button"
            onClick={loadCallHistory}
            title="Ver historial de llamadas"
            className="h-8 px-2 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-400"
          >
            📞
          </button>
          {/* Botón trazabilidad */}
          <button
            type="button"
            onClick={() => setShowTraceView(true)}
            title="Ver trazabilidad completa (Ticket)"
            className="h-8 px-2 rounded text-xs bg-gradient-to-r from-purple-900/40 to-blue-900/40 hover:from-purple-800/60 hover:to-blue-800/60 border border-purple-700/50 text-purple-200 transition font-medium"
          >
            🎫 Trazabilidad
          </button>
          {/* Botón completar ciclo */}
          <button
            type="button"
            onClick={handleCompleteCycle}
            title="Completar ciclo actual y reiniciar conversación"
            className="h-8 px-2 rounded text-xs bg-gradient-to-r from-green-900/40 to-emerald-900/40 hover:from-green-800/60 hover:to-emerald-800/60 border border-green-700/50 text-green-200 transition font-medium"
          >
            ✅ Completar Ciclo
          </button>
          {conversation.status_name && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border text-white"
              style={{
                backgroundColor: conversation.status_color + '40',
                borderColor: conversation.status_color
              }}
            >
              {conversation.status_icon} {conversation.status_name}
            </span>
          )}
          <select
            value={conversation.status_id || ''}
            onChange={(e)=>{
              const newStatusId = Number(e.target.value);
              const newStatus = statuses.find(s => s.id === newStatusId);

              // Si el estado tiene campos requeridos, mostrar modal
              if (newStatus?.required_fields) {
                try {
                  // required_fields puede venir como array (MySQL lo parsea) o como string
                  const fields = Array.isArray(newStatus.required_fields)
                    ? newStatus.required_fields
                    : JSON.parse(newStatus.required_fields);

                  if (Array.isArray(fields) && fields.length > 0) {
                    setStatusChangeModal({ show: true, newStatusId, status: newStatus });
                    // Resetear el select al valor actual
                    e.target.value = conversation.status_id || '';
                    return;
                  }
                } catch (err) {
                  console.error('Error validando required_fields:', err);
                }
              }

              // Si no tiene campos requeridos, cambiar directamente
              handleStatusChange(newStatusId, null);
            }}
            className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1"
          >
            {statuses.map(s => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
          {/* Selector de agente asignado */}
          <select
            value={conversation.asignado_a || ''}
            onChange={(e) => handleAssignAgent(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1"
            title="Asignar a agente"
          >
            <option value="">Sin asignar</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                👤 {u.nombre}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              value={searchQ}
              onChange={(e)=>setSearchQ(e.target.value)}
              onKeyDown={(e)=>{
                if (e.key==='Enter') runSearch();
                if (e.key==='Escape') clearSearch();
              }}
              placeholder="Buscar en chat..."
              className="h-8 px-2 rounded bg-slate-900 border border-slate-700 text-xs outline-none focus:border-emerald-400"
              style={{width:'160px'}}
            />
            {searchResults.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 px-2">
                  {currentSearchIndex + 1} de {searchResults.length}
                </span>
                <button
                  type="button"
                  onClick={prevSearchResult}
                  title="Anterior (↑)"
                  className="h-8 w-8 rounded bg-slate-800 hover:bg-slate-700 text-xs"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={nextSearchResult}
                  title="Siguiente (↓)"
                  className="h-8 w-8 rounded bg-slate-800 hover:bg-slate-700 text-xs"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={clearSearch}
                  title="Cerrar búsqueda (Esc)"
                  className="h-8 w-8 rounded bg-slate-800 hover:bg-slate-700 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            {searchResults.length === 0 && searchQ && (
              <button type="button" onClick={runSearch} title="Buscar" className="h-8 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs">🔎</button>
            )}
          </div>
          <button type="button" onClick={openAttachments} title="Ver adjuntos" className="h-8 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs">📎</button>
          <button type="button" onClick={() => setShowTemplates(true)} title="Enviar plantilla" className="h-8 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs">📋</button>
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto thin-scroll p-4 space-y-2 chat-bg-light dark:chat-bg-dark">
        {loading && <div className="text-sm text-slate-600 dark:text-slate-400">Cargando…</div>}

        {/* Botón para cargar más mensajes antiguos */}
        {!loading && hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Cargando...
                </>
              ) : (
                <>↑ Cargar mensajes anteriores ({items.length}/{totalMessages})</>
              )}
            </button>
          </div>
        )}

        {/* Mezclar mensajes con eventos del sistema y comentarios ordenados por fecha */}
        {[
          ...items.map(m => ({ ...m, _type: 'message' })),
          ...systemEvents.map(e => ({ ...e, _type: 'event' })),
          ...comments.map(c => ({ ...c, _type: 'comment' }))
        ]
          .sort((a, b) => {
            // Usar timestamp Unix (segundos) para ordenamiento consistente
            // Mensajes tienen 'ts', eventos ahora también tienen 'ts', comentarios usan 'creado_en'
            const timeA = a.ts || new Date(a.created_at || a.creado_en).getTime() / 1000;
            const timeB = b.ts || new Date(b.created_at || b.creado_en).getTime() / 1000;
            return timeA - timeB;
          })
          .map((item) => {
            if (item._type === 'event') {
              return <SystemEvent key={`event-${item.id}`} evento={item} />;
            }

            if (item._type === 'comment') {
              return <InlineComment key={`comment-${item.id}`} comentario={item} />;
            }

            const m = item;
            const isHighlighted = searchResults.length > 0 && searchResults[currentSearchIndex] === m.id;
            return (
          <div
               key={m.id}
               id={`msg-${m.id}`}
               className={`max-w-[75%] px-3 py-2 rounded-lg border transition-all
                 ${m.sender === 'me'
                   ? 'ml-auto bg-emerald-100 dark:bg-emerald-600/20 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-50'
                   : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'}
                 ${isHighlighted ? 'ring-2 ring-yellow-400 bg-yellow-900/20' : ''}`}>
            {/* Renderizar ubicaciones */}
            {(m.tipo === "location" || 
              (m.tipo === "text" && m.text && (
                /\[Ubicación\s+([-\d.]+),\s*([-\d.]+)\]/i.test(m.text) || 
                /ubicación:\s*([-\d.]+),\s*([-\d.]+)/i.test(m.text)
              ))
            ) && (
              <LocationMessage text={m.text || m.cuerpo || ''} />
            )}
            
            {/* Renderizar texto normal */}
            {m.tipo === "text" && m.text && 
             !/\[Ubicación\s+([-\d.]+),\s*([-\d.]+)\]/i.test(m.text) && 
             !/ubicación:\s*([-\d.]+),\s*([-\d.]+)/i.test(m.text) && (
              <div className="text-sm whitespace-pre-wrap">{m.text}</div>
            )}
            
            {/* Renderizar media */}
            {m.tipo !== "text" && m.tipo !== "location" && <MediaBubble m={m} onOpen={openMedia} onImageLoad={scrollToBottom} />}


              <div className="mt-1 flex items-center gap-2 relative">
                <div className="text-[10px] text-slate-600 dark:text-slate-400">
                  {new Date(m.created_at).toLocaleString()}
                </div>
                {m.is_auto_reply && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/60 text-emerald-300">
                    🤖 Bot
                  </span>
                )}
                {m.sender === "me" && m.usuario_nombre && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/30 border border-sky-700/50 text-sky-300">
                  👤 {m.usuario_nombre}
                </span>
              )}
              {m.sender === "me" && <StatusBadge s={m.status} />}

              {/* Mostrar ambas reacciones si existen */}
              <div className="ml-1 flex gap-1">
                {m.agent_reaction_emoji && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/60" title="Reacción del agente">
                    {m.agent_reaction_emoji}
                  </span>
                )}
                {m.client_reaction_emoji && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-700/80" title="Reacción del cliente">
                    {m.client_reaction_emoji}
                  </span>
                )}
              </div>

              {/* Botón para abrir selector de reacciones */}
              <div className="ml-auto relative">
                <button
                  type="button"
                  onClick={() => setReactionPicker({ show: true, msgId: m.id })}
                  className="text-[11px] w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 transition"
                  title="Reaccionar"
                >
                  +
                </button>

                {/* Picker de reacciones (estilo WhatsApp) */}
                {reactionPicker.show && reactionPicker.msgId === m.id && (
                  <>
                    {/* Backdrop para cerrar al hacer click fuera */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setReactionPicker({ show: false, msgId: null })}
                    />
                    {/* Panel de emojis */}
                    <div className="absolute bottom-full right-0 mb-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 flex gap-1 z-50">
                      {['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => reactToMessage(m, emoji)}
                          className="text-2xl w-10 h-10 flex items-center justify-center rounded hover:bg-slate-800 transition transform hover:scale-110"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {m.sender === "me" && m.status === "failed" && (
                <button
                  onClick={() => retryMessage(m)}
                  className="text-xs px-2 py-1 rounded bg-amber-600/20 border border-amber-700 hover:bg-amber-600/30"
                  title="Reintentar envío"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
            );
          })}
        <div ref={endRef} />
      </div>

      {/* Menú de sugerencias de atajos */}
      {shortcutSuggestions.length > 0 && (
        <div className="mx-3 mb-1 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-lg">
          <div className="text-xs text-slate-400 px-3 py-1.5 border-b border-slate-700 bg-slate-800/50">
            Atajos disponibles (↑↓ navegar, Tab/Enter seleccionar, Esc cerrar)
          </div>
          {shortcutSuggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectShortcut(s)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                i === selectedSuggestion ? 'bg-emerald-600/20 border-l-2 border-emerald-400' : 'hover:bg-slate-800'
              }`}
            >
              <code className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">{s.atajo}</code>
              <span className="font-medium text-slate-200">{s.titulo}</span>
              <span className="text-xs text-slate-500 truncate ml-auto max-w-[200px]">{s.contenido}</span>
            </button>
          ))}
        </div>
      )}

      {/* Banner de advertencia cuando quedan menos de 2 horas */}
      {insideWindow && timeRemaining && timeRemaining <= 2 * 60 * 60 * 1000 && timeRemaining > 0 && (
        <div className="px-3 py-2 border-t border-amber-600/30 bg-amber-900/20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-400">⏰</span>
            <span className="text-amber-300">
              Ventana de 24h cerrando pronto: quedan <strong>{formatTimeRemaining(timeRemaining)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Composer o aviso de ventana 24h */}
      {!insideWindow ? (
        <div className="border-t border-slate-800">
          {/* Mensaje explicativo mejorado */}
          <div className="p-4 bg-gradient-to-br from-amber-950/40 to-red-950/30 border-b border-amber-800/30">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-900/50 flex items-center justify-center text-xl">
                🔒
              </div>
              <div className="flex-1">
                <h3 className="text-amber-200 font-semibold mb-1">Fuera de la ventana de 24 horas</h3>
                <p className="text-sm text-amber-300/80 leading-relaxed">
                  Han pasado más de 24 horas desde el último mensaje del cliente.
                  Solo puedes enviar plantillas pre-aprobadas por WhatsApp hasta que el cliente te escriba nuevamente.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg"
              >
                📋 Enviar Plantilla Aprobada
              </button>
            </div>
          </div>
          {/* Campo de texto deshabilitado para mostrar que no se puede escribir */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 opacity-40">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800">📎</div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800">⚡</div>
              <input
                type="text"
                disabled
                placeholder="No puedes enviar mensajes libres fuera de la ventana de 24h"
                className="resize-none flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 cursor-not-allowed"
              />
              <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800">🎤</div>
              <div className="px-4 py-2 rounded bg-slate-700 text-slate-500 cursor-not-allowed">Enviar</div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={send} className="p-3 border-t border-slate-800 flex items-center gap-2">
          <label className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer" title="Adjuntar archivo">
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            📎
          </label>
          <button type="button" onClick={() => setShowQuickReplies(true)} className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800 hover:bg-slate-700" title="Respuestas rápidas">
            ⚡
          </button>
          <button type="button" onClick={() => setShowLocationPicker(true)} className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800 hover:bg-slate-700" title="Enviar ubicación">
            📍
          </button>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={file ? "Mensaje (opcional)..." : "Escribe un mensaje..."}
            rows={1}
            className="resize-none flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 outline-none focus:border-emerald-400"
          />
          <button type="button" onClick={() => recState.recording ? stopRecording() : startRecording()} className={`inline-flex items-center justify-center w-10 h-10 rounded ${recState.recording ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-800 hover:bg-slate-700'} transition`} title={recState.recording ? 'Detener grabación' : 'Grabar audio'}>
            {recState.recording ? '⏹️' : '🎤'}
          </button>
          {recState.recording && (
            <span className="text-xs text-red-400">{String(Math.floor(recState.seconds/60)).padStart(2,'0')}:{String(recState.seconds%60).padStart(2,'0')}</span>
          )}
          {!!recState.blob && !recState.recording && (
            <button type="button" onClick={sendRecorded} className="px-3 py-2 rounded bg-emerald-500 text-black font-semibold hover:bg-emerald-400">Enviar audio</button>
          )}
          {file && <span className="text-xs text-slate-300 truncate max-w-[200px]">{file.name}</span>}
          <button className="px-4 py-2 rounded bg-emerald-500 text-black font-semibold hover:bg-emerald-400">
            Enviar
          </button>
        </form>
      )}

      {/* Sección de comentarios internos */}
      <div className="border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="w-full px-4 py-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition"
        >
          <span className="flex-1 text-left font-medium">
            💬 Comentarios internos ({comments.length})
          </span>
          <span className="text-slate-500">{showComments ? '▼' : '▶'}</span>
        </button>

        {showComments && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            {/* Lista de comentarios */}
            <div className="max-h-48 overflow-y-auto thin-scroll p-3 space-y-2">
              {comments.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  No hay comentarios internos aún
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-sky-300">
                        {c.usuario_nombre || 'Usuario'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.creado_en).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap">
                      {c.comentario}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Formulario para nuevo comentario */}
            <form onSubmit={createComment} className="p-3 border-t border-slate-800 flex gap-2">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escribe un comentario interno..."
                rows={2}
                className="resize-none flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded bg-sky-600 text-white font-semibold hover:bg-sky-500 self-end"
              >
                Agregar
              </button>
            </form>
          </div>
        )}
      </div>

      <MediaModal open={modal.open} kind={modal.kind} src={modal.src} onClose={closeMedia} />

      {/* Modal Respuestas Rápidas */}
      {showQuickReplies && (
        <QuickReplies
          onSelect={handleQuickReplySelect}
          onClose={() => {
            setShowQuickReplies(false);
            // Recargar atajos por si crearon uno nuevo (usar caché del contexto)
            reloadQuickReplies();
          }}
        />
      )}

      {/* Modal Plantillas */}
      {/* Modal de historial de llamadas */}
      {showCallHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCallHistory(false)}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[70vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <h3 className="font-semibold text-lg">📞 Historial de Llamadas</h3>
              <button className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm" onClick={() => setShowCallHistory(false)}>✕</button>
            </div>
            {callHistory.length === 0 ? (
              <div className="text-slate-400 text-sm py-8 text-center">
                No hay llamadas registradas para esta conversación.
              </div>
            ) : (
              <div className="space-y-3">
                {callHistory.map((call) => (
                  <div
                    key={call.id}
                    className="p-4 rounded-lg border border-slate-800 bg-slate-900/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg ${call.direction === 'outbound' ? 'text-emerald-400' : 'text-sky-400'}`}>
                            {call.direction === 'outbound' ? '📞→' : '📞←'}
                          </span>
                          <span className="font-medium text-slate-200">
                            {call.direction === 'outbound' ? 'Llamada saliente' : 'Llamada entrante'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(call.start_time).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded border ${
                          call.status === 'completed'
                            ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                            : call.status === 'missed' || call.status === 'no_answer'
                            ? 'bg-amber-900/30 border-amber-700 text-amber-300'
                            : call.status === 'failed' || call.status === 'rejected'
                            ? 'bg-red-900/30 border-red-700 text-red-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {call.status === 'completed' ? '✓ Completada' :
                         call.status === 'missed' ? '⊗ Perdida' :
                         call.status === 'no_answer' ? '⊗ Sin respuesta' :
                         call.status === 'rejected' ? '✕ Rechazada' :
                         call.status === 'failed' ? '✕ Fallida' :
                         call.status === 'in_progress' ? '⏳ En curso' :
                         call.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {call.duration_seconds > 0 && (
                        <span>⏱ Duración: {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, '0')}</span>
                      )}
                      {call.agent_name && (
                        <span>👤 Agente: {call.agent_name}</span>
                      )}
                    </div>
                    {call.notes && (
                      <div className="mt-2 text-sm text-slate-400 bg-slate-800/50 p-2 rounded">
                        {call.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notificación de llamada entrante */}
      {incomingCall && (
        <div className="fixed top-4 right-4 z-50 animate-bounce-subtle">
          <div className="bg-gradient-to-r from-emerald-600 to-sky-600 border-2 border-white rounded-2xl p-6 shadow-2xl max-w-sm">
            <div className="flex items-start gap-4">
              <div className="text-5xl animate-pulse">📞</div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-1">Llamada Entrante</h3>
                <p className="text-emerald-50 text-sm mb-2">
                  {conversation.wa_profile_name || conversation.wa_user}
                </p>
                <p className="text-white/80 text-xs">
                  {incomingCall.status === 'initiated' && 'Iniciando llamada...'}
                  {incomingCall.status === 'ringing' && 'Sonando...'}
                </p>
              </div>
              <button
                onClick={() => setIncomingCall(null)}
                className="text-white/80 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  loadCallHistory();
                  setIncomingCall(null);
                }}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Ver Detalles
              </button>
              <button
                onClick={() => setIncomingCall(null)}
                className="flex-1 bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <TemplatePicker
          conversation={conversation}
          onClose={() => setShowTemplates(false)}
          onSent={() => {
            setShowTemplates(false);
            refreshMessages();
          }}
        />
      )}

      {showLocationPicker && (
        <LocationPicker
          onSend={sendLocation}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      {attach.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeAttachments}>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-auto p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center mb-3">
              <div className="font-medium">Adjuntos</div>
              <button className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm" onClick={closeAttachments}>Cerrar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {attach.items.map((a,i)=>{
                const mt = (a.mime_type||'');
                const isImg = (a.tipo==='image') || mt.startsWith('image/');
                const isVideo = (a.tipo==='video') || mt.startsWith('video/');
                const isAudio = (a.tipo==='audio') || mt.startsWith('audio/');
                const url = a.url || (a.media_id ? `${BASE}/api/media/${a.media_id}`.replace(/\/\//g, '/') : null);
                if (isImg && url) return (
                  <button key={i} className="group" onClick={()=>openMedia('image', url)}>
                    <img src={url} alt="img" className="w-full h-28 object-cover rounded border border-slate-700" />
                  </button>
                );
                if (isVideo && url) return (
                  <button key={i} className="group" onClick={()=>openMedia('video', url)}>
                    <div className="w-full h-28 bg-black/40 grid place-items-center rounded border border-slate-700">🎬</div>
                  </button>
                );
                if (isAudio && url) return (
                  <div key={i} className="p-2 rounded border border-slate-800 bg-slate-900 text-xs">
                    <audio src={url} controls className="w-full" />
                  </div>
                );
                return (
                  <a key={i} href={url||'#'} target="_blank" rel="noreferrer" className="p-2 rounded border border-slate-800 bg-slate-900 text-xs truncate">Documento</a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de campos personalizados al cambiar estado */}
      {statusChangeModal.show && (
        <StatusFieldsModal
          status={statusChangeModal.status}
          onClose={() => setStatusChangeModal({ show: false, newStatusId: null, status: null })}
          onSubmit={(fieldData) => {
            handleStatusChange(statusChangeModal.newStatusId, fieldData);
            setStatusChangeModal({ show: false, newStatusId: null, status: null });
          }}
        />
      )}

      {/* Modal de trazabilidad */}
      {showTraceView && (
        <ConversationTraceView
          conversationId={conversation.id}
          onClose={() => setShowTraceView(false)}
        />
      )}
    </div>
  );
}



