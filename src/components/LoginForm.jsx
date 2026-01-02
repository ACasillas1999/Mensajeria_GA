import { useState } from "react";

const BASE = import.meta.env.BASE_URL || "";

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
      const res = await fetch(`${BASE}/api/login`.replace(/\/\//g, "/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setMensaje("\u00a1Listo! Bienvenido.");
        const url = new URL(window.location.href);
        const next = url.searchParams.get("next") || `${BASE}/`.replace(/\/\//g, "/") || "/";
        setTimeout(() => {
          window.location.href = next || "/";
        }, 500);
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
  const formClass =
    `w-full max-w-md mx-auto p-6 sm:p-7 rounded-2xl transition-all duration-200 text-left
    bg-white/5 backdrop-blur-xl shadow-[0_12px_50px_rgba(0,0,0,0.3)]
    ${hasError ? "animate-shake" : "hover:-translate-y-0.5 hover:shadow-[0_18px_70px_rgba(16,185,129,0.16)]"}`;

  return (
    <form onSubmit={handleSubmit} className={formClass}>
      <div className="mb-6 text-left">
        <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/80 font-semibold">Panel privado</p>
        <h2 className="text-2xl font-semibold text-white mt-1">Iniciar sesión</h2>
        <p className="text-sm text-slate-300/80 mt-2">Usa tus credenciales corporativas para continuar.</p>
      </div>

      <input
        type="email"
        placeholder="Email"
        className="w-full mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none
                   transition-all duration-150 placeholder:text-slate-500
                   focus:ring-2 focus:ring-emerald-300/50 focus:border-emerald-300/60"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Contraseña"
        className="w-full mb-5 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none
                   transition-all duration-150 placeholder:text-slate-500
                   focus:ring-2 focus:ring-emerald-300/50 focus:border-emerald-300/60"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 mt-1 rounded-xl text-slate-950 font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                   bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 hover:brightness-110 shadow-md shadow-emerald-500/25 hover:-translate-y-0.5"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="mt-3 text-xs text-slate-400 text-center">\u00bfProblemas para acceder? Contacta a soporte interno.</p>

      {mensaje && (
        <p className={`mt-4 text-sm text-center px-3 py-2 rounded-lg ${hasError ? "text-red-300 bg-red-500/10 border border-red-500/30" : "text-emerald-200 bg-emerald-500/10 border border-emerald-500/30"}`}>
          {mensaje}
        </p>
      )}
    </form>
  );
}
