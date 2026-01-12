import { useState, useRef, useEffect } from "react";

export default function ChatHeader({
  conversation,
  insideWindow,
  timeRemaining,
  formatTimeRemaining,
  // Actions
  toggleFavorite,
  toggleArchive,
  loadCallHistory,
  setShowTraceView,
  handleCompleteCycle,
  handleStatusChange,
  handleAssignAgent,
  openAttachments,
  setShowTemplates,
  // Search
  searchQ,
  setSearchQ,
  runSearch,
  clearSearch,
  searchResults,
  currentSearchIndex,
  prevSearchResult,
  nextSearchResult,
  // Data
  statuses,
  users,
  // Modal states
  statusChangeModal,
  setStatusChangeModal,
}) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 flex-wrap">
      {/* Nombre y número */}
      <div className="flex flex-col min-w-0 flex-shrink">
        <div className="font-medium text-sm truncate text-slate-900 dark:text-white">
          {conversation.title || `Chat ${conversation.id}`}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
          {conversation.wa_user}
        </div>
      </div>

      {/* Indicador de ventana de 24h */}
      {insideWindow && timeRemaining ? (
        <div
          className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            timeRemaining <= 2 * 60 * 60 * 1000
              ? "bg-amber-900/30 border-amber-600/50 text-amber-300"
              : "bg-emerald-900/30 border-emerald-600/50 text-emerald-300"
          }`}
          title={`Tiempo restante: ${formatTimeRemaining(timeRemaining)}`}
        >
          <span>{timeRemaining <= 2 * 60 * 60 * 1000 ? "⏰" : "✓"}</span>
          <span className="hidden sm:inline">{formatTimeRemaining(timeRemaining)}</span>
        </div>
      ) : !insideWindow ? (
        <div
          className="text-[10px] px-2 py-0.5 rounded-full border bg-red-900/30 border-red-600/50 text-red-300 flex items-center gap-1"
          title="Fuera de la ventana de 24h - Solo plantillas"
        >
          <span>🔒</span>
          <span className="hidden sm:inline">Fuera de ventana</span>
        </div>
      ) : null}

      {/* Acciones - Desktop y Tablet */}
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {/* Botones principales - Visible en desktop */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Favorito */}
          <button
            type="button"
            onClick={toggleFavorite}
            title={conversation.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            className={`h-8 px-2 rounded text-xs transition ${
              conversation.is_favorite
                ? "bg-yellow-600/20 border border-yellow-600/60 text-amber-900 dark:text-yellow-300"
                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-400"
            }`}
          >
            {conversation.is_favorite ? "⭐" : "☆"}
          </button>

          {/* Archivar */}
          <button
            type="button"
            onClick={toggleArchive}
            title={conversation.is_archived ? "Desarchivar" : "Archivar"}
            className={`h-8 px-2 rounded text-xs ${
              conversation.is_archived
                ? "bg-slate-700/60 text-slate-300"
                : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-400"
            }`}
          >
            📦
          </button>

          {/* Trazabilidad */}
          <button
            type="button"
            onClick={() => setShowTraceView(true)}
            title="Ver trazabilidad completa (Ticket)"
            className="h-8 px-2 rounded text-xs bg-gradient-to-r from-purple-200 dark:from-purple-900/40 to-blue-200 dark:to-blue-900/40 hover:from-purple-300 dark:hover:from-purple-800/60 hover:to-blue-300 dark:hover:to-blue-800/60 border border-purple-400 dark:border-purple-700/50 text-purple-900 dark:text-purple-200 transition font-medium whitespace-nowrap"
          >
            🎫 <span className="hidden xl:inline">Trazabilidad</span>
          </button>
        </div>

        {/* Completar ciclo - Visible en tablet+ */}
        <button
          type="button"
          onClick={handleCompleteCycle}
          title="Completar ciclo actual y reiniciar conversación"
          className="hidden md:flex h-8 px-2 rounded text-xs bg-gradient-to-r from-green-200 dark:from-green-900/40 to-emerald-200 dark:to-emerald-900/40 hover:from-green-300 dark:hover:from-green-800/60 hover:to-emerald-300 dark:hover:to-emerald-800/60 border border-green-400 dark:border-green-700/50 text-green-900 dark:text-green-200 transition font-medium whitespace-nowrap items-center gap-1"
        >
          ✅ <span className="hidden lg:inline">Completar Ciclo</span>
        </button>

        {/* Estado actual badge */}
        {conversation.status_name && (
          <span
            className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full border text-white whitespace-nowrap"
            style={{
              backgroundColor: conversation.status_color + "40",
              borderColor: conversation.status_color,
            }}
          >
            {conversation.status_icon} {conversation.status_name}
          </span>
        )}

        {/* Selector de estado - Desktop */}
        <select
          value={conversation.status_id || ""}
          onChange={(e) => {
            const newStatusId = Number(e.target.value);
            const newStatus = statuses.find((s) => s.id === newStatusId);

            if (newStatus?.required_fields) {
              try {
                const fields = Array.isArray(newStatus.required_fields)
                  ? newStatus.required_fields
                  : JSON.parse(newStatus.required_fields);

                if (Array.isArray(fields) && fields.length > 0) {
                  setStatusChangeModal({ show: true, newStatusId, status: newStatus });
                  e.target.value = conversation.status_id || "";
                  return;
                }
              } catch (err) {
                console.error("Error validando required_fields:", err);
              }
            }

            handleStatusChange(newStatusId, null);
          }}
          className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded px-2 py-1"
        >
          {statuses.filter((s) => !s.is_final).map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.name}
            </option>
          ))}
        </select>

        {/* Selector de agente - Desktop */}
        <select
          value={conversation.asignado_a || ""}
          onChange={(e) => handleAssignAgent(e.target.value ? Number(e.target.value) : null)}
          className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded px-2 py-1"
          title="Asignar a agente"
        >
          <option value="">Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              👤 {u.nombre}
            </option>
          ))}
        </select>

        {/* Menú de acciones - Responsive */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="h-8 px-3 rounded text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition flex items-center gap-1"
            title="Más acciones"
          >
            <span className="md:hidden">☰</span>
            <span className="hidden md:inline">⋮ Más</span>
          </button>

          {showActionsMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50">
              {/* Gestión - Solo móvil */}
              <div className="lg:hidden border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Gestión
                </div>
                <button
                  onClick={() => {
                    toggleFavorite();
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  {conversation.is_favorite ? "⭐" : "☆"}
                  <span>{conversation.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}</span>
                </button>
                <button
                  onClick={() => {
                    toggleArchive();
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  📦 <span>{conversation.is_archived ? "Desarchivar" : "Archivar"}</span>
                </button>
              </div>

              {/* Información */}
              <div className="border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Información
                </div>
                <button
                  onClick={() => {
                    loadCallHistory();
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  📞 <span>Historial de llamadas</span>
                </button>
                <button
                  onClick={() => {
                    setShowTraceView(true);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 lg:hidden"
                >
                  🎫 <span>Trazabilidad</span>
                </button>
                <button
                  onClick={() => {
                    openAttachments();
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  📎 <span>Ver adjuntos</span>
                </button>
              </div>

              {/* Workflow - Solo móvil/tablet */}
              <div className="lg:hidden border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Workflow
                </div>
                <button
                  onClick={() => {
                    handleCompleteCycle();
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 md:hidden"
                >
                  ✅ <span>Completar ciclo</span>
                </button>
                
                {/* Selector de estado - Móvil/Tablet */}
                <div className="px-3 py-2">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Estado</label>
                  <select
                    value={conversation.status_id || ""}
                    onChange={(e) => {
                      const newStatusId = Number(e.target.value);
                      const newStatus = statuses.find((s) => s.id === newStatusId);

                      if (newStatus?.required_fields) {
                        try {
                          const fields = Array.isArray(newStatus.required_fields)
                            ? newStatus.required_fields
                            : JSON.parse(newStatus.required_fields);

                          if (Array.isArray(fields) && fields.length > 0) {
                            setStatusChangeModal({ show: true, newStatusId, status: newStatus });
                            e.target.value = conversation.status_id || "";
                            setShowActionsMenu(false);
                            return;
                          }
                        } catch (err) {
                          console.error("Error validando required_fields:", err);
                        }
                      }

                      handleStatusChange(newStatusId, null);
                      setShowActionsMenu(false);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded px-2 py-1.5"
                  >
                    {statuses.filter((s) => !s.is_final).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon} {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector de agente - Móvil/Tablet */}
                <div className="px-3 py-2">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Asignar a</label>
                  <select
                    value={conversation.asignado_a || ""}
                    onChange={(e) => {
                      handleAssignAgent(e.target.value ? Number(e.target.value) : null);
                      setShowActionsMenu(false);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded px-2 py-1.5"
                  >
                    <option value="">Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        👤 {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Herramientas */}
              <div>
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Herramientas
                </div>
                <button
                  onClick={() => {
                    setShowTemplates(true);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  📋 <span>Enviar plantilla</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Búsqueda - Fila separada en móvil, inline en desktop */}
      <div className="w-full md:w-auto md:ml-2 flex items-center gap-1">
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
            if (e.key === "Escape") clearSearch();
          }}
          placeholder="Buscar en chat..."
          className="flex-1 md:w-40 h-10 md:h-8 px-3 md:px-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm md:text-xs outline-none focus:border-emerald-400"
        />
        {searchResults.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-700 dark:text-slate-400 px-2">
              {currentSearchIndex + 1} de {searchResults.length}
            </span>
            <button
              type="button"
              onClick={prevSearchResult}
              title="Anterior (↑)"
              className="h-8 w-8 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={nextSearchResult}
              title="Siguiente (↓)"
              className="h-8 w-8 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={clearSearch}
              title="Cerrar búsqueda (Esc)"
              className="h-8 w-8 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs"
            >
              ✕
            </button>
          </div>
        )}
        {searchResults.length === 0 && searchQ && (
          <button
            type="button"
            onClick={runSearch}
            title="Buscar"
            className="h-8 px-2 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs"
          >
            🔎
          </button>
        )}
      </div>
    </div>
  );
}
