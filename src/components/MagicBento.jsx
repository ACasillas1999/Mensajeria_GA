function Icon({ name, className = "" }) {
  return <i data-feather={name} className={`w-5 h-5 ${className}`} aria-hidden="true" />;
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
  useEffect(() => {
    // Render Feather icons once hydrated
    if (typeof window !== "undefined") {
      window.feather?.replace();
    }
  }, []);

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
        className={`group relative h-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 transition duration-200 ${accent.border} ${className}`}
      >
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${accent.glow}`}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
        <div className="relative h-full p-4 flex flex-col gap-2.5">
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
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl border ${accent.iconBg} grid place-items-center shrink-0`}>
              <Icon name={icon} className={accent.icon} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold text-slate-100 leading-tight truncate">
                {title}
              </div>
              {desc && <div className="text-sm text-slate-400 mt-1 line-clamp-2">{desc}</div>}
            </div>
          </div>
        </div>
      </a>
    );
  };

  return (
    <section
      className="mt-2 grid grid-flow-dense gap-4 auto-rows-[1fr]"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
    >
      <Tile
        href="/mensajes"
        title="Mensajes"
        subtitle="Inbox prioritario"
        desc="Centraliza conversaciones, asignaciones y notas internas."
        icon="message-square"
        tone="emerald"
        badge="En vivo"
        className="md:col-span-2 lg:col-span-3"
      />

      <Tile
        href="/dashboard"
        title="Dashboard"
        subtitle="Rendimiento y metricas"
        desc="Respuestas, estados y actividad diaria."
        icon="bar-chart-2"
        tone="blue"
        className="md:col-span-2"
      />

      <Tile
        href="/clientes"
        title="Clientes"
        subtitle="Listado y busqueda"
        desc="Perfiles, tags y detalles de contacto."
        icon="users"
        tone="purple"
      />

      <Tile
        href="/pipeline"
        title="Pipeline"
        subtitle="Embudo y etapas"
        desc="Arrastra oportunidades y define prioridades."
        icon="trello"
        tone="amber"
        className="md:col-span-2"
      />

      <Tile
        href="/plantillas"
        title="Plantillas"
        subtitle="Respuestas rapidas"
        desc="Gestiona mensajes listos para el equipo."
        icon="file-plus"
        tone="blue"
      />

      <Tile
        href="/config"
        title="Configuracion"
        subtitle="Preferencias"
        desc="Horarios, integraciones y ajustes."
        icon="settings"
        tone="emerald"
        className="md:col-span-2"
      />

      {isAdmin && (
        <>
          <Tile
            href="/admin/asignacion"
            title="Asignacion"
            subtitle="Distribucion"
            desc="Reparte conversaciones entre agentes."
            icon="share-2"
            tone="emerald"
            className="md:col-span-2"
          />
          <Tile
            href="/admin/usuarios"
            title="Usuarios"
            subtitle="Equipo"
            desc="Roles, accesos y altas."
            icon="user-check"
            tone="purple"
          />
          <Tile
            href="/admin/auto-respuestas"
            title="Auto-respuestas"
            subtitle="Bot"
            desc="Reglas, triggers y mensajes del bot."
            icon="cpu"
            tone="amber"
          />
          <Tile
            href="/admin/mensajes-no-reconocidos"
            title="No reconocidos"
            subtitle="Pendientes"
            desc="Frases que requieren entrenamiento."
            icon="help-circle"
            tone="blue"
          />
        </>
      )}

      <Tile
        href="/mensajes?filter=sin-resolver"
        title="Pendientes"
        subtitle="Prioridad"
        desc="Ver conversaciones sin resolver"
        icon="activity"
        tone="emerald"
      />

      <Tile
        href="/plantillas"
        title="Plantillas"
        subtitle="Rápidas"
        desc="Crear o editar respuesta rápida"
        icon="file-plus"
        tone="blue"
      />

      <Tile
        href="/admin/auto-respuestas"
        title="Auto-respuestas"
        subtitle="Bot"
        desc="Configurar reglas del bot"
        icon="cpu"
        tone="amber"
      />

      <Tile
        href="/dashboard"
        title="Métricas"
        subtitle="Rendimiento"
        desc="Ir al dashboard de rendimiento"
        icon="bar-chart-2"
        tone="purple"
      />
    </section>
  );
}
import { useEffect } from "react";
