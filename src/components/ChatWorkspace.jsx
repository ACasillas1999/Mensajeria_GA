import { useEffect, useState, useRef, useMemo } from "react";
import ConversationsPane from "./ConversationsPane.jsx";
import ChatPane from "./ChatPane.jsx";
import { AppDataProvider } from "../contexts/AppDataContext.jsx";

const BASE = import.meta.env.BASE_URL || "";
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;
const INTERNAL_DEFAULT_WIDTH = 340;

const getAppMode = () => {
  if (typeof window === "undefined") return "client";
  return localStorage.getItem("app_mode") || "client";
};

function useAppMode() {
  const [mode, setMode] = useState(getAppMode);

  useEffect(() => {
    const handleModeChange = (event) => {
      if (event?.detail?.mode) {
        setMode(event.detail.mode);
        return;
      }
      if (event?.type === "storage" && event.key && event.key !== "app_mode") {
        return;
      }
      setMode(getAppMode());
    };

    window.addEventListener("app-mode-change", handleModeChange);
    window.addEventListener("storage", handleModeChange);
    return () => {
      window.removeEventListener("app-mode-change", handleModeChange);
      window.removeEventListener("storage", handleModeChange);
    };
  }, []);

  return mode;
}

function statusDotColor(estado) {
  if (estado === true || estado === "online") return "#22c55e";
  if (estado === false || estado === "offline") return "#94a3b8";
  if (!estado) return "#38bdf8";
  const value = String(estado).toLowerCase();
  if (value.includes("ocup")) return "#f59e0b";
  if (value.includes("aus")) return "#ef4444";
  return "#22c55e";
}

