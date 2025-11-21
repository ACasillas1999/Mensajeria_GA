import { useState } from "react";
import ConversationsPane from "./ConversationsPane.jsx";
import ChatPane from "./ChatPane.jsx";

const BASE = import.meta.env.BASE_URL || '';

export default function ChatWorkspace({ initialId = null }) {
  const [current, setCurrent] = useState(null); // {id,title,wa_user,...}
  // Preselección por id (ej. /mensajes?conversation_id=123)
  async function preload(id) {
    try {
      const r = await fetch(`${BASE}/api/conversations/${id}`.replace(/\/\//g, '/'));
      const j = await r.json();
      if (j.ok) setCurrent(j.item);
    } catch {}
  }
  if (typeof window !== 'undefined' && initialId && !current) {
    // single-run preload, not in effect hooks to avoid hydration mismatch
    preload(initialId);
  }
  return (
    <section className="grid grid-cols-12 gap-4">
      <aside className="col-span-12 md:col-span-4 lg:col-span-3">
        <ConversationsPane onSelect={setCurrent} />
      </aside>
      <section className="col-span-12 md:col-span-8 lg:col-span-9">
        <ChatPane conversation={current} />
      </section>
    </section>
  );
}
