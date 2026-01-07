import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const BASE = import.meta.env.BASE_URL || '';

export default function SLASettings() {
  const [config, setConfig] = useState({
    unanswered_threshold_minutes: 15,
    grace_period_minutes: 120,
    notify_unassigned_json: [],
    template_name: 'plantilla_test',
    active: false
  });
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Cargar configuracion
      const resConfig = await fetch(`${BASE}/api/admin/sla-settings`.replace(/\/\//g, '/'));
      const jsonConfig = await resConfig.json();
      
      // Cargar usuarios admins (para notificar)
      const resUsers = await fetch(`${BASE}/api/admin/users?rol=ADMIN`.replace(/\/\//g, '/'));
      const jsonUsers = await resUsers.json();

      if (jsonConfig.ok) {
        setConfig({
            ...jsonConfig.settings,
            active: !!jsonConfig.settings.active
        });
      }
      
      if (jsonUsers.ok) {
        setUsers(jsonUsers.items);
      }
      
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo cargar la configuración', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
        const res = await fetch(`${BASE}/api/admin/sla-settings`.replace(/\/\//g, '/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const json = await res.json();
        
        if (json.ok) {
            Swal.fire('Guardado', 'Configuración actualizada', 'success');
        } else {
            Swal.fire('Error', json.error || 'No se pudo guardar', 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Error de red', 'error');
    }
  }

  const toggleUser = (userId) => {
    const current = config.notify_unassigned_json || [];
    let next;
    if (current.includes(userId)) {
        next = current.filter(id => id !== userId);
    } else {
        next = [...current, userId];
    }
    setConfig({ ...config, notify_unassigned_json: next });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🚨</span> Alertas SLA (Nivel de Servicio)
           </h2>
           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configura cuándo y a quién notificar si un cliente espera demasiado.</p>
        </div>
        <div className="flex items-center gap-3">
            <button
                onClick={async () => {
                    const r = await Swal.fire({
                        title: 'Probando configuración...',
                        text: 'Ejecutando chequeo de SLA manual. Por favor espera.',
                        didOpen: async () => {
                            Swal.showLoading();
                            try {
                                const res = await fetch(`${BASE}/api/admin/sla-check`.replace(/\/\//g, '/'), { method: 'POST' });
                                const json = await res.json();
                                let htmlLogs = `<div class="text-left text-xs font-mono bg-slate-900 text-green-400 p-2 rounded max-h-60 overflow-y-auto">`;
                                htmlLogs += (json.logs || []).map(l => `<div>${l}</div>`).join('');
                                htmlLogs += `</div>`;
                                
                                Swal.fire({
                                    title: json.ok ? 'Chequeo completado' : 'Error en chequeo',
                                    html: htmlLogs,
                                    icon: json.ok ? 'success' : 'error',
                                    width: '600px'
                                });
                            } catch (e) {
                                Swal.fire('Error', 'Falló la petición al servidor', 'error');
                            }
                        }
                    });
                }}
                className="px-3 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 font-medium text-sm transition-colors"
            >
                ▶️ Probar ahora
            </button>

            <button 
                onClick={() => setConfig({...config, active: !config.active})}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${config.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
            >
                <div className={`w-3 h-3 rounded-full ${config.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                {config.active ? 'Monitoreo ACTIVO' : 'Monitoreo PAUSADO'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Tiempos */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                ⏱️ Tiempos de Respuesta
            </h3>
            
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Umbral de "No Respondido" (minutos)</label>
                <div className="flex items-center gap-3">
                    <input 
                        type="number" 
                        min="1"
                        value={config.unanswered_threshold_minutes}
                        onChange={e => setConfig({...config, unanswered_threshold_minutes: Number(e.target.value)})}
                        className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold text-lg"
                    />
                    <span className="text-sm text-slate-500">minutos sin respuesta del agente</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Si un cliente habla y nadie responde en este tiempo, se enviará alerta.</p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                 <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Periodo de Gracia post-cierre (minutos)</label>
                 <div className="flex items-center gap-3">
                    <input 
                        type="number" 
                        min="0"
                        value={config.grace_period_minutes}
                        onChange={e => setConfig({...config, grace_period_minutes: Number(e.target.value)})}
                        className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold text-lg"
                    />
                    <span className="text-sm text-slate-500">minutos sin molestar</span>
                </div>
                 <p className="text-xs text-slate-400 dark:text-slate-500">Si se cerró un ciclo hace poco, ignorar mensajes nuevos por un rato (ej. "Gracias").</p>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                 <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre de Plantilla WhatsApp</label>
                 <div className="flex items-center gap-3">
                    <input 
                        type="text" 
                        value={config.template_name || ''}
                        onChange={e => setConfig({...config, template_name: e.target.value})}
                        placeholder="ej: alerta_sla"
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-sm"
                    />
                </div>
                 <p className="text-xs text-slate-400 dark:text-slate-500">Debe ser una plantilla aprobada en Meta (Language: es_MX).</p>
            </div>
        </div>
        </div>

        {/* Notificaciones */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                🔔 A quién notificar
            </h3>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm mb-2">
                <p>⚠️ Si la conversación tiene agente asignado, <b>se le notificará primero a él</b> (si tiene teléfono registrado).</p>
            </div>

            <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">
                    Si NO hay agente asignado, notificar a estos Admins:
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                    {users.map(u => (
                        <label key={u.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={(config.notify_unassigned_json || []).includes(u.id)}
                                    onChange={() => toggleUser(u.id)}
                                    disabled={!u.telefono}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                    <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{u.nombre}</div>
                                    <div className="text-xs text-slate-500">{u.email}</div>
                                </div>
                            </div>
                            {u.telefono ? (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">📱 {u.telefono}</span>
                            ) : (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Sin teléfono</span>
                            )}
                        </label>
                    ))}
                    {users.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No hay administradores.</p>}
                </div>
                <div className="text-right mt-2">
                     <a href="/admin/usuarios" className="text-xs text-blue-600 hover:underline">Gestionar teléfonos de usuarios &rarr;</a>
                </div>
            </div>
        </div>

      </div>

      <div className="flex justify-end pt-4">
        <button 
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
        >
            💾 Guardar Configuración
        </button>
      </div>

    </div>
  );
}
