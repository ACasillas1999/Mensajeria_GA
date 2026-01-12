import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL || "";

export default function ChannelMemberManager({
  isOpen,
  onClose,
  channelId,
  currentMembers,
  allUsers,
  onMembersAdded,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedUsers([]);
      setError("");
    }
  }, [isOpen]);

  // Filter users that are not already members
  const currentMemberIds = new Set(currentMembers.map((m) => m.user_id));
  const availableUsers = allUsers.filter((user) => !currentMemberIds.has(user.id));

  const filteredUsers = availableUsers.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (user.nombre || "").toLowerCase().includes(query) ||
      (user.email || "").toLowerCase().includes(query) ||
      (user.sucursal || "").toLowerCase().includes(query)
    );
  });

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (selectedUsers.length === 0) {
      setError("Selecciona al menos un usuario");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${BASE}/api/internal/channels/${channelId}/members`.replace(/\/\//g, "/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_ids: selectedUsers }),
        }
      );

      const data = await response.json();

      if (data.ok) {
        onMembersAdded?.();
        onClose();
      } else {
        setError(data.error || "Error al agregar miembros");
      }
    } catch (err) {
      console.error("Error adding members:", err);
      setError("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Agregar Miembros
          </h3>
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

            {/* Search */}
            <div>
              <label
                htmlFor="search-users"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Buscar usuarios
              </label>
              <input
                id="search-users"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, email o sucursal..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* User List */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Seleccionar usuarios
              </label>
              <div className="max-h-80 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
                {filteredUsers.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {availableUsers.length === 0
                        ? "Todos los usuarios ya son miembros"
                        : "No se encontraron usuarios"}
                    </p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="text-emerald-600 focus:ring-emerald-500 rounded"
                      />
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                            {(user.nombre || "?")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {user.nombre || "Usuario"}
                            </div>
                            {user.sucursal && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {user.sucursal}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {selectedUsers.length > 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {selectedUsers.length} usuario{selectedUsers.length !== 1 ? "s" : ""}{" "}
                  seleccionado{selectedUsers.length !== 1 ? "s" : ""}
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
              disabled={isSubmitting || selectedUsers.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Agregando...
                </>
              ) : (
                "Agregar Miembros"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