function parseInternalDate(value) {
  if (!value) return null;
  const cleaned = String(value).replace(" ", "T");
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatInternalRelative(value) {
  const date = parseInternalDate(value);
  if (!date) return "";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
}

function formatInternalTime(value) {
  const date = parseInternalDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function getAgentPresence(agent) {
  if (!agent) {
    return { label: "Sin actividad", color: statusDotColor("offline") };
  }
  const lastSeen = agent.last_activity_at
    ? parseInternalDate(agent.last_activity_at)
    : null;
  const isOnline =
    Boolean(agent.is_online) ||
    (lastSeen && Date.now() - lastSeen.getTime() <= 5 * 60 * 1000);
  if (isOnline) {
    return { label: "En linea", color: statusDotColor("online") };
  }
  if (lastSeen) {
    const relative = formatInternalRelative(agent.last_activity_at);
    return {
      label: relative ? `Visto hace ${relative}` : "Sin actividad",
      color: statusDotColor("offline"),
    };
  }
  return { label: "Sin actividad", color: statusDotColor("offline") };
}

function InternalMessagesWorkspace() {
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("internalWorkspace_leftWidth");
      return saved ? Number(saved) : INTERNAL_DEFAULT_WIDTH;
    }
    return INTERNAL_DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [agents, setAgents] = useState([]);
  const [channels, setChannels] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [canWrite, setCanWrite] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const lastSeenRef = useRef({
    channels: new Map(),
    dms: new Map(),
    channelsInit: false,
    dmsInit: false,
  });
  const lastOpenRef = useRef({ key: null, lastId: null });

  const allowLocalIncomingToast = () =>
    typeof window === "undefined" || !window.__internalGlobalNotifyActive;

  const pushNotification = ({ title, message }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [...prev.slice(-2), { id, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((note) => note.id !== id));
    }, 4500);
  };

  const cycleFilter = () => {
    setListFilter((prev) => {
      if (prev === "all") return "channels";
      if (prev === "channels") return "directs";
      return "all";
    });
  };

  const handleNewChat = () => {
    setSelectedType(null);
    setSelectedId(null);
    setQuery("");
    if (searchRef.current) {
      searchRef.current.focus();
    }
  };

  const handleResetList = () => {
    setListFilter("all");
    setQuery("");
  };

  const copyText = async (text) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fallback below
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const openContextMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextAction = async (action, item) => {
    if (!item) return;
    switch (action) {
      case "open":
        selectTarget(item.type, item.id);
        break;
      case "pin":
        toggleFavorite(item);
        break;
      case "copy-name":
        await copyText(item.name);
        break;
      case "copy-email":
        await copyText(item.meta?.email);
        break;
      case "copy-channel":
        await copyText(item.name);
        break;
      default:
        break;
    }
    closeContextMenu();
  };

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const r = await fetch(`${BASE}/api/internal/users`.replace(/\/\//g, "/"));
      const j = await r.json();
      if (j.ok) {
        setAgents(j.items || []);
        if (j.currentUserId) {
          setCurrentUserId(j.currentUserId);
        }
        const currentId = j.currentUserId || currentUserId;
        const store = lastSeenRef.current.dms;
        const initialized = lastSeenRef.current.dmsInit;
        (j.items || []).forEach((agent) => {
          if (!agent.last_message_id) return;
          const key = agent.chat_id ? `dm-${agent.chat_id}` : `user-${agent.id}`;
          const prev = store.get(key);
          if (
            initialized &&
            currentId &&
            prev !== agent.last_message_id &&
            agent.last_message_user_id &&
            agent.last_message_user_id !== currentId &&
            allowLocalIncomingToast()
          ) {
            pushNotification({
              title: agent.nombre,
              message: agent.last_message || "Nuevo mensaje interno",
            });
          }
          store.set(key, agent.last_message_id);
        });
        lastSeenRef.current.dmsInit = true;
      }
    } catch (err) {
      console.error("Error loading internal users:", err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const r = await fetch(
        `${BASE}/api/internal/channels`.replace(/\/\//g, "/"),
      );
      const j = await r.json();
      if (j.ok) {
        setChannels(j.items || []);
        if (j.currentUserId) {
          setCurrentUserId(j.currentUserId);
        }
        const currentId = j.currentUserId || currentUserId;
        const store = lastSeenRef.current.channels;
        const initialized = lastSeenRef.current.channelsInit;
        (j.items || []).forEach((channel) => {
          if (!channel.last_message_id) return;
          const prev = store.get(channel.id);
          if (
            initialized &&
            currentId &&
            prev !== channel.last_message_id &&
            channel.last_message_user_id &&
            channel.last_message_user_id !== currentId &&
            allowLocalIncomingToast()
          ) {
            const author = channel.last_message_user_name
              ? `${channel.last_message_user_name}: `
              : "";
            pushNotification({
              title: `#${channel.name}`,
              message: `${author}${channel.last_message || "Nuevo mensaje"}`,
            });
          }
          store.set(channel.id, channel.last_message_id);
        });
        lastSeenRef.current.channelsInit = true;
      }
    } catch (err) {
      console.error("Error loading internal channels:", err);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    loadAgents();
    loadChannels();
  }, []);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) => {
      const name = String(agent.nombre || "").toLowerCase();
      const role = String(agent.rol || "").toLowerCase();
      const area = String(agent.sucursal || "").toLowerCase();
      const email = String(agent.email || "").toLowerCase();
      return (
        name.includes(q) ||
        role.includes(q) ||
        area.includes(q) ||
        email.includes(q)
      );
    });
  }, [agents, query]);

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((channel) => {
      const name = String(channel.name || "").toLowerCase();
      const description = String(channel.description || "").toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [channels, query]);

  const sortByRecent = (a, b) => {
    const da = parseInternalDate(a.time);
    const db = parseInternalDate(b.time);
    if (!da && !db) return a.name.localeCompare(b.name);
    if (!da) return 1;
    if (!db) return -1;
    return db.getTime() - da.getTime();
  };

  const chatItems = useMemo(() => {
    const items = [];
    filteredChannels.forEach((channel) => {
      if (listFilter === "directs") return;
      items.push({
        key: `channel-${channel.id}`,
        type: "channel",
        id: channel.id,
        name: `#${channel.name}`,
        preview: channel.last_message || channel.description || "Canal interno",
        time: channel.last_message_at,
        isFavorite: Boolean(channel.is_favorite),
        meta: channel,
      });
    });
    filteredAgents.forEach((agent) => {
      if (listFilter === "channels") return;
      items.push({
        key: `dm-${agent.id}`,
        type: "dm",
        id: agent.id,
        name: agent.nombre || "Usuario",
        preview: agent.last_message || agent.sucursal || "Sin sucursal",
        time: agent.last_message_at,
        isFavorite: Boolean(agent.is_favorite),
        meta: agent,
        dmChatId: agent.chat_id || null,
      });
    });
    return items.sort(sortByRecent);
  }, [filteredChannels, filteredAgents, listFilter]);

  const pinnedItems = useMemo(
    () => chatItems.filter((item) => item.isFavorite),
    [chatItems],
  );

  const recentItems = useMemo(
    () => chatItems.filter((item) => !item.isFavorite),
    [chatItems],
  );

  useEffect(() => {
    if (
      selectedType === "dm" &&
      selectedId &&
      !agents.some((agent) => agent.id === selectedId)
    ) {
      setSelectedId(null);
      setSelectedType(null);
    }
  }, [agents, selectedId, selectedType]);

  useEffect(() => {
    if (
      selectedType === "channel" &&
      selectedId &&
      !channels.some((channel) => channel.id === selectedId)
    ) {
      setSelectedId(null);
      setSelectedType(null);
    }
  }, [channels, selectedId, selectedType]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("internalWorkspace_leftWidth", String(leftWidth));
    }
  }, [leftWidth]);

  const currentAgent =
    selectedType === "dm"
      ? agents.find((agent) => agent.id === selectedId) || null
      : null;
  const currentChannel =
    selectedType === "channel"
      ? channels.find((channel) => channel.id === selectedId) || null
      : null;

  const fetchMessages = async (type, id, { silent = false } = {}) => {
    if (!type || !id) return;
    if (!silent) setLoadingMessages(true);
    try {
      if (type === "dm") {
        const r = await fetch(
          `${BASE}/api/internal/dm?user_id=${id}`.replace(/\/\//g, "/"),
        );
        const j = await r.json();
        if (j.ok) {
          const items = j.items || [];
          setMessages(items);
          setCurrentChatId(j.chat_id || null);
          setCanWrite(true);
          const resolvedUserId = j.currentUserId || currentUserId;
          if (j.currentUserId) {
            setCurrentUserId(j.currentUserId);
          }
          const lastMessage = items.length ? items[items.length - 1] : null;
          const chatKey = j.chat_id ? `dm-${j.chat_id}` : `user-${id}`;
          const openRef = lastOpenRef.current;
          const agent = agents.find((entry) => entry.id === id);
          let shouldNotify = false;
          if (openRef.key === chatKey) {
            if (
              lastMessage?.id &&
              lastMessage.id !== openRef.lastId &&
              resolvedUserId &&
              lastMessage.user_id !== resolvedUserId
            ) {
              shouldNotify = true;
            }
          }
          lastOpenRef.current = {
            key: chatKey,
            lastId: lastMessage?.id ?? null,
          };
          if (lastMessage?.id) {
            lastSeenRef.current.dms.set(chatKey, lastMessage.id);
          }
          if (shouldNotify && allowLocalIncomingToast()) {
            pushNotification({
              title: agent?.nombre || "Mensaje interno",
              message: lastMessage?.content || "Nuevo mensaje interno",
            });
          }
        }
        return;
      }

      const r = await fetch(
        `${BASE}/api/internal/channel?channel_id=${id}`.replace(/\/\//g, "/"),
      );
      const j = await r.json();
      if (j.ok) {
        const items = j.items || [];
        setMessages(items);
        setCurrentChatId(null);
        setCanWrite(Boolean(j.can_write));
        const resolvedUserId = j.currentUserId || currentUserId;
        if (j.currentUserId) {
          setCurrentUserId(j.currentUserId);
        }
        const lastMessage = items.length ? items[items.length - 1] : null;
        const openRef = lastOpenRef.current;
        const channel = channels.find((entry) => entry.id === id);
        let shouldNotify = false;
        if (openRef.key === `channel-${id}`) {
          if (
            lastMessage?.id &&
            lastMessage.id !== openRef.lastId &&
            resolvedUserId &&
            lastMessage.user_id !== resolvedUserId
          ) {
            shouldNotify = true;
          }
        }
        lastOpenRef.current = {
          key: `channel-${id}`,
          lastId: lastMessage?.id ?? null,
        };
        if (lastMessage?.id) {
          lastSeenRef.current.channels.set(id, lastMessage.id);
        }
        if (shouldNotify && allowLocalIncomingToast()) {
          const author = lastMessage?.sender_name
            ? `${lastMessage.sender_name}: `
            : "";
          pushNotification({
            title: channel?.name ? `#${channel.name}` : "Canal interno",
            message: `${author}${lastMessage?.content || "Nuevo mensaje"}`,
          });
        }
      }
    } catch (err) {
      console.error("Error loading internal messages:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedId || !selectedType) {
      setMessages([]);
      setCurrentChatId(null);
      setCanWrite(true);
      setDraft("");
      lastOpenRef.current = { key: null, lastId: null };
      return;
    }

    fetchMessages(selectedType, selectedId);
    setDraft("");

    const intervalId = setInterval(() => {
      fetchMessages(selectedType, selectedId, { silent: true });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [selectedId, selectedType]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadAgents();
      loadChannels();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      closeContextMenu();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") closeContextMenu();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("contextmenu", handleClick);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("contextmenu", handleClick);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu || !menuRef.current || typeof window === "undefined") {
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let nextX = contextMenu.x;
    let nextY = contextMenu.y;
    if (nextX + rect.width + padding > window.innerWidth) {
      nextX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (nextY + rect.height + padding > window.innerHeight) {
      nextY = Math.max(padding, window.innerHeight - rect.height - padding);
    }
    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((prev) =>
        prev ? { ...prev, x: nextX, y: nextY } : prev,
      );
    }
  }, [contextMenu]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedId || !selectedType || sending) return;
    if (selectedType === "channel" && !canWrite) return;
    setSending(true);
    try {
      if (selectedType === "dm") {
        const payload = currentChatId
          ? { chat_id: currentChatId, content: draft.trim() }
          : { user_id: selectedId, content: draft.trim() };
        const r = await fetch(`${BASE}/api/internal/dm`.replace(/\/\//g, "/"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (j.ok) {
          setCurrentChatId(j.chat_id || currentChatId);
          if (j.message) {
            setMessages((prev) => [...prev, j.message]);
          }
          setDraft("");
          loadAgents();
        }
        return;
      }

      const r = await fetch(`${BASE}/api/internal/channel`.replace(/\/\//g, "/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: selectedId, content: draft.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        if (j.message) {
          setMessages((prev) => [...prev, j.message]);
        }
        setDraft("");
        loadChannels();
      }
    } catch (err) {
      console.error("Error sending internal message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleMouseDown = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = event.clientX - containerRect.left;

      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleBackToList = () => {
    setSelectedId(null);
    setSelectedType(null);
  };

  const selectTarget = (type, id) => {
    setSelectedType(type);
    setSelectedId(id);
  };

  const toggleFavorite = async (item) => {
    if (item.type === "dm" && !item.dmChatId) {
      pushNotification({
        title: "Anclar chat",
        message: "Inicia un chat para poder anclarlo.",
      });
      return;
    }
    const nextValue = !item.isFavorite;
    try {
      const payload =
        item.type === "channel"
          ? { type: "channel", channel_id: item.id, favorite: nextValue }
          : { type: "dm", dm_chat_id: item.dmChatId, favorite: nextValue };
      const r = await fetch(
        `${BASE}/api/internal/favorites`.replace(/\/\//g, "/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const j = await r.json();
      if (!j.ok) return;
      if (item.type === "channel") {
        setChannels((prev) =>
          prev.map((channel) =>
            channel.id === item.id
              ? { ...channel, is_favorite: nextValue ? 1 : 0 }
              : channel,
          ),
        );
      } else {
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === item.id
              ? { ...agent, is_favorite: nextValue ? 1 : 0 }
              : agent,
          ),
        );
      }
    } catch (err) {
      console.error("Error updating favorites:", err);
    }
  };

  const isChannelSelected = selectedType === "channel";
  const headerTitle = isChannelSelected
    ? currentChannel
      ? `#${currentChannel.name}`
      : "Selecciona un canal o agente"
    : currentAgent
      ? currentAgent.nombre
      : "Selecciona un canal o agente";
  const headerSubtitle = isChannelSelected
    ? currentChannel?.description || "Canal interno"
    : currentAgent
      ? `${currentAgent.rol || "AGENTE"} - ${currentAgent.sucursal || "Sin sucursal"}`
      : "Directorio interno";
  const headerPill = isChannelSelected
    ? currentChannel
      ? currentChannel.type === "private"
        ? "Privado"
        : "Publico"
      : null
    : currentAgent
      ? currentAgent.rol || "AGENTE"
      : null;
  const inputPlaceholder = !selectedType
    ? "Selecciona un canal o agente..."
    : isChannelSelected
      ? canWrite
        ? currentChannel?.name
          ? `Mensaje a #${currentChannel.name}`
          : "Escribe un mensaje al canal..."
        : "Canal de solo lectura"
      : "Escribe un mensaje interno...";
  const inputDisabled =
    !selectedType ||
    !selectedId ||
    sending ||
    (isChannelSelected && !canWrite);
  const sendDisabled = inputDisabled || !draft.trim();
  const filterLabel =
    listFilter === "channels"
      ? "Canales"
      : listFilter === "directs"
        ? "Directos"
        : "Todos";

  const renderChatItem = (item) => {
    const isChannel = item.type === "channel";
    const isSelected = selectedType === item.type && selectedId === item.id;
    const timeLabel = item.time ? formatInternalRelative(item.time) : "";
    const presence = !isChannel ? getAgentPresence(item.meta) : null;
    const canFavorite = isChannel ? true : Boolean(item.dmChatId);
    return (
      <button
        key={item.key}
        onClick={() => selectTarget(item.type, item.id)}
        onContextMenu={(event) => openContextMenu(event, item)}
        className={`internal-list-item ${isSelected ? "is-active" : ""}`}
      >
        <div className={`internal-avatar${isChannel ? " channel" : ""}`}>
          {isChannel
            ? "#"
            : String(item.name || "U").trim()[0]?.toUpperCase() || "U"}
        </div>
        <div className="internal-item-body">
          <div className="internal-item-title-row">
            <div className="internal-item-title">
              <span className="internal-item-name">{item.name}</span>
              {isChannel && item.meta?.type === "private" && (
                <span className="internal-tag">Privado</span>
              )}
            </div>
            <div className="internal-item-meta">
              {timeLabel && (
                <span className="internal-item-time">{timeLabel}</span>
              )}
              <button
                type="button"
                className={`internal-fav-btn ${
                  item.isFavorite ? "is-active" : ""
                } ${!canFavorite ? "is-disabled" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(item);
                }}
                title={
                  canFavorite
                    ? item.isFavorite
                      ? "Quitar anclado"
                      : "Anclar chat"
                    : "Inicia un chat para anclar"
                }
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M10 3.5l1.9 3.8 4.2.6-3 3 0.7 4.3-3.8-2-3.8 2 0.7-4.3-3-3 4.2-.6L10 3.5z"
                    fill={item.isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="internal-item-preview">{item.preview}</div>
          {!isChannel && presence?.label && (
            <div className="internal-item-status">{presence.label}</div>
          )}
        </div>
        {!isChannel && (
          <span
            className="internal-status-dot"
            style={{
              backgroundColor: presence?.color || statusDotColor("offline"),
            }}
            title={presence?.label || "Sin actividad"}
          ></span>
        )}
      </button>
    );
  };

  const directoryPane = (
    <div className="h-full internal-directory rounded-xl border overflow-hidden">
      <div className="internal-directory-header">
        <div className="internal-directory-title">
          <span>Chat</span>
          <button
            type="button"
            className="internal-icon-button internal-icon-button-sm"
            aria-label="Restablecer filtros"
            title="Restablecer filtros"
            onClick={handleResetList}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 7l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="internal-directory-actions">
          <button
            type="button"
            className="internal-icon-button internal-icon-button-sm"
            aria-label="Filtrar chats"
            title={`Filtro: ${filterLabel}`}
            onClick={cycleFilter}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 6h14M6 10h8M8 14h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="internal-icon-button internal-icon-button-sm"
            aria-label="Nuevo chat"
            title="Nuevo chat"
            onClick={handleNewChat}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="internal-directory-search">
        <svg className="internal-search-icon" viewBox="0 0 20 20" fill="none">
          <circle
            cx="9"
            cy="9"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M14 14l3 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en chats internos"
          className="internal-input internal-search-input text-xs rounded-lg"
        />
        <div className="internal-filter-label">Filtro: {filterLabel}</div>
      </div>
      <div className="internal-directory-scroll thin-scroll">
        <div className="internal-section-title">
          <span>Anclados</span>
          <span className="internal-section-count">{pinnedItems.length}</span>
        </div>
        {(loadingChannels || loadingAgents) && (
          <div className="internal-empty text-xs internal-muted">
            Cargando chats...
          </div>
        )}
        {!loadingChannels && !loadingAgents && pinnedItems.length === 0 && (
          <div className="internal-empty text-xs internal-muted">
            Sin anclados.
          </div>
        )}
        {pinnedItems.map(renderChatItem)}

        <div className="internal-section-title">
          <span>Recientes</span>
          <span className="internal-section-count">{recentItems.length}</span>
        </div>
        {!loadingChannels && !loadingAgents && recentItems.length === 0 && (
          <div className="internal-empty text-xs internal-muted">
            Sin chats recientes.
          </div>
        )}
        {recentItems.map(renderChatItem)}
      </div>
    </div>
  );

  const renderChatPane = ({ paddingClass, showBack }) => (
    <div className="h-full flex flex-col internal-surface rounded-xl border overflow-hidden">
      <div className="internal-panel border-b px-3 py-2 flex items-center gap-2">
        {showBack && (
          <button
            onClick={handleBackToList}
            className="internal-icon-button"
            title="Volver a directorio"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{headerTitle}</div>
          <div className="text-[11px] internal-muted truncate">
            {headerSubtitle}
          </div>
        </div>
        {headerPill && (
          <span className="internal-pill text-[10px]">{headerPill}</span>
        )}
      </div>
      <div
        className={`flex-1 overflow-y-auto internal-chat-body ${paddingClass} space-y-3`}
      >
        {!selectedType && (
          <div className="text-sm internal-muted">
            Selecciona un canal o agente del directorio para iniciar chat.
          </div>
        )}
        {selectedType && loadingMessages && (
          <div className="text-xs internal-muted">Cargando mensajes...</div>
        )}
        {selectedType && !loadingMessages && messages.length === 0 && (
          <div className="text-sm internal-muted">
            Aun no hay mensajes en esta conversacion.
          </div>
        )}
        {selectedType &&
          messages.map((msg) => {
            const isMe = currentUserId && msg.user_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`internal-message ${isMe ? "me" : "them"}`}
              >
                {isChannelSelected && !isMe && msg.sender_name && (
                  <div className="text-[10px] uppercase tracking-wide internal-muted mb-1">
                    {msg.sender_name}
                  </div>
                )}
                <div className="text-xs leading-relaxed">{msg.content}</div>
                <div className="text-[10px] internal-muted mt-1 text-right">
                  {formatInternalTime(msg.created_at)}
                </div>
              </div>
            );
          })}
        {isChannelSelected && selectedType && !canWrite && (
          <div className="text-xs internal-muted">
            Este canal es de solo lectura para tu rol.
          </div>
        )}
      </div>
      <div className="border-t internal-divider px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
            placeholder={inputPlaceholder}
            className="flex-1 internal-input text-xs px-3 py-2 rounded-lg"
            disabled={inputDisabled}
          />
          <button
            onClick={handleSend}
            className="internal-send"
            disabled={sendDisabled}
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section ref={containerRef} className="flex gap-0 h-full relative">
      <aside
        className={`md:hidden w-full h-full ${selectedId ? "hidden" : "block"}`}
      >
        {directoryPane}
      </aside>

      <section
        className={`md:hidden w-full h-full ${selectedId ? "block" : "hidden"}`}
      >
        {renderChatPane({ paddingClass: "p-4", showBack: true })}
      </section>

      <aside
        style={{ width: `${leftWidth}px` }}
        className="hidden md:block flex-shrink-0 h-full"
      >
        {directoryPane}
      </aside>

      <div
        onMouseDown={handleMouseDown}
        className={`hidden md:block w-1 cursor-col-resize transition-colors flex-shrink-0 select-none ${
          isDragging ? "internal-divider-bg" : "internal-divider-muted"
        }`}
        title="Arrastra para redimensionar"
      />

      <section className="hidden md:block flex-1 min-w-0 h-full">
        {renderChatPane({ paddingClass: "p-6", showBack: false })}
      </section>
      <div className="internal-toast-container">
        {notifications.map((note) => (
          <div key={note.id} className="internal-toast">
            <div className="internal-toast-title">{note.title}</div>
            <div className="internal-toast-body">{note.message}</div>
          </div>
        ))}
      </div>
      {contextMenu && (
        <div
          ref={menuRef}
          className="internal-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <button
            type="button"
            className="internal-context-item"
            onClick={() => handleContextAction("open", contextMenu.item)}
          >
            Abrir chat
          </button>
          <button
            type="button"
            className={`internal-context-item ${
              contextMenu.item.type === "dm" && !contextMenu.item.dmChatId
                ? "is-disabled"
                : ""
            }`}
            onClick={() => handleContextAction("pin", contextMenu.item)}
            disabled={
              contextMenu.item.type === "dm" && !contextMenu.item.dmChatId
            }
          >
            {contextMenu.item.isFavorite ? "Desanclar" : "Anclar"}
          </button>
          <div className="internal-context-divider" />
          <button
            type="button"
            className="internal-context-item"
            onClick={() => handleContextAction("copy-name", contextMenu.item)}
          >
            Copiar nombre
          </button>
          {contextMenu.item.type === "dm" && contextMenu.item.meta?.email && (
            <button
              type="button"
              className="internal-context-item"
              onClick={() => handleContextAction("copy-email", contextMenu.item)}
            >
              Copiar correo
            </button>
          )}
          {contextMenu.item.type === "channel" && (
            <button
              type="button"
              className="internal-context-item"
              onClick={() =>
                handleContextAction("copy-channel", contextMenu.item)
              }
            >
              Copiar canal
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ClientMessagesWorkspace({ initialId = null }) {
  const [current, setCurrent] = useState(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chatWorkspace_leftWidth");
      return saved ? Number(saved) : DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!initialId || current) return;
    let canceled = false;
    async function preload(id) {
      try {
        const r = await fetch(
          `${BASE}/api/conversations/${id}`.replace(/\/\//g, "/"),
        );
        const j = await r.json();
        if (!canceled && j.ok) {
          setCurrent(j.item);
        }
      } catch (err) {
        console.error("Error cargando conversacion:", err);
      }
    }
    preload(initialId);
    return () => {
      canceled = true;
    };
  }, [initialId, current]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chatWorkspace_leftWidth", String(leftWidth));
    }
  }, [leftWidth]);

  const handleMouseDown = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = event.clientX - containerRect.left;

      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const currentId = current?.id || initialId || null;

  const handleBackToList = () => {
    setCurrent(null);
  };

  return (
    <section ref={containerRef} className="flex gap-0 h-full relative">
      <aside
        className={`md:hidden w-full h-full ${current ? "hidden" : "block"}`}
      >
        <ConversationsPane onSelect={setCurrent} currentId={currentId} />
      </aside>

      <section
        className={`md:hidden w-full h-full ${current ? "block" : "hidden"}`}
      >
        {current && (
          <div className="h-full flex flex-col">
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
              <div className="font-medium truncate">
                {current.title || `Chat ${current.id}`}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPane conversation={current} />
            </div>
          </div>
        )}
      </section>

      <aside
        style={{ width: `${leftWidth}px` }}
        className="hidden md:block flex-shrink-0 h-full"
      >
        <ConversationsPane onSelect={setCurrent} currentId={currentId} />
      </aside>

      <div
        onMouseDown={handleMouseDown}
        className={`hidden md:block w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors flex-shrink-0 select-none ${
          isDragging ? "bg-emerald-500" : "bg-slate-700/30"
        }`}
        title="Arrastra para redimensionar"
      />

      <section className="hidden md:block flex-1 min-w-0 h-full">
        <ChatPane conversation={current} />
      </section>
    </section>
  );
}

function ChatWorkspaceInner({ initialId = null }) {
  const mode = useAppMode();
  if (mode === "internal") {
    return <InternalMessagesWorkspace />;
  }
  return <ClientMessagesWorkspace initialId={initialId} />;
}

export default function ChatWorkspace({ initialId = null }) {
  return (
    <AppDataProvider>
      <ChatWorkspaceInner initialId={initialId} />
    </AppDataProvider>
  );
}
