import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

const BASE = import.meta.env.BASE_URL || '';

export default function UsersFlow() {
  const [users, setUsers] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [expanded, setExpanded] = useState(new Set());     // sucursales abiertas
  const [search, setSearch] = useState("");
  const [limitPerBranch, setLimitPerBranch] = useState(12); // “ver más” por sucursal
  const [onlyAgents, setOnlyAgents] = useState(true);

  useEffect(() => {
    (async () => {
      const [u, s] = await Promise.all([
        fetch(`${BASE}/api/admin/users`.replace(/\/\//g, '/')).then(r=>r.json()),
        fetch(`${BASE}/api/admin/sucursales`.replace(/\/\//g, '/')).then(r=>r.json()),
      ]);
      if (u.ok) setUsers(u.items || []);
      if (s.ok) setSucursales(s.items || []);
    })();
  }, []);

  function toggleSucursal(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // util: normaliza búsqueda
  const q = search.trim().toLowerCase();

  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    // raíz
    nodes.push({
      id: "root",
      position: { x: 0, y: 0 },
      data: { label: "Empresa" },
      style: {
        borderRadius: 12, padding: 8, background: "#0f172a",
        color: "#e2e8f0", border: "1px solid #334155", fontWeight: 600
      }
    });

    // indexar agentes por sucursal
    const agentes = users.filter(u => (onlyAgents ? (u.rol === "AGENTE" || u.rol === "GERENTE") : true));

    // filtro por texto
    const matches = (name) => !q || String(name || "").toLowerCase().includes(q);

    // posiciones base
    const yBase = 100;
    const yStep = 180;
    const xBranch = 0;
    const xAgents = 260;
    const xGap = 160; // “columnas” de agentes cuando son varios

    sucursales.forEach((suc, i) => {
      // agentes de esta sucursal (filtrados)
      const listAll = agentes.filter(a => a.sucursal_id === suc.id && matches(a.nombre));
      const count = listAll.length;
      const expandedBranch = expanded.has(suc.id);

      const y = yBase + i * yStep;

      // nodo sucursal (clickeable para expandir)
      nodes.push({
        id: `s-${suc.id}`,
        position: { x: xBranch, y },
        data: { label: `🏢 ${suc.nombre} ${count ? `(${count})` : ""}` },
        style: {
          borderRadius: 12, padding: 10, background:"#111827",
          color:"#e5e7eb", border:"1px solid #374151", cursor: "pointer", fontWeight: 600
        }
      });

      edges.push({ id:`e-root-s-${suc.id}`, source:"root", target:`s-${suc.id}`, animated:false });

      if (!expandedBranch || count === 0) return;

      // paginado por sucursal (limit)
      const list = listAll.slice(0, limitPerBranch);
      list.forEach((u, idx) => {
        const col = Math.floor(idx / 6); // 6 por columna
        const row = idx % 6;
        const x = xAgents + col * xGap;
        const yU = y - 60 + row * 22; // compactar verticalmente

        nodes.push({
          id: `u-${u.id}`,
          position: { x, y: yU },
          data: { label: `👤 ${u.nombre}` },
          style: {
            borderRadius: 8, padding: 6,
            background:"#0b3d2e", color:"#dcfce7", border:"1px solid #14532d"
          }
        });
        edges.push({ id:`e-s-${suc.id}-u-${u.id}`, source:`s-${suc.id}`, target:`u-${u.id}` });
      });

      // “ver más” si hay más de los permitidos
      if (count > limitPerBranch) {
        const x = xAgents + Math.ceil(limitPerBranch / 6) * xGap;
        const yButton = y - 10;
        nodes.push({
          id: `more-${suc.id}`,
          position: { x, y: yButton },
          data: { label: `+ ${count - limitPerBranch} más` },
          style: {
            borderRadius: 8, padding: 6,
            background:"#1f2937", color:"#e5e7eb", border:"1px dashed #475569",
          }
        });
        edges.push({ id:`e-s-${suc.id}-more`, source:`s-${suc.id}`, target:`more-${suc.id}` });
      }
    });

    return { nodes, edges };
  }, [users, sucursales, expanded, q, onlyAgents, limitPerBranch]);

  return (
    <div className="space-y-3">
      {/* barra de controles */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar agente…"
          className="px-3 py-2 rounded bg-slate-900 border border-slate-700"
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyAgents} onChange={e=>setOnlyAgents(e.target.checked)} />
          Solo agentes
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span>Límite por sucursal</span>
          <input type="number" min={6} max={60} step={2}
                 value={limitPerBranch}
                 onChange={e=>setLimitPerBranch(Number(e.target.value || 12))}
                 className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700" />
        </div>
        <div className="ml-auto text-sm text-slate-400">
          Sucursales: {sucursales.length}
        </div>
      </div>

      <div style={{ height: "70vh", background: "#020617", borderRadius: 12, border: "1px solid #0f172a" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          panOnScroll
          zoomOnScroll
          onNodeClick={(_, node) => {
            if (node.id.startsWith("s-")) {
              const id = Number(node.id.slice(2));
              toggleSucursal(id);
            }
            if (node.id.startsWith("more-")) {
              const sid = Number(node.id.slice(5));
              // al hacer clic en “+ más”, simplemente subimos el límite para esa vista
              setLimitPerBranch((n) => n + 12);
              // si quieres granular por sucursal, cambia el estado a un mapa {sucId: limit}
            }
          }}
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background gap={16} />
        </ReactFlow>
      </div>

      <p className="text-xs text-slate-400">
        Tip: haz clic en una sucursal para expandir/colapsar sus agentes. Usa la rueda del mouse para acercar/alejar.
      </p>
    </div>
  );
}
