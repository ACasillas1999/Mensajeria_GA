import { useEffect, useRef, useState } from "react";
import MediaModal from "./MediaModal.jsx";

// sonido (coloca public/ding.mp3)
const ding = typeof Audio !== "undefined" ? new Audio("/ding.mp3") : null;

/* Muestra imágenes / videos / audios / docs */
function MediaBubble({ m, onOpen }) {
  const mime = (m.mime_type || "").toLowerCase();
  const kind =
    m.tipo ||
    (mime.startsWith("image/") ? "image" :
     mime.startsWith("video/") ? "video" :
     mime.startsWith("audio/") ? "audio" : "document");

  const src = m.media_url || (m.media_id ? `/api/media/${m.media_id}` : null);

  if (kind === "image" && src) {
    return (
      <button onClick={() => onOpen?.("image", src)} className="group">
        <img
          src={src}
          className="max-w-xs rounded border border-slate-700 transition-transform group-hover:scale-[1.02]"
          alt="imagen"
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
}

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

export default function ChatPane({ conversation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  // notificaciones
  const prevIncomingCountRef = useRef(0);

  // modal media
  const [modal, setModal] = useState({ open: false, kind: null, src: null });
  const openMedia = (kind, src) => setModal({ open: true, kind, src });
  const closeMedia = () => setModal({ open: false, kind: null, src: null });
  const [attach, setAttach] = useState({ open:false, items:[] });

  // composer
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
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
    // 0) Requisito: HTTPS o localhost
    const secure = location.protocol === 'https:' ||
                   ['localhost','127.0.0.1'].includes(location.hostname);
    if (!secure) {
      alert('Activa HTTPS o usa localhost para permitir la grabación.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Grabación no soportada por el navegador.');
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
    alert('No se pudo iniciar la grabación: ' + (e?.message || e));
  }
}


  function stopRecording() {
    const mr = mediaRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  }

  async function sendRecorded() {
    if (!recState.blob || !conversation) return;
    try {
      const fd = new FormData();
      const ext = (recState.blob.type || '').includes('ogg') ? 'ogg' : 'webm';
      const fileName = `audio-${Date.now()}.${ext}`;
      fd.append('file', new File([recState.blob], fileName, { type: recState.blob.type || 'audio/webm' }));
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const uj = await up.json();
      if (!up.ok || !uj.ok) { alert(uj?.error || 'No se pudo subir el audio'); return; }

      const tempId = `temp-a-${Date.now()}`;
      setItems(prev => ([...prev, { id: tempId, sender:'me', tipo:'audio', media_url: uj.url, created_at: new Date().toISOString(), status:'sending' }]));

      const res = await fetch('/api/send-media', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ conversacion_id: conversation.id, to: conversation.wa_user, kind:'audio', url: uj.url }) });
      const j = await res.json();
      if (j.ok) setItems(prev => prev.map(m => m.id === tempId ? { ...m, status:'sent' } : m));
      else { setItems(prev => prev.map(m => m.id === tempId ? { ...m, status:'failed' } : m)); alert(j.error?.message || 'No se pudo enviar el audio'); }
    } catch (e) {
      alert('Error enviando audio');
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
    if (sc) sc.scrollTop = sc.scrollHeight;
    else endRef.current?.scrollIntoView({ behavior: "auto" });
  };

  // pedir permiso notificaciones
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  async function load() {
    if (!conversation) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ conversation_id: String(conversation.id), limit: String(300) });
      if (searchQ.trim()) qs.set('q', searchQ.trim());
      const r = await fetch(`/api/messages?${qs.toString()}`);
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 0);
    }
  }
  async function runSearch() { await load(); }
  async function openAttachments() {
    if (!conversation) return;
    try {
      const r = await fetch(`/api/conversation-attachments?conversation_id=${conversation.id}&limit=200`);
      const j = await r.json();
      if (j.ok) setAttach({ open:true, items: j.items || [] });
    } catch {}
  }
  function closeAttachments() { setAttach({ open:false, items:[] }); }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [conversation?.id]);
  useEffect(() => { scrollToBottom(); }, [items.length]); // autoscroll ante nuevos mensajes

  // Polling ligero SOLO de estados (cada 5s)
  useEffect(() => {
    if (!conversation) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/message-status?conversation_id=${conversation.id}`);
        const j = await r.json();
        if (!j.ok) return;
        const map = new Map(j.items.map((m) => [m.id, m.status]));
        setItems((prev) =>
          prev.map(m => (m.sender === "me" && map.has(m.id)) ? { ...m, status: map.get(m.id) } : m)
        );
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [conversation?.id]);

  // notificaciones + sonido al recibir entrantes nuevos
  useEffect(() => {
    const incoming = items.filter(m => m.sender === "them");
    const prev = prevIncomingCountRef.current;

    if (incoming.length > prev) {
      const inBackground = typeof document !== "undefined" && document.visibilityState === "hidden";

      // sonido
      try {
        if (ding /* && inBackground */) {
          ding.currentTime = 0;
          ding.play().catch(() => {});
        }
      } catch {}

      // notificación
      if ("Notification" in window && Notification.permission === "granted" /* && inBackground */) {
        const last = incoming[incoming.length - 1];
        const title = conversation?.title || conversation?.wa_user || "Nuevo mensaje";
        const body = (last?.text && String(last.text).slice(0, 80)) || `[${last?.tipo || "mensaje"}]`;
        try { new Notification(title, { body }); } catch {}
      }
    }

    prevIncomingCountRef.current = incoming.length;
  }, [items.length, conversation?.id]);

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
    setTimeout(scrollToBottom, 0);

    try {
      let res, j;
      if (file) {
        const fd = new FormData();
        fd.append("conversacion_id", conversacion_id);
        fd.append("to", to);
        if (text) fd.append("text", text);
        fd.append("file", file);
        res = await fetch("/api/send", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversacion_id, to, text }),
        });
      }
      j = await res.json();

      if (j.ok) {
        setItems((prev) =>
          prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m)
        );
      } else {
        setItems((prev) =>
          prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m)
        );
        alert(j.error?.message || "No se pudo enviar");
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

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ conversacion_id, to, text: failedMsg.text || "" })
      });
      const j = await res.json();

      if (j.ok) {
        setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "sent" } : m));
      } else {
        setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "failed" } : m));
        alert(j.error?.message || "No se pudo reenviar");
      }
    } catch {
      setItems(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: "failed" } : m));
      alert("Error de red");
    }
  }

  // Enter para enviar (Shift+Enter = salto)
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!conversation) {
    return (
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl h-[calc(100vh-14rem)] flex items-center justify-center">
        <p className="text-slate-400">Selecciona una conversación</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl h-[calc(100vh-14rem)] flex flex-col">
      <div className="h-12 px-4 flex items-center gap-3 border-b border-slate-800">
        <div className="font-medium truncate">{conversation.title || `Chat ${conversation.id}`}</div>
        <div className="text-xs text-slate-400 truncate">{conversation.wa_user}</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700/80 text-emerald-300">{conversation.estado || "-"}</span>
          <select
            defaultValue={conversation.estado || 'ABIERTA'}
            onChange={async (e)=>{
              try {
                const estado = e.target.value;
                const r = await fetch('/api/conversation-status', {
                  method: 'POST', headers: { 'Content-Type':'application/json' },
                  body: JSON.stringify({ id: conversation.id, estado })
                });
                const j = await r.json();
                if (!j.ok) alert(j.error || 'No se pudo actualizar');
                else conversation.estado = estado;
              } catch {}
            }}
            className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1"
          >
            <option value="NUEVA">NUEVA</option>
            <option value="ABIERTA">ABIERTA</option>
            <option value="RESUELTA">RESUELTA</option>
          </select>
          <input
            value={searchQ}
            onChange={(e)=>setSearchQ(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==='Enter') runSearch(); }}
            placeholder="Buscar en chat..."
            className="h-8 px-2 rounded bg-slate-900 border border-slate-700 text-xs outline-none focus:border-emerald-400"
            style={{width:'160px'}}
          />
          <button type="button" onClick={runSearch} title="Buscar" className="h-8 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs">🔎</button>
          <button type="button" onClick={openAttachments} title="Ver adjuntos" className="h-8 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs">📎</button>
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto thin-scroll p-4 space-y-2">
        {loading && <div className="text-sm text-slate-400">Cargando…</div>}
        {items.map(m => (
          <div key={m.id}
               className={`max-w-[75%] px-3 py-2 rounded-lg border
                 ${m.sender === 'me'
                   ? 'ml-auto bg-emerald-600/20 border-emerald-700'
                   : 'bg-slate-800 border-slate-700'}`}>
            {m.tipo === "text" && m.text && <div className="text-sm whitespace-pre-wrap">{m.text}</div>}
            {m.tipo !== "text" && <MediaBubble m={m} onOpen={openMedia} />}

            <div className="mt-1 flex items-center gap-2">
              <div className="text-[10px] text-slate-400">
                {new Date(m.created_at).toLocaleString()}
              </div>
              {m.sender === "me" && <StatusBadge s={m.status} />}
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
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="p-3 border-t border-slate-800 flex items-center gap-2">
        <label className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer">
          <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          📎
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={file ? "Mensaje (opcional)..." : "Escribe un mensaje..."}
          rows={1}
          className="resize-none flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 outline-none focus:border-emerald-400"
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

      <MediaModal open={modal.open} kind={modal.kind} src={modal.src} onClose={closeMedia} />
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
                const url = a.url || (a.media_id ? `/api/media/${a.media_id}` : null);
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
    </div>
  );
}



