const icons = {
  inbox: (
    <>
      <path d="M4 4h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M4 9h4l2 3h4l2-3h4" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  settings: (
    <>
      <path d="M12 3c2.5 0 2.5 2 5 2s2.5-2 5-2" />
      <path d="M12 3c-2.5 0-2.5 2-5 2S4.5 3 2 3" />
      <path d="M12 21c2.5 0 2.5-2 5-2s2.5 2 5 2" />
      <path d="M12 21c-2.5 0-2.5-2-5-2s-2.5 2-5 2" />
      <path d="M12 8v8" />
    </>
  ),
  pipeline: (
    <>
      <rect x="3" y="4" width="6" height="16" rx="2" />
      <rect x="15" y="4" width="6" height="16" rx="2" />
      <path d="M9 12h6" />
    </>
  ),
  bot: (
    <>
      <rect x="7" y="4" width="10" height="12" rx="2" />
      <path d="M12 16v4" />
      <path d="M9 2v2" />
      <path d="M15 2v2" />
      <circle cx="10" cy="9" r="1" />
      <circle cx="14" cy="9" r="1" />
      <path d="M8 16h8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="m3 17 9-14 9 14Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4" />
      <path d="M13 16V7" />
      <path d="M19 16v-7" />
    </>
  ),
  template: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M4 9h16" />
    </>
  )
};

function Icon({ name, className = "" }) {
  const icon = icons[name] || icons.chart;
  return (
    <svg
      className={`w-5 h-5 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

const tones = {
  emerald: {
    border: "hover:border-emerald-500/40",
    glow: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/40"
  },
  blue: {
    border: "hover:border-sky-500/40",
    glow: "from-sky-500/10 via-sky-500/5 to-transparent",
    icon: "text-sky-400",
    iconBg: "bg-sky-500/10 border-sky-500/40"
  },
  amber: {
    border: "hover:border-amber-500/40",
    glow: "from-amber-500/10 via-amber-500/5 to-transparent",
    icon: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/40"
  },
  purple: {
    border: "hover:border-purple-500/40",
    glow: "from-purple-500/10 via-purple-500/5 to-transparent",
    icon: "text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/40"
  }
};

export default function MagicBento({ isAdmin = false }) {
  const Tile = ({
    href,
    title,
    subtitle,
    desc,
    icon,
    tone = "emerald",
    badge,
    className = ""
  }) => {
    const accent = tones[tone] || tones.emerald;

    const handleMouseEnter = () => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      link.as = "document";
      if (!document.querySelector(`link[href="${href}"]`)) {
        document.head.appendChild(link);
      }
    };

    return (
      <a
        href={href}
        onMouseEnter={handleMouseEnter}
        className={`group relative h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 transition duration-200 ${accent.border} ${className}`}
      >
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${accent.glow}`}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
        <div className="relative h-full p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
              {subtitle}
            </div>
            {badge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px]">
                {badge}
              </span>
            )}
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xl font-semibold text-slate-100">
                {title}
              </div>
              {desc && <div className="text-sm text-slate-400 mt-1">{desc}</div>}
            </div>
            <div
              className={`rounded-xl p-3 border ${accent.iconBg} transition-transform group-hover:scale-105`}
            >
              <Icon name={icon} className={accent.icon} />
            </div>
          </div>
        </div>
      </a>
    );
  };

  return (
    <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 auto-rows-[150px] md:auto-rows-[170px] xl:auto-rows-[180px]">
      <Tile
        href="/mensajes"
        title="Mensajes"
        subtitle="Inbox prioritario"
        desc="Centraliza conversaciones, asignaciones y notas internas."
        icon="inbox"
        tone="emerald"
        badge="En vivo"
        className="sm:col-span-2 xl:col-span-8 xl:row-span-2 min-h-[200px]"
      />

      <Tile
        href="/dashboard"
        title="Dashboard"
        subtitle="Rendimiento y metricas"
        desc="Respuestas, estados y actividad diaria."
        icon="chart"
        tone="blue"
        className="sm:col-span-2 xl:col-span-4 xl:row-span-2 min-h-[200px]"
      />

      <Tile
        href="/clientes"
        title="Clientes"
        subtitle="Listado y busqueda"
        desc="Perfiles, tags y detalles de contacto."
        icon="users"
        tone="purple"
        className="col-span-1 sm:col-span-2 xl:col-span-3"
      />

      <Tile
        href="/pipeline"
        title="Pipeline"
        subtitle="Embudo y etapas"
        desc="Arrastra oportunidades y define prioridades."
        icon="pipeline"
        tone="amber"
        className="col-span-1 sm:col-span-2 xl:col-span-3"
      />

      <Tile
        href="/plantillas"
        title="Plantillas"
        subtitle="Respuestas rapidas"
        desc="Gestiona mensajes listos para el equipo."
        icon="template"
        tone="blue"
        className="col-span-1 sm:col-span-2 xl:col-span-3"
      />

      <Tile
        href="/config"
        title="Configuracion"
        subtitle="Preferencias"
        desc="Horarios, integraciones y ajustes."
        icon="settings"
        tone="emerald"
        className="col-span-1 sm:col-span-2 xl:col-span-3"
      />

      {isAdmin && (
        <>
          <Tile
            href="/admin/asignacion"
            title="Asignacion"
            subtitle="Distribucion"
            desc="Reparte conversaciones entre agentes."
            icon="users"
            tone="emerald"
            className="col-span-1 sm:col-span-2 xl:col-span-3"
          />
          <Tile
            href="/admin/usuarios"
            title="Usuarios"
            subtitle="Equipo"
            desc="Roles, accesos y altas."
            icon="users"
            tone="purple"
            className="col-span-1 sm:col-span-2 xl:col-span-3"
          />
          <Tile
            href="/admin/auto-respuestas"
            title="Auto-respuestas"
            subtitle="Bot"
            desc="Reglas, triggers y mensajes del bot."
            icon="bot"
            tone="amber"
            className="col-span-1 sm:col-span-2 xl:col-span-3"
          />
          <Tile
            href="/admin/mensajes-no-reconocidos"
            title="No reconocidos"
            subtitle="Pendientes"
            desc="Frases que requieren entrenamiento."
            icon="alert"
            tone="blue"
            className="col-span-1 sm:col-span-2 xl:col-span-3"
          />
        </>
      )}
    </section>
  );
}
