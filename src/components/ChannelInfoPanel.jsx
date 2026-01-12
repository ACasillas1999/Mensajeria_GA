import { useState, useEffect } from "react";
import ChannelMemberManager from "./ChannelMemberManager.jsx";
import ChannelSettingsModal from "./ChannelSettingsModal.jsx";

const BASE = import.meta.env.BASE_URL || "";

const ROLE_LABELS = {
  owner: { label: "Creador", icon: "👑", color: "text-amber-600 dark:text-amber-400" },
  admin: { label: "Admin", icon: "🛡️", color: "text-blue-600 dark:text-blue-400" },
  member: { label: "Miembro", icon: "👤", color: "text-slate-600 dark:text-slate-400" },
  readonly: { label: "Solo lectura", icon: "👁️", color: "text-slate-500 dark:text-slate-500" },
};

export default function ChannelInfoPanel({
  isOpen,
  onClose,
  channelId,
  currentUserId,
  onChannelUpdated,
  onChannelDeleted,
}) {
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(null);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && channelId) {
      loadChannelInfo();
    }
  }, [isOpen, channelId]);

  const loadChannelInfo = async () => {
    setLoading(true);
    setError("");
    try {
      const [channelResponse, usersResponse] = await Promise.all([
        fetch(`${BASE}/api/internal/channels/${channelId}`.replace(/\/\//g, "/")),
        fetch(`${BASE}/api/internal/users`.replace(/\/\//g, "/"))
      ]);
      
      const channelData = await channelResponse.json();
      const usersData = await usersResponse.json();

      if (channelData.ok) {
        setChannel(channelData.channel);
        setMembers(channelData.members || []);
      } else {
        setError(channelData.error || "Error al cargar información del canal");
      }
      
      if (usersData.ok) {
        setAllUsers(usersData.items || []);
      }
    } catch (err) {
      console.error("Error loading channel info:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm("¿Estás seguro de remover a este miembro?")) return;

    try {
      const response = await fetch(
        `${BASE}/api/internal/channels/${channelId}/members/${userId}`.replace(/\/\//g, "/"),
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.ok) {
        await loadChannelInfo();
      } else {
        alert(data.error || "Error al remover miembro");
      }
    } catch (err) {
      console.error("Error removing member:", err);
      alert("Error de conexión");
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const response = await fetch(
        `${BASE}/api/internal/channels/${channelId}/members/${userId}`.replace(/\/\//g, "/"),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      const data = await response.json();

      if (data.ok) {
        await loadChannelInfo();
      } else {
        alert(data.error || "Error al cambiar rol");
      }
    } catch (err) {
      console.error("Error changing role:", err);
      alert("Error de conexión");
    }
  };

  const handleLeaveChannel = async () => {
    if (!confirm("¿Estás seguro de salir de este canal?")) return;

    try {
      const response = await fetch(
        `${BASE}/api/internal/channels/${channelId}/members/${currentUserId}`.replace(/\/\//g, "/"),
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.ok) {
        onChannelDeleted?.();
        onClose();
      } else {
        alert(data.error || "Error al salir del canal");
      }
    } catch (err) {
      console.error("Error leaving channel:", err);
      alert("Error de conexión");
    }
  };

  if (!isOpen) return null;

  const userRole = channel?.user_role;
  const canManage = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (member.nombre || "").toLowerCase().includes(query) ||
      (member.email || "").toLowerCase().includes(query) ||
      (member.sucursal || "").toLowerCase().includes(query)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 h-full w-full max-w-md shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              #{channel?.name || "Canal"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {channel?.type === "private" ? "🔒 Privado" : "🌐 Público"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : error ? (
            <div className="px-6 py-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Description */}
              {channel?.description && (
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    📝 Descripción
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {channel.description}
                  </p>
                </div>
              )}

              {/* Info */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  ℹ️ Información
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Creado por:</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {channel?.creator_name || "Desconocido"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Fecha:</span>
                    <span className="text-slate-900 dark:text-white">
                      {channel?.created_at
                        ? new Date(channel.created_at).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                  {userRole && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tu rol:</span>
                      <span className={`font-medium ${ROLE_LABELS[userRole]?.color}`}>
                        {ROLE_LABELS[userRole]?.icon} {ROLE_LABELS[userRole]?.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Members */}
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    👥 Miembros ({members.length})
                  </h3>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setShowAddMembers(true)}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                    >
                      + Agregar
                    </button>
                  )}
                </div>

                {/* Search */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar miembros..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all mb-3"
                />

                {/* Member List */}
                <div className="space-y-2">
                  {filteredMembers.map((member) => {
                    const roleInfo = ROLE_LABELS[member.role] || ROLE_LABELS.member;
                    const isSelf = member.user_id === currentUserId;

                    return (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium">
                            {(member.nombre || "?")[0].toUpperCase()}
                          </div>
                          {member.is_online === 1 && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {member.nombre || "Usuario"}
                            </span>
                            {isSelf && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">(tú)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${roleInfo.color}`}>
                              {roleInfo.icon} {roleInfo.label}
                            </span>
                            {member.sucursal && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                • {member.sucursal}
                              </span>
                            )}
                          </div>
                        </div>

                        {canManage && member.role !== "owner" && !isSelf && (
                          <div className="flex items-center gap-1">
                            {isOwner && (
                              <select
                                value={member.role}
                                onChange={(e) => handleChangeRole(member.user_id, e.target.value)}
                                className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="admin">Admin</option>
                                <option value="member">Miembro</option>
                                <option value="readonly">Solo lectura</option>
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Remover"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && !error && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
            {canManage && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="w-full px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                ⚙️ Configuración del canal
              </button>
            )}
            {!isOwner && (
              <button
                type="button"
                onClick={handleLeaveChannel}
                className="w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                🚪 Salir del canal
              </button>
            )}
          </div>
        )}
      </div>

      <ChannelMemberManager
        isOpen={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        channelId={channelId}
        currentMembers={members}
        allUsers={allUsers}
        onMembersAdded={() => {
          loadChannelInfo();
          setShowAddMembers(false);
        }}
      />

      <ChannelSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        channel={channel}
        userRole={channel?.user_role}
        onChannelUpdated={() => {
          loadChannelInfo();
          onChannelUpdated?.();
          setShowSettings(false);
        }}
        onChannelDeleted={() => {
          onChannelDeleted?.();
          setShowSettings(false);
        }}
      />
    </div>
  );
}
