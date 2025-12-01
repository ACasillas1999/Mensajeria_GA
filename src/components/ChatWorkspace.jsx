import { useEffect, useState, useRef } from "react";
import ConversationsPane from "./ConversationsPane.jsx";
import ChatPane from "./ChatPane.jsx";
import { AppDataProvider } from "../contexts/AppDataContext.jsx";

const BASE = import.meta.env.BASE_URL || '';
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;

function ChatWorkspaceInner({ initialId = null }) {
  const [current, setCurrent] = useState(null); // {id,title,wa_user,...}
  const [leftWidth, setLeftWidth] = useState(() => {
    // Cargar ancho guardado de localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatWorkspace_leftWidth');
      return saved ? Number(saved) : DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Preselección por id (ej. /mensajes?conversation_id=123)
  useEffect(() => {
    if (!initialId || current) return;
    let canceled = false;
    async function preload(id) {
      try {
        const r = await fetch(`${BASE}/api/conversations/${id}`.replace(/\/\//g, '/'));
        const j = await r.json();
        if (!canceled && j.ok) setCurrent(j.item);
      } catch {}
    }
    preload(initialId);
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, !!current]);

  // Guardar ancho en localStorage cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatWorkspace_leftWidth', String(leftWidth));
    }
  }, [leftWidth]);

  // Manejo del resize
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Aplicar límites
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const currentId = current?.id || initialId || null;

  // Función para volver a la lista en móvil
  const handleBackToList = () => {
    setCurrent(null);
  };

  return (
    <section ref={containerRef} className="flex gap-0 h-full relative select-none">
      {/* MOBILE: Panel izquierdo (conversaciones) - se oculta cuando hay conversación seleccionada */}
      <aside
        className={`md:hidden w-full h-full ${current ? 'hidden' : 'block'}`}
      >
        <ConversationsPane onSelect={setCurrent} currentId={currentId} />
      </aside>

      {/* MOBILE: Panel derecho (chat) - se oculta cuando no hay conversación seleccionada */}
      <section
        className={`md:hidden w-full h-full ${current ? 'block' : 'hidden'}`}
      >
        {current && (
          <div className="h-full flex flex-col">
            {/* Botón para volver a la lista en móvil */}
            <div className="flex-shrink-0 h-12 px-3 flex items-center gap-2 bg-slate-950 border-b border-slate-800">
              <button
                onClick={handleBackToList}
                className="p-2 hover:bg-slate-800 rounded-lg transition"
                title="Volver a conversaciones"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="font-medium truncate">{current.title || `Chat ${current.id}`}</div>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPane conversation={current} />
            </div>
          </div>
        )}
      </section>

      {/* DESKTOP: Layout con divisor redimensionable */}
      <aside
        style={{ width: `${leftWidth}px` }}
        className="hidden md:block flex-shrink-0 h-full"
      >
        <ConversationsPane onSelect={setCurrent} currentId={currentId} />
      </aside>

      <div
        onMouseDown={handleMouseDown}
        className={`hidden md:block w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors flex-shrink-0 ${
          isDragging ? 'bg-emerald-500' : 'bg-slate-700/30'
        }`}
        title="Arrastra para redimensionar"
      />

      <section className="hidden md:block flex-1 min-w-0 h-full">
        <ChatPane conversation={current} />
      </section>
    </section>
  );
}

// Wrapper con Provider
export default function ChatWorkspace({ initialId = null }) {
  return (
    <AppDataProvider>
      <ChatWorkspaceInner initialId={initialId} />
    </AppDataProvider>
  );
}
