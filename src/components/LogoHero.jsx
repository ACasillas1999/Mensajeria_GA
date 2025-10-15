export default function LogoHero() {
  return (
    <section className="mt-4 mb-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-6 grid grid-cols-12 gap-4">
        <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500/10 via-sky-500/10 to-amber-500/10 blur-2xl opacity-0 hover:opacity-100 transition-opacity" />
        <div className="relative col-span-12 md:col-span-8 flex items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-100">Mensajería Web GA</h2>
            <p className="mt-2 text-slate-300 max-w-xl">
              Centraliza tus conversaciones, asigna rápidamente y da seguimiento hasta resolver.
            </p>
            <div className="mt-4 flex gap-2">
              <a href="/mensajes" className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition">
                Ir a Mensajes
              </a>
              <a href="/clientes" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
                Ver Clientes
              </a>
            </div>
          </div>
        </div>
        <div className="relative col-span-12 md:col-span-4 flex items-center justify-center">
          <div className="relative">
            <div className="absolute -inset-6 rounded-full bg-emerald-500/20 blur-2xl" />
            <img src="/logo-gawhats.png" alt="Logo" className="relative w-28 h-28 md:w-36 md:h-36 rounded-xl shadow-lg border border-slate-700 object-contain" />
          </div>
        </div>
      </div>
    </section>
  );
}

