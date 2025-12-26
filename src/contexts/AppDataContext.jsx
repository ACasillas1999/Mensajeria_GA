import { createContext, useContext, useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL || '';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [statuses, setStatuses] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [quickRepliesLoaded, setQuickRepliesLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Cargar estados una sola vez al iniciar la app
  useEffect(() => {
    async function loadStatuses() {
      if (statusesLoaded) return;
      try {
        const r = await fetch(`${BASE}/api/admin/conversation-statuses?active=1`.replace(/\/\//g, '/'));
        const j = await r.json();
        if (j.ok) {
          setStatuses(j.items || []);
          setStatusesLoaded(true);
        }
      } catch (e) {
        console.error('Error loading statuses:', e);
      }
    }
    loadStatuses();
  }, [statusesLoaded]);

  // Cargar respuestas rápidas una sola vez al iniciar la app
  useEffect(() => {
    async function loadQuickReplies() {
      if (quickRepliesLoaded) return;
      try {
        const r = await fetch(`${BASE}/api/quick-replies`.replace(/\/\//g, '/'));
        const j = await r.json();
        if (j.ok && j.items) {
          setQuickReplies(j.items);
          setQuickRepliesLoaded(true);
        }
      } catch (e) {
        console.error('Error loading quick replies:', e);
      }
    }
    loadQuickReplies();
  }, [quickRepliesLoaded]);

  // Función para recargar respuestas rápidas (cuando se crea una nueva)
  const reloadQuickReplies = async () => {
    try {
      const r = await fetch(`${BASE}/api/quick-replies`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok && j.items) {
        setQuickReplies(j.items);
      }
    } catch (e) {
      console.error('Error reloading quick replies:', e);
    }
  };

  // Cargar usuarios una sola vez al iniciar la app
  useEffect(() => {
    async function loadUsers() {
      if (usersLoaded) return;
      try {
        const r = await fetch(`${BASE}/api/admin/users`.replace(/\/\//g, '/'));
        const j = await r.json();
        if (j.ok) {
          setUsers(j.items || []);
          setUsersLoaded(true);
        }
      } catch (e) {
        console.error('Error loading users:', e);
      }
    }
    loadUsers();
  }, [usersLoaded]);

  // Función para recargar estados (cuando se actualiza la configuración)
  const reloadStatuses = async () => {
    try {
      const r = await fetch(`${BASE}/api/admin/conversation-statuses?active=1`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) {
        setStatuses(j.items || []);
      }
    } catch (e) {
      console.error('Error reloading statuses:', e);
    }
  };

  const value = {
    statuses,
    quickReplies,
    users,
    statusesLoaded,
    quickRepliesLoaded,
    usersLoaded,
    reloadQuickReplies,
    reloadStatuses,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
