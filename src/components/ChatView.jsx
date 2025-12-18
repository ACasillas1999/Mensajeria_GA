import { useEffect, useRef, useState } from 'react'
import TemplatePicker from './TemplatePicker.jsx'

const BASE = import.meta.env.BASE_URL || '';

export default function ChatView({ conversation }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  // ---- Grabación ----
  const recRef = useRef(null)           // MediaRecorder
  const recStreamRef = useRef(null)     // MediaStream
  const recChunksRef = useRef([])
  const [recState, setRecState] = useState('idle') // 'idle' | 'recording'
  const [recSecs, setRecSecs] = useState(0)
  const recTimerRef = useRef(null)

  // Cargar mensajes iniciales y conectar SSE para actualizaciones en tiempo real
  useEffect(() => {
    if (!conversation) return
    let cancel = false
    let eventSource = null

    async function load() {
      const r = await fetch(`${BASE}/api/messages?conversation_id=${conversation.id}`.replace(/\/\//g, '/'))
      const data = await r.json()
      if (!cancel && data.ok) {
        setMsgs(data.items || [])

        // Conectar SSE para actualizaciones en tiempo real
        eventSource = new EventSource(`${BASE}/api/events?conversation_id=${conversation.id}`.replace(/\/\//g, '/'))

        eventSource.addEventListener('messages', (e) => {
          const newMessages = JSON.parse(e.data)
          setMsgs(prev => {
            const existing = new Set(prev.map(m => m.id))
            const toAdd = newMessages.filter(m => !existing.has(m.id))
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev
          })
        })

        eventSource.addEventListener('status', (e) => {
          const updates = JSON.parse(e.data)
          setMsgs(prev => prev.map(m => {
            const upd = updates.find(u => u.id === m.id)
            return upd ? { ...m, status: upd.status } : m
          }))
        })

        eventSource.onerror = () => {
          console.warn('SSE connection error, will retry automatically')
        }
      }
    }
    load()
    return () => {
      cancel = true
      if (eventSource) eventSource.close()
    }
  }, [conversation])

  // Auto-scroll al último
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, conversation])

  function renderStatus(m) {
    if (!m.from_me) return null
    const base = 'ml-2 text-xs select-none'
    if (m.status === 'read')      return <span className={`${base} text-blue-600`}>✓✓</span>
    if (m.status === 'delivered') return <span className={`${base} text-gray-500`}>✓✓</span>
    if (m.status === 'failed')    return <span className={`${base} text-red-600`}>✗</span>
    return <span className={`${base} text-gray-400`}>✓</span>
  }

  // ---- Adjuntar archivo (ya lo tenías) ----
  async function attachAndSend(e) {
    const file = e.target.files?.[0]
    if (!file || !conversation) return

    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch(`${BASE}/api/upload`.replace(/\/\//g, '/'), { method:'POST', body: fd })
    const uj = await up.json()
    if (!uj.ok) { alert('Error al subir archivo'); return }

    const caption = prompt('Agregar comentario/caption? (opcional)') || ''
    const sm = await fetch(`${BASE}/api/send-media`.replace(/\/\//g, '/'), {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        conversacion_id: conversation.id,
        to: conversation.wa_user,
        kind: uj.kind,
        url: uj.url,
        caption
      })
    })
    const sj = await sm.json()

    if (sm.status === 409 && sj?.requires_template) {
      const tpl = prompt('Fuera de 24h. NOMBRE de plantilla aprobada (ej: reengage_es):')
      if (!tpl) return
      const r2 = await fetch(`${BASE}/api/send-template`.replace(/\/\//g, '/'), {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          conversacion_id: conversation.id,
          to: conversation.wa_user,
          template: tpl,
          lang: 'es_MX',
          params: []
        })
      })
      const j2 = await r2.json()
      if (!r2.ok || !j2.ok) { alert(`Plantilla no enviada: ${j2?.error?.message || j2?.error?.title || 'Error'}`); return }
      setMsgs(m => [...m, { id: Date.now(), from_me: 1, tipo:'template', cuerpo:`[TPL:${tpl}]`, ts: Math.floor(Date.now()/1000), status:'sent' }])
      e.target.value = ''
      return
    }

    if (!sm.ok || !sj.ok) { alert(`No se envió: ${sj?.error?.message || sj?.error?.title || 'Error'}`); return }

    setMsgs(m => [...m, {
      id: Date.now(), from_me: 1, tipo: uj.kind, cuerpo: caption || `[${uj.kind}]`,
      ts: Math.floor(Date.now()/1000), status: 'sent', media_url: uj.url
    }])
    e.target.value = ''
  }

  function pickFile() { fileRef.current?.click() }

  // ---- Enviar texto ----
  async function send() {
    if (!text.trim() || !conversation) return
    const res = await fetch(`${BASE}/api/send`.replace(/\/\//g, '/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversacion_id: conversation.id, to: conversation.wa_user, text })
    })
    const json = await res.json()
    if (!res.ok || !json.ok) { alert(`No se envió: ${json?.error?.message || json?.error?.title || 'Error'}`); return }
    setMsgs(m => [...m, { id: Date.now(), from_me: 1, tipo:'text', cuerpo:text, ts: Math.floor(Date.now()/1000), status:'sent' }])
    setText('')
  }

  // ---- Grabación de nota de voz ----
 function pickBestAudioMime() {
  // Solo aceptamos OGG/Opus; si no hay soporte, no grabamos.
  const ogg = 'audio/ogg;codecs=opus'
  if (window.MediaRecorder && MediaRecorder.isTypeSupported?.(ogg)) {
    return { mime: ogg, ext: 'ogg' }
  }
  return { mime: '', ext: '' } // sin soporte
}

 async function startRec() {
  try {
    if (!conversation) return
    const pref = pickBestAudioMime()
    if (!pref.mime) {
      alert('Tu navegador no soporta grabación OGG/Opus. Usa Chrome/Firefox/Edge recientes o envía un audio cargando un .mp3/.ogg.')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream, { mimeType: pref.mime })

    recChunksRef.current = []
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recChunksRef.current.push(e.data) }
    mr.onstop = async () => { await finalizeRecording(mr) }

    recRef.current = mr
    recStreamRef.current = stream
    mr.start()

    setRecState('recording')
    setRecSecs(0)
    recTimerRef.current = window.setInterval(() => setRecSecs(s => s + 1), 1000)
  } catch (e) {
    alert('No se pudo acceder al micrófono')
  }
}
  function stopRec() {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }

  function cancelRec() {
    cleanupRec()
  }

  function cleanupRec() {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    recStreamRef.current?.getTracks()?.forEach(t => t.stop())
    recRef.current = null
    recStreamRef.current = null
    recChunksRef.current = []
    setRecState('idle')
    setRecSecs(0)
  }

  async function finalizeRecording(mr) {
  try {
    const type = 'audio/ogg;codecs=opus'
    const blob = new Blob(recChunksRef.current, { type })
    const file = new File([blob], `voice-${Date.now()}.ogg`, { type })

    // subir
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch(`${BASE}/api/upload`.replace(/\/\//g, '/'), { method:'POST', body: fd })
    const uj = await up.json()
    if (!uj.ok) { alert('Error al subir nota de voz'); cleanupRec(); return }

    // enviar por link como audio
    const sm = await fetch(`${BASE}/api/send-media`.replace(/\/\//g, '/'), {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        conversacion_id: conversation.id,
        to: conversation.wa_user,
        kind: 'audio',
        url: uj.url,
        caption: ''
      })
    })
    const sj = await sm.json()
    // (mismo manejo de 409 / plantilla que ya tienes...)
    if (sm.status === 409 && sj?.requires_template) { /* ... */ return }

    if (!sm.ok || !sj.ok) { alert(`No se envió: ${sj?.error?.message || sj?.error?.title || 'Error'}`); cleanupRec(); return }

    setMsgs(m => [...m, {
      id: Date.now(), from_me: 1, tipo: 'audio', cuerpo: '[Audio]',
      ts: Math.floor(Date.now()/1000), status: 'sent', media_url: uj.url
    }])
  } finally {
    cleanupRec()
  }
  
}


  // UI
  if (!conversation) {
    return <div className="flex items-center justify-center h-full text-gray-400">Selecciona una conversación</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b font-semibold">
        {conversation.wa_profile_name || conversation.wa_user}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {msgs.map(m => {
          const common = `max-w-[70%] px-3 py-2 rounded-lg ${m.from_me ? 'ml-auto bg-green-100' : 'bg-white border'}`
          const mediaSrc = m.media_id
            ? `${BASE}/api/media/${m.media_id}`.replace(/\/\//g, '/')
            : m.media_url

          if (m.tipo === 'audio' && mediaSrc) {
            return (
              <div key={m.id} className={common}>
                <audio controls src={mediaSrc} />
                {renderStatus(m)}
              </div>
            )
          }
          if (m.tipo === 'image' && mediaSrc) {
            return (
              <div key={m.id} className={common}>
                <img src={mediaSrc} alt="imagen" className="rounded max-w-[280px]" />
                {m.cuerpo && <div className="text-xs text-gray-600 mt-1">{m.cuerpo}</div>}
                {renderStatus(m)}
              </div>
            )
          }
          if (m.tipo === 'document' && mediaSrc) {
            return (
              <div key={m.id} className={common}>
                <a href={mediaSrc} target="_blank" rel="noreferrer" className="underline">{m.cuerpo || 'Descargar documento'}</a>
                {renderStatus(m)}
              </div>
            )
          }
          if (m.tipo === 'video' && mediaSrc) {
            return (
              <div key={m.id} className={common}>
                <video controls className="rounded max-w-[300px]" src={mediaSrc} />
                {m.cuerpo && <div className="text-xs text-gray-600 mt-1">{m.cuerpo}</div>}
                {renderStatus(m)}
              </div>
            )
          }
          return (
            <div key={m.id} className={common}>
              <div className="whitespace-pre-wrap text-sm flex items-end">
                <span>{m.cuerpo}</span>
                {renderStatus(m)}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="p-3 border-t flex items-center gap-2">
        {recState === 'recording' ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-50 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-sm text-red-700 font-medium">Grabando… {String(Math.floor(recSecs/60)).padStart(2,'0')}:{String(recSecs%60).padStart(2,'0')}</span>
            <button onClick={stopRec} className="px-3 py-1 bg-red-600 text-white rounded">Detener</button>
            <button onClick={cancelRec} className="px-3 py-1 border rounded">Cancelar</button>
          </div>
        ) : (
          <>
            <input
              className="flex-1 border rounded px-3 py-2"
              value={text}
              onChange={e=>setText(e.target.value)}
              placeholder="Escribe un mensaje..."
              onKeyDown={(e)=> e.key==='Enter' && send()}
            />
            <input type="file" ref={fileRef} className="hidden"
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={attachAndSend}
            />
            <button onClick={pickFile} className="px-3 py-2 border rounded" title="Adjuntar archivo">📎</button>
            <button onClick={startRec} className="px-3 py-2 border rounded" title="Grabar nota de voz">🎙</button>
            <button onClick={() => setShowTemplatePicker(true)} className="px-3 py-2 border rounded bg-blue-50 hover:bg-blue-100" title="Enviar plantilla">📋</button>
            <button onClick={send} className="px-4 py-2 bg-green-600 text-white rounded">Enviar</button>
          </>
        )}
      </div>

      {/* Modal de plantillas */}
      {showTemplatePicker && (
        <TemplatePicker
          conversation={conversation}
          onClose={() => setShowTemplatePicker(false)}
          onSent={() => {
            // Recargar mensajes después de enviar plantilla
            setTimeout(async () => {
              const r = await fetch(`${BASE}/api/messages?conversation_id=${conversation.id}`.replace(/\/\//g, '/'))
              const data = await r.json()
              if (data.ok) setMsgs(data.items || [])
            }, 500)
          }}
        />
      )}
    </div>
  )
}
