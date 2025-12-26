import { useEffect, useState, useCallback } from "react";
import { useRealtimeChat } from "../hooks/useRealtimeChat.js";
import { useAppData } from "../contexts/AppDataContext.jsx";

const BASE = import.meta.env.BASE_URL || '';

// Formato de tiempo relativo estilo WhatsApp
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  // Más de una semana: mostrar fecha
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}

export default function ConversationsPane({ onSelect, currentId = null }) {
  const { statuses } = useAppData();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(""); // ID del estado o '' para todas
  const [view, setView] = useState("active"); // 'active', 'favorites', 'archived'
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({}); // { conversacion_id: count }
  const [showNewChat, setShowNewChat] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [agentFilter, setAgentFilter] = useState(""); // nombre del agente asignado
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sending, setSending] = useState(false);

  async function load(search = "", st = estado) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search,
        limit: String(50),
      });
      if (st) qs.set('status_id', st); // Cambiado de 'estado' a 'status_id'
      const r = await fetch(`${BASE}/api/conversations?${qs.toString()}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  // Cargar contadores de notificaciones no leídas
  async function loadUnreadCounts() {
    try {
      const r = await fetch(`${BASE}/api/notifications?leida=false`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok && Array.isArray(j.items)) {
        const counts = {};
        for (const notif of j.items) {
          counts[notif.conversacion_id] = (counts[notif.conversacion_id] || 0) + 1;
        }
        setUnreadCounts(counts);
      }
    } catch (e) {
      console.error('Error loading unread counts:', e);
    }
  }

  // Marcar conversación como leída
  async function markConversationAsRead(conversacionId) {
    if (!conversacionId) return;
    try {
      await fetch(`${BASE}/api/notifications`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversacionId })
      });
      // Actualizar localmente
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[conversacionId];
        return next;
      });
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  }

  // Marcar como leída cuando se abre una conversación
  useEffect(() => {
    if (currentId) {
      markConversationAsRead(currentId);
    }
  }, [currentId]);

  const isUnread = (c) => {
    return (unreadCounts[c.id] || 0) > 0;
  };

  // refresco silencioso para el polling (no toca `loading`)
  async function refresh(search = q, st = estado) {
    try {
      const qs = new URLSearchParams({
        search,
        limit: String(50),
      });
      if (st) qs.set('status_id', st); // Cambiado de 'estado' a 'status_id'
      const r = await fetch(`${BASE}/api/conversations?${qs.toString()}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setItems(j.items || []);
    } catch {
      // ignorar errores puntuales
    }
  }

  // Carga inicial - cargar conversaciones y notificaciones
  useEffect(() => {
    load("");
    loadUnreadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recargar cuando cambia el filtro de estado
  useEffect(() => {
    if (statuses.length > 0) { // Solo si ya cargaron los estados
      load("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  // Cargar plantillas cuando se abre el modal
  useEffect(() => {
    if (showNewChat && templates.length === 0) {
      setTemplates([
        {
          id: "ga_notificarchofer",
          nombre: "ga_notificarchofer",
          idioma: "en_US",
          categoria: "UTILITY",
          body_text: "Notificación al chofer.",
        },
      ]);
      setSelectedTemplate("ga_notificarchofer");
    }
  }, [showNewChat, templates.length]);

  async function startNewConversation() {
    if (!newPhone.trim() || !selectedTemplate) return;

    setSending(true);
    try {
      // Formatear número: si es de 10 dígitos, agregar 521 (México celular)
      let formattedPhone = newPhone.trim().replace(/\D/g, ''); // Quitar todo lo que no sea número

      if (formattedPhone.length === 10) {
        // Número local de 10 dígitos -> agregar 521
        formattedPhone = '521' + formattedPhone;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        // Ya tiene el 1 pero falta 52
        formattedPhone = '52' + formattedPhone;
      } else if (formattedPhone.length === 12 && formattedPhone.startsWith('52')) {
        // Ya tiene 52 pero falta el 1
        formattedPhone = '521' + formattedPhone.substring(2);
      }
      // Si tiene 13 dígitos y empieza con 521, dejarlo como está

      const tpl = templates.find(t => t.nombre === selectedTemplate);
      const r = await fetch(`${BASE}/api/start-conversation`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          template_name: selectedTemplate,
          language_code: tpl?.idioma || 'es',
        }),
      });

      const j = await r.json();
      if (j.ok) {
        setShowNewChat(false);
        setNewPhone("");
        load(); // Recargar lista
        // Abrir la conversación recién creada
        if (j.conversacion_id && onSelect) {
          setTimeout(() => {
            const conv = items.find(c => c.id === j.conversacion_id);
            if (conv) onSelect(conv);
          }, 500);
        }
      } else {
        alert(`Error: ${j.error || 'No se pudo iniciar la conversación'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error al iniciar conversación');
    } finally {
      setSending(false);
    }
  }

  // SSE: Recibir actualizaciones de conversaciones en tiempo real
  const handleRealtimeConversations = useCallback((updated) => {
    if (!Array.isArray(updated)) return;
    setItems((prev) => {
      const map = new Map(prev.map(c => [c.id, c]));
      for (const conv of updated) {
        if (map.has(conv.id)) {
          // Actualizar existente
          map.set(conv.id, {
            ...map.get(conv.id),
            last_text: conv.ultimo_msg,
            last_at: conv.ultimo_ts,
            estado: conv.estado,
            status_id: conv.status_id,
            status_name: conv.status_name,
            status_color: conv.status_color,
            status_icon: conv.status_icon,
            title: conv.wa_profile_name || conv.wa_user,
            asignado_a: conv.asignado_a,
            asignado_nombre: conv.asignado_nombre,
          });
        } else {
          // Nueva conversación
          map.set(conv.id, {
            id: conv.id,
            wa_user: conv.wa_user,
            title: conv.wa_profile_name || conv.wa_user,
            estado: conv.estado,
            status_id: conv.status_id,
            status_name: conv.status_name,
            status_color: conv.status_color,
            status_icon: conv.status_icon,
            last_text: conv.ultimo_msg,
            last_at: conv.ultimo_ts,
            asignado_a: conv.asignado_a,
            asignado_nombre: conv.asignado_nombre,
          });
        }
      }
      return Array.from(map.values());
    });
  }, []);

  // Conectar SSE para lista de conversaciones
  useRealtimeChat({
    onConversations: handleRealtimeConversations,
    enabled: true,
  });

  // Fallback: Polling cada 15s como respaldo si SSE falla
  useEffect(() => {
    const id = setInterval(() => {
      // reutiliza el último texto de búsqueda y estado seleccionados
      refresh();
      loadUnreadCounts(); // También recargar notificaciones
    }, 15000); // cada 15 segundos (reducido porque SSE es el principal)
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado]);

  // Filtrar según la vista seleccionada
  const filtered = items.filter(c => {
    if (agentFilter && c.asignado_nombre !== agentFilter) {
      return false;
    }
    if (view === 'archived') {
      return c.is_archived === true || c.is_archived === 1;
    } else if (view === 'favorites') {
      return c.is_favorite === true || c.is_favorite === 1;
    } else {
      // Vista 'active': excluir archivados
      return !(c.is_archived === true || c.is_archived === 1);
    }
  });

  // Ordenar: favoritos primero, luego no leídos, luego por fecha
  const sorted = [...filtered].sort((a, b) => {
    // 1. Favoritos primero (solo en vista active)
    if (view === 'active') {
      const fa = a.is_favorite === true || a.is_favorite === 1;
      const fb = b.is_favorite === true || b.is_favorite === 1;
      if (fa !== fb) return fa ? -1 : 1;
    }

    // 2. No leídos antes que leídos
    const ua = isUnread(a);
    const ub = isUnread(b);
    if (ua !== ub) return ua ? -1 : 1;

    // 3. Por fecha (más reciente primero)
    return Number(b.last_at || 0) - Number(a.last_at || 0);
  });

  return (
    <div className="h-full flex flex-col bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header con filtros */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-slate-800 bg-slate-900/40">
        {/* Primera fila: Título + acciones */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">Conversaciones</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              {items.length} abiertas
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button
              onClick={() => setShowNewChat(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold shadow-sm whitespace-nowrap"
              title="Nueva conversación"
            >
              + Nueva
            </button>
            <select
              value={estado}
              onChange={(e)=>setEstado(e.target.value)}
              className="h-8 bg-slate-900 border border-slate-700 rounded-lg px-3 text-xs min-w-[140px] outline-none focus:border-emerald-400"
              title="Filtrar por estado"
            >
              <option value="">Todas</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            <select
              value={agentFilter}
              onChange={(e)=>setAgentFilter(e.target.value)}
              className="h-8 bg-slate-900 border border-slate-700 rounded-lg px-3 text-xs min-w-[150px] outline-none focus:border-emerald-400"
              title="Filtrar por agente asignado"
            >
              <option value="">Todos los agentes</option>
              {Array.from(new Set(items.map(i => i.asignado_nombre).filter(Boolean))).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Segunda fila: Búsqueda (siempre full-width) */}
        <div className="flex items-center gap-2 mb-2">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={(e)=> e.key==="Enter" && load(q)}
            placeholder="Buscar por nombre, número o texto..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-400 shadow-inner"
          />
          <button
            onClick={()=>load(q)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 flex-shrink-0 border border-slate-700 text-slate-200"
            title="Buscar"
          >
            🔎
          </button>
        </div>

        {/* Pestañas de vista */}
        <div className="flex gap-1">
          <button
            onClick={() => setView('active')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              view === 'active'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/60'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            💬 Activos
          </button>
          <button
            onClick={() => setView('favorites')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              view === 'favorites'
                ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/60'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            ⭐ Favoritos
          </button>
          <button
            onClick={() => setView('archived')}
            className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
              view === 'archived'
                ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            📦 Archivados
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll min-h-0">
        {loading && <div className="p-3 text-sm text-slate-400">Cargando…</div>}
        {!loading && sorted.length === 0 && <div className="p-3 text-sm text-slate-400">Sin resultados</div>}

        {sorted.map((c) => {
          const unread = isUnread(c);
          const baseClasses = "w-full text-left px-4 py-3 border-b flex items-start gap-3";
          const visual = unread
            ? "bg-slate-900/80 border-emerald-500/60"
            : "hover:bg-slate-800/70 border-slate-800";
          return (
          <button
            key={c.id}
            onClick={() => onSelect?.(c)}
            className={`${baseClasses} ${visual}`}
          >
            <div className="w-9 h-9 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs">
              {String((c.title || 'C')[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {/* Fila superior: Nombre + Timestamp */}
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {(c.is_favorite === true || c.is_favorite === 1) && (
                    <span className="text-yellow-400 text-xs shrink-0">⭐</span>
                  )}
                  <div className={`font-medium leading-tight truncate ${unread ? "text-emerald-200 font-semibold" : ""}`}>
                    {c.title || `Chat ${c.id}`}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 shrink-0">
                  {formatRelativeTime(c.last_at)}
                </div>
              </div>

              {/* Fila intermedia: Último mensaje */}
              <div className="flex items-center gap-2 mb-1">
                <div className={`text-xs truncate flex-1 ${unread ? "text-slate-300 font-medium" : "text-slate-400"}`}>
                  {c.last_text || '-'}
                </div>
                {unread && unreadCounts[c.id] > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shrink-0 min-w-[20px] text-center">
                    {unreadCounts[c.id]}
                  </span>
                )}
              </div>

              {/* Fila inferior: Badges (estado + agente) */}
              <div className="flex items-center gap-2">
                {c.status_name && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full border text-white"
                    style={{
                      backgroundColor: (c.status_color || '#64748b') + '40',
                      borderColor: c.status_color || '#64748b'
                    }}
                  >
                    {c.status_icon} {c.status_name}
                  </span>
                )}
                {c.asignado_nombre && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-700/80 text-sky-400 bg-sky-900/20 flex items-center gap-1">
                    <span>👤</span>
                    <span>{c.asignado_nombre}</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        )})}
      </div>

      {/* Modal para nueva conversación */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowNewChat(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Nueva Conversación</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Número de teléfono</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="3331679990"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">Escribe el número de 10 dígitos (ej: 3331679990)</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Plantilla</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-emerald-400"
                >
                  {templates.length === 0 && <option value="">Cargando...</option>}
                  {templates.map(t => (
                    <option key={t.id} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Solo plantillas aprobadas por WhatsApp</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowNewChat(false)}
                  className="flex-1 px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  disabled={sending}
                >
                  Cancelar
                </button>
                <button
                  onClick={startNewConversation}
                  disabled={!newPhone.trim() || !selectedTemplate || sending}
                  className="flex-1 px-4 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Enviando...' : 'Iniciar Chat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
