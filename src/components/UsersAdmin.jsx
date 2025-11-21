import { useEffect, useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || '';

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtroRol, setFiltroRol] = useState("");
  const [filtroSuc, setFiltroSuc] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", rol:"ADMIN", sucursal_id:"" });

  async function load() {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        fetch(`${BASE}/api/admin/users?rol=${filtroRol}&sucursal_id=${filtroSuc}`.replace(/\/\//g, '/')).then(r=>r.json()),
        fetch(`${BASE}/api/admin/sucursales`.replace(/\/\//g, '/')).then(r=>r.json()),
      ]);
      if (u.ok) setUsers(u.items || []);
      if (s.ok) setSucursales(s.items || []);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [filtroRol, filtroSuc]);

  async function createUser(e){
    e.preventDefault();
    const payload = {
      ...form,
      sucursal_id: form.sucursal_id ? Number(form.sucursal_id) : null
    };
    const r = await fetch(`${BASE}/api/admin/users`.replace(/\/\//g, '/'), {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j.ok) { setModal(false); setForm({ nombre:"", email:"", password:"", rol:"AGENTE", sucursal_id:"" }); load(); }
    else alert(j.error || "No se pudo crear");
  }

  async function toggleActivo(u){
    const r = await fetch(`${BASE}/api/admin/users/${u.id}`.replace(/\/\//g, '/'), {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ activo: !u.activo })
    });
    const j = await r.json();
    if (j.ok) load(); else alert("No se pudo actualizar");
  }

  async function setSucursal(u, sucursal_id){
    const r = await fetch(`${BASE}/api/admin/users/${u.id}`.replace(/\/\//g, '/'), {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ sucursal_id: sucursal_id ? Number(sucursal_id) : null })
    });
    const j = await r.json();
    if (j.ok) load(); else alert("No se pudo actualizar");
  }

  async function setRol(u, rol){
    const r = await fetch(`${BASE}/api/admin/users/${u.id}`.replace(/\/\//g, '/'), {
      method: "PATCH",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ rol })
    });
    const j = await r.json();
    if (j.ok) load(); else alert("No se pudo actualizar");
  }

  const filtrados = useMemo(()=>users, [users]);

  return (
    <div className="space-y-4">
      {/* filtros */}
      <div className="flex flex-wrap gap-2">
        <select value={filtroRol} onChange={e=>setFiltroRol(e.target.value)}
          className="px-3 py-2 rounded bg-slate-900 border border-slate-700">
          <option value="">Todos los roles</option>
          <option value="AGENTE">AGENTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={filtroSuc} onChange={e=>setFiltroSuc(e.target.value)}
          className="px-3 py-2 rounded bg-slate-900 border border-slate-700">
          <option value="">Todas las sucursales</option>
          {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <button
          onClick={() => setModal(true)}
          className="ml-auto px-3 py-2 rounded bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* tabla */}
      <div className="overflow-x-auto border border-slate-800 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Rol</th>
              <th className="text-left p-2">Sucursal</th>
              <th className="text-left p-2">Activo</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-400">Cargando…</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin resultados</td></tr>
            ) : (
              filtrados.map(u => (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="p-2">{u.id}</td>
                  <td className="p-2">{u.nombre}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select value={u.rol} onChange={e=>setRol(u, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1">
                      <option value="AGENTE">AGENTE</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select value={u.sucursal_id ?? ""} onChange={e=>setSucursal(u, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1">
                      <option value="">(Sin sucursal)</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <button onClick={()=>toggleActivo(u)}
                      className={`px-2 py-1 rounded ${u.activo ? "bg-emerald-600/20 border border-emerald-700" : "bg-slate-800 border border-slate-700"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="p-2 text-right">
                    {/* reset pass rápido */}
                    <details>
                      <summary className="cursor-pointer text-slate-300">Reset pass</summary>
                      <form className="mt-1 flex gap-2 items-center"
                        onSubmit={async (e)=>{
                          e.preventDefault();
                          const pw = e.target.elements.pw.value;
                          if (!pw || pw.length < 8) return alert("Mínimo 8 caracteres");
                          const r = await fetch(`${BASE}/api/admin/users/${u.id}`.replace(/\/\//g, '/'), {
                            method: "PATCH",
                            headers: { "Content-Type":"application/json" },
                            body: JSON.stringify({ new_password: pw })
                          });
                          const j = await r.json();
                          if (j.ok) alert("Contraseña actualizada");
                          else alert("No se pudo actualizar");
                          e.target.reset();
                        }}>
                        <input name="pw" type="password" placeholder="Nueva contraseña"
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1" />
                        <button className="px-2 py-1 rounded bg-emerald-500 text-black">Guardar</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* modal crear */}
      {modal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setModal(false)} />
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <form onSubmit={createUser} className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-full max-w-lg space-y-3">
              <h2 className="text-lg font-semibold">Nuevo usuario</h2>
              <input className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2"
                placeholder="Nombre" required
                value={form.nombre} onChange={e=>setForm(f=>({...f, nombre:e.target.value}))} />
              <input className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2"
                placeholder="Email" required type="email"
                value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
              <input className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2"
                placeholder="Contraseña" required minLength={8} type="password"
                value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))} />
              <div className="flex gap-2">
                <select className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2"
                  value={form.rol} onChange={e=>setForm(f=>({...f, rol:e.target.value}))}>
                  <option value="AGENTE">AGENTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <select className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2"
                  value={form.sucursal_id}
                  onChange={e=>setForm(f=>({...f, sucursal_id:e.target.value}))}>
                  <option value="">(Sin sucursal)</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setModal(false)} className="px-3 py-2 rounded bg-slate-800">Cancelar</button>
                <button className="px-3 py-2 rounded bg-emerald-500 text-black font-semibold">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
