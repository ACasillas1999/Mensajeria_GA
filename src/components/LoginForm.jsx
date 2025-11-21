import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}/api/login`.replace(/\/\//g, '/'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setMensaje("¡Listo! Bienvenido.");
        const url = new URL(window.location.href);
        const next = url.searchParams.get('next') || `${import.meta.env.BASE_URL}/`;
        setTimeout(() => (window.location.href = next), 500);
      } else {
        setMensaje(`Error: ${data?.error ?? "Usuario o contraseña incorrectos."}`);
      }
    } catch {
      setMensaje("Error: red o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const hasError = mensaje.startsWith("Error:");
  const formClass = `w-80 p-6 rounded-2xl border transition-all duration-300
    bg-slate-900/60 backdrop-blur-md border-slate-700/60 shadow-xl` + (hasError ? ' animate-shake' : '');

  return (
    <form onSubmit={handleSubmit} className={formClass}>
      <h2 className="text-xl font-semibold mb-4">Iniciar sesión</h2>

      <input
        type="email"
        placeholder="Email"
        className="w-full mb-3 p-2 rounded-md bg-slate-900 border border-slate-700/70 outline-none
                   transition-all duration-200 focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Contraseña"
        className="w-full mb-3 p-2 rounded-md bg-slate-900 border border-slate-700/70 outline-none
                   transition-all duration-200 focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 mt-1 rounded-md text-black font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
                   bg-gradient-to-tr from-emerald-500 to-green-400 hover:brightness-110 shadow-lg shadow-emerald-500/20"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      {mensaje && (
        <p className={`mt-4 text-sm ${hasError ? "text-red-400" : "text-green-400"}`}>
          {mensaje}
        </p>
      )}
    </form>
  );
}

