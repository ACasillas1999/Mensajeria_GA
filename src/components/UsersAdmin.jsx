import { useEffect, useMemo, useState } from "react";
// Importar SweetAlert2 directamente
import Swal from 'sweetalert2';

const BASE = import.meta.env.BASE_URL || '';

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtroRol, setFiltroRol] = useState("");
  const [filtroSuc, setFiltroSuc] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", rol:"ADMIN", sucursal_id:"", telefono: "" });

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
    if (j.ok) { setModal(false); setForm({ nombre:"", email:"", password:"", rol:"AGENTE", sucursal_id:"", telefono:"" }); load(); }
    else alert(j.error || "No se pudo crear");
  }

  async function gestionSucursales() {
    // Generamos HTML para la lista de sucursales
    const sucursalesList = sucursales
      .map(
        (s) => `
      <div class="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
        <span class="text-sm text-slate-700 dark:text-slate-300 font-medium">${s.nombre}</span>
        <div class="flex gap-2">
          <button class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
            onclick="window.editarSucursal(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')">✏️</button>
          <button class="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800" 
            onclick="window.eliminarSucursal(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </div>`
      )
      .join("");

    // Exponer funciones al window para que SweetAlert pueda llamarlas globalmente
    window.editarSucursal = async (id, nombreActual) => {
      const { value: nuevoNombre } = await Swal.fire({
        title: "Editar sucursal",
        input: "text",
        inputValue: nombreActual,
        showCancelButton: true,
        confirmButtonText: "Guardar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#10b981",
        inputValidator: (value) => {
          if (!value || !value.trim()) return "El nombre es requerido";
        },
      });

      if (nuevoNombre && nuevoNombre !== nombreActual) {
        try {
          const r = await fetch(
            `${BASE}/api/admin/sucursales`.replace(/\/\//g, "/"),
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, nombre: nuevoNombre.trim() }),
            }
          );
          const j = await r.json();
          if (j.ok) {
            await Swal.fire({
              icon: "success",
              title: "Actualizado", 
              text: "La sucursal ha sido actualizada",
              timer: 1500,
              showConfirmButton: false
            });
            load(); // Recargar datos
            // Recargar modal
            gestionSucursales();
          } else {
            Swal.fire("Error", j.error || "No se pudo actualizar", "error");
          }
        } catch {
          Swal.fire("Error", "Error de red", "error");
        }
      }
    };

    window.eliminarSucursal = async (id, nombre) => {
      const result = await Swal.fire({
        title: "¿Eliminar sucursal?",
        text: `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });

      if (result.isConfirmed) {
        try {
          const r = await fetch(
            `${BASE}/api/admin/sucursales`.replace(/\/\//g, "/"),
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            }
          );
          const j = await r.json();
          if (j.ok) {
            await Swal.fire({
              icon: "success",
              title: "Eliminado", 
              text: "La sucursal ha sido eliminada",
              timer: 1500,
              showConfirmButton: false
            });
            load();
            gestionSucursales(); // Reabrir modal actualizado
          } else {
            Swal.fire(
              "No se puede eliminar",
              j.error || "Error al eliminar (posiblemente tiene usuarios asignados)",
              "error"
            );
          }
        } catch {
          Swal.fire("Error", "Error de red", "error");
        }
      }
    };

    await Swal.fire({
      title: "Gestión de Sucursales",
      html: `
        <div class="mb-4 text-left">
          <div class="max-h-60 overflow-y-auto mb-4 border rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-inner p-2">
            ${
              sucursalesList ||
              '<p class="p-4 text-sm text-slate-500 text-center italic">No hay sucursales registradas</p>'
            }
          </div>
          <button id="btn-nueva-sucursal" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
            <span class="text-lg">+</span> Nueva Sucursal
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'dark:bg-slate-800 dark:text-slate-100',
        title: 'dark:text-white',
        closeButton: 'dark:text-slate-400 hover:dark:text-slate-200'
      },
      didOpen: () => {
        const btn = Swal.getHtmlContainer().querySelector("#btn-nueva-sucursal");
        if(btn) {
          btn.addEventListener("click", async () => {
            const { value: nombre } = await Swal.fire({
              title: "Nueva sucursal",
              input: "text",
              inputPlaceholder: "Nombre de la sucursal",
              showCancelButton: true,
              confirmButtonText: "Crear",
              cancelButtonText: "Cancelar",
              confirmButtonColor: "#10b981",
              inputValidator: (value) => {
                if (!value || !value.trim()) return "El nombre es requerido";
              },
            });

            if (nombre) {
              try {
                const r = await fetch(
                  `${BASE}/api/admin/sucursales`.replace(/\/\//g, "/"),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nombre: nombre.trim() }),
                  }
                );
                const j = await r.json();
                if (j.ok) {
                  await Swal.fire({
                     icon: "success",
                     title: "Creada",
                     text: "Sucursal creada correctamente",
                     timer: 1500,
                     showConfirmButton: false
                  });
                  await load();
                  setFiltroSuc(String(j.id));
                  gestionSucursales(); // Reabrir modal
                } else {
                  Swal.fire("Error", j.error || "No se pudo crear", "error");
                }
              } catch {
                Swal.fire("Error", "Error de red", "error");
              }
            }
          });
        }
      },
      willClose: () => {
        // Limpiar funciones globales al cerrar
        delete window.editarSucursal;
        delete window.eliminarSucursal;
      }
    });
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
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filtroRol} onChange={e=>setFiltroRol(e.target.value)}
          className="px-3 py-2 rounded bg-white border border-slate-300 text-slate-800 shadow-sm w-full sm:w-auto dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
          <option value="">Todos los roles</option>
          <option value="AGENTE">AGENTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={filtroSuc} onChange={e=>setFiltroSuc(e.target.value)}
          className="px-3 py-2 rounded bg-white border border-slate-300 text-slate-800 shadow-sm w-full sm:w-auto dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
          <option value="">Todas las sucursales</option>
          {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <button
          type="button"
          onClick={gestionSucursales}
          className="px-3 py-2 rounded bg-slate-100 border border-slate-300 text-sm text-slate-800 shadow-sm hover:bg-slate-200 w-full sm:w-auto dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          ⚙️ Sucursales
        </button>
        <button
          onClick={() => setModal(true)}
          className="w-full sm:w-auto sm:ml-auto px-3 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500 shadow-sm"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* tabla */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Rol</th>
              <th className="text-left p-2">Sucursal</th>
              <th className="text-left p-2">Teléfono</th>
              <th className="text-left p-2">Activo</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-600 dark:text-slate-400">Cargando usuarios...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-600 dark:text-slate-400">Sin resultados</td></tr>
            ) : (
              filtrados.map(u => (
                <tr key={u.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="p-2 text-slate-800 dark:text-slate-100">{u.id}</td>
                  <td className="p-2 text-slate-800 dark:text-slate-100">{u.nombre}</td>
                  <td className="p-2 text-slate-800 dark:text-slate-100">{u.email}</td>
                  <td className="p-2">
                    <select value={u.rol} onChange={e=>setRol(u, e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
                      <option value="AGENTE">AGENTE</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select value={u.sucursal_id ?? ""} onChange={e=>setSucursal(u, e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
                      <option value="">(Sin sucursal)</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1 group">
                        {u.telefono ? (
                            <span className="text-sm text-slate-700 dark:text-slate-300">{u.telefono}</span>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Sin teléfono</span>
                        )}
                        <button 
                            onClick={async () => {
                                const { value: tel } = await Swal.fire({
                                    title: 'Editar teléfono',
                                    input: 'text',
                                    inputValue: u.telefono || '',
                                    text: 'Formato internacional (ej: 521...)',
                                    showCancelButton: true
                                });
                                if (tel !== undefined) {
                                    const r = await fetch(`${BASE}/api/admin/users`.replace(/\/\//g, '/'), {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: u.id, telefono: tel })
                                    });
                                    if(r.ok) load(); else Swal.fire('Error', 'No se pudo actualizar', 'error');
                                }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-500"
                            title="Editar teléfono"
                        >
                            ✏️
                        </button>
                    </div>
                  </td>
                  <td className="p-2">
                    <button onClick={()=>toggleActivo(u)}
                      className={`px-2 py-1 rounded text-sm ${u.activo ? "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700" : "bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="p-2 text-right">
                    {/* reset pass rápido */}
                    <details>
                      <summary className="cursor-pointer text-slate-700 dark:text-slate-300">Reset pass</summary>
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
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                        <button className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500">Guardar</button>
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
            <form onSubmit={createUser} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nuevo usuario</h2>
              <input className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                placeholder="Nombre" required
                value={form.nombre} onChange={e=>setForm(f=>({...f, nombre:e.target.value}))} />
              <input className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                placeholder="Email" required type="email"
                value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
              <input className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                placeholder="Contraseña" required minLength={8} type="password"
                value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))} />
              <input className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                placeholder="Teléfono (ej: 521...)" 
                value={form.telefono} onChange={e=>setForm(f=>({...f, telefono:e.target.value}))} />
              <div className="flex gap-2">
                <select className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                  value={form.rol} onChange={e=>setForm(f=>({...f, rol:e.target.value}))}>
                  <option value="AGENTE">AGENTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <select className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                  value={form.sucursal_id}
                  onChange={e=>setForm(f=>({...f, sucursal_id:e.target.value}))}>
                  <option value="">(Sin sucursal)</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setModal(false)} className="px-3 py-2 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                <button className="px-3 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
