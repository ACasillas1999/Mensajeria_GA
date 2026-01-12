import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL || "";

export default function ChannelCreationModal({ isOpen, onClose, onSuccess, agents, currentUserId }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("public");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setType("public");
      setSelectedMembers([]);
      setSearchQuery("");
      setError("");
    }
  }, [isOpen]);

  const filteredAgents = agents.filter((agent) => {
    if (agent.id === currentUserId) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (agent.nombre || "").toLowerCase().includes(query) ||
      (agent.sucursal || "").toLowerCase().includes(query)
    );
  });

  const toggleMember = (agentId) => {
    setSelectedMembers((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre del canal es requerido");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${BASE}/api/internal/channels`.replace(/\/\//g, "/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          member_ids: selectedMembers,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        onSuccess(data.channel);
        onClose();
      } else {
        setError(data.error || "Error al crear el canal");
      }
    } catch (err) {
      console.error("Error creating channel:", err);
      setError("Error de conexión al crear el canal");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Crear Nuevo Canal
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Channel Name */}
            <div>
              <label
                htmlFor="channel-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Nombre del canal <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-medium">
                  #
                </span>
                <input
                  id="channel-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="nombre-del-canal"
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Solo letras, números y guiones. Se convertirá a minúsculas automáticamente.
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="channel-description"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Descripción
              </label>
              <textarea
                id="channel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿De qué trata este canal?"
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
              />
            </div>

            {/* Channel Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tipo de canal
              </label>
              <div className="space-y-2">
                <label className="flex items-start p-3 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <input
                    type="radio"
                    name="channel-type"
                    value="public"
                    checked={type === "public"}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="ml-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                      </svg>
                      <span className="font-medium text-slate-900 dark:text-white">Público</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Todos los usuarios pueden ver y unirse a este canal
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <input
                    type="radio"
                    name="channel-type"
                    value="private"
                    checked={type === "private"}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="ml-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-slate-900 dark:text-white">Privado</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Solo miembros invitados pueden ver este canal
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Members Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Agregar miembros
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar usuarios..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all mb-2"
              />
              <div className="max-h-48 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
                {filteredAgents.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                    No se encontraron usuarios
                  </div>
                ) : (
                  filteredAgents.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(agent.id)}
                        onChange={() => toggleMember(agent.id)}
                        className="text-emerald-600 focus:ring-emerald-500 rounded"
                      />
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {agent.nombre || "Usuario"}
                        </div>
                        {agent.sucursal && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {agent.sucursal}
                          </div>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
              {selectedMembers.length > 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {selectedMembers.length} miembro{selectedMembers.length !== 1 ? "s" : ""} seleccionado{selectedMembers.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creando...
                </>
              ) : (
                "Crear Canal"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
