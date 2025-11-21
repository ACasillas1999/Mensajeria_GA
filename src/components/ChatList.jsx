import { useEffect, useState } from 'react'

const BASE = import.meta.env.BASE_URL || '';

export default function ChatList({ onSelect }) {
  const [items, setItems] = useState([])
  useEffect(()=>{ fetch(`${BASE}/api/conversations`.replace(/\/\//g, '/')).then(r=>r.json()).then(setItems) },[])
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
