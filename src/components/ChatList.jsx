import { useEffect, useState } from 'react'

const BASE = import.meta.env.BASE_URL || '';

export default function ChatList({ onSelect }) {
  const [items, setItems] = useState([])

  async function load() {
    const r = await fetch(`${BASE}/api/conversations`.replace(/\/\//g, '/'))
    const j = await r.json()
    setItems(j.items || j)
  }

  // carga inicial
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // refresco periódico para que la bandeja se actualice sola
  useEffect(() => {
    const id = setInterval(() => {
      load()
    }, 5000) // cada 5 segundos
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      {items.map(c=>(
        <button key={c.id} className="w-full text-left px-4 py-3 border-b hover:bg-gray-50"
          onClick={()=>onSelect(c)}>
          <div className="font-semibold">{c.wa_profile_name || c.wa_user}</div>
          <div className="text-sm text-gray-500 line-clamp-1">{c.ultimo_msg}</div>
        </button>
      ))}
    </div>
  )
}
