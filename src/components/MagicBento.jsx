export default function MagicBento({ isAdmin = false }) {
  const Tile = ({ href, title, subtitle, className = "", icon = null }) => (
    <a href={href}
       className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 hover:bg-slate-900/60 transition group ${className}`}>
      <div className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-tr from-emerald-500/10 via-sky-500/10 to-amber-500/10 blur-2xl" />
      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="text-sm text-slate-400">{subtitle}</div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-xl font-semibold text-slate-100 drop-shadow">{title}</div>
          {icon}
        </div>
      </div>
    </a>
  );

  return (
    <section className="mt-6 grid grid-cols-12 gap-3 auto-rows-[120px] md:auto-rows-[150px]">
      <Tile
        href="/mensajes"
        title="Mensajes"
        subtitle="Ir al inbox"
        className="col-span-12 md:col-span-8 row-span-2"
        icon={<span className="text-2xl">💬</span>}
      />

      <Tile
        href="/clientes"
        title="Clientes"
        subtitle="Listado y búsqueda"
        className="col-span-6 md:col-span-4"
        icon={<span className="text-2xl">👥</span>}
      />

      <Tile
        href="/config"
        title="Configuración"
        subtitle="Preferencias"
        className="col-span-6 md:col-span-4"
        icon={<span className="text-2xl">⚙️</span>}
      />

            {isAdmin && (
        <>
          <Tile
            href="/admin/asignacion"
            title="Asignación"
            subtitle="Distribuir conversaciones"
            className="col-span-6 md:col-span-4"
            icon={<span className="text-2xl">📤</span>}
          />
          <Tile
            href="/admin/usuarios"
            title="Usuarios"
            subtitle="Gestión del equipo"
            className="col-span-6 md:col-span-4"
            icon={<span className="text-2xl">👥</span>}
          />
          <Tile
            href="/admin/auto-respuestas"
            title="Auto-respuestas"
            subtitle="Reglas y respuestas del bot"
            className="col-span-6 md:col-span-4"
            icon={<span className="text-2xl">🤖</span>}
          />
          <Tile
            href="/admin/mensajes-no-reconocidos"
            title="Mensajes no reconocidos"
            subtitle="Frases que el bot no entiende"
            className="col-span-6 md:col-span-4"
            icon={<span className="text-2xl">❓</span>}
          />
        </>
      )}

    </section>
  );
}

