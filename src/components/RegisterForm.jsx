import { useState } from "react";

const BASE = import.meta.env.BASE_URL || '';

export default function RegisterForm() {
  const [f, setF] = useState({
    email: "", nombre: "", password: "", confirmar: "", rol: "AGENTE",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const onChange = (e) => setF({ ...f, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setMsg("");

    if ((f.password || "").length < 8) {
      setMsg("⚠️ La contraseña es demasiado corta. Debe tener al menos 8 caracteres.");
      setLoading(false);
      return;
    }
    if (f.password !== f.confirmar) {
      setMsg("⚠️ Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(`${BASE}/api/register`.replace(/\/\//g, '/'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "No se pudo registrar");
      setMsg("✅ Usuario creado (ID " + j.id + ")");
      // opcional: limpiar
      // setF({ email:"", nombre:"", password:"", confirmar:"", rol:"AGENTE" });
    } catch (err) {
      setMsg("❌ " + (err?.message || "Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="bg-gray-800/60 backdrop-blur p-6 rounded-2xl w-full max-w-md border border-gray-700">
      <h2 className="text-xl font-semibold mb-4">Registrar usuario</h2>

      <div className="grid gap-3">
        <input name="email" type="email" value={f.email} onChange={onChange}
               placeholder="Email" required
               className="p-2 rounded bg-gray-900 border border-gray-700 focus:border-green-400 outline-none"/>
        <input name="nombre" value={f.nombre} onChange={onChange}
               placeholder="Nombre completo" required
               className="p-2 rounded bg-gray-900 border border-gray-700 focus:border-green-400 outline-none"/>

        <div className="grid sm:grid-cols-2 gap-3">
          <input
            name="password"
            type="password"
            value={f.password}
            onChange={onChange}
            placeholder="Contraseña"
            required
            minLength={8}
            title="Mínimo 8 caracteres"
            className="p-2 rounded bg-gray-900 border border-gray-700 focus:border-green-400 outline-none"
          />
          <input
            name="confirmar"
            type="password"
            value={f.confirmar}
            onChange={onChange}
            placeholder="Confirmar contraseña"
            required
            minLength={8}
            className="p-2 rounded bg-gray-900 border border-gray-700 focus:border-green-400 outline-none"
          />
        </div>

        <select name="rol" value={f.rol} onChange={onChange}
                className="p-2 rounded bg-gray-900 border border-gray-700 focus:border-green-400 outline-none">
          <option value="AGENTE">AGENTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <button disabled={loading}
                className="w-full py-2 rounded bg-green-500 hover:bg-green-400 text-black font-semibold disabled:opacity-60">
          {loading ? "Guardando..." : "Crear usuario"}
        </button>
      </div>

      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </form>
  );
}
