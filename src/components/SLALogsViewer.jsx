import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function SLALogsViewer() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState('');
    const limit = 50;

    useEffect(() => {
        loadLogs();
    }, [page]);

    async function loadLogs() {
        try {
            setLoading(true);
            const offset = page * limit;
            const url = `${BASE}/api/admin/sla-logs?limit=${limit}&offset=${offset}`.replace(/\/\//g, '/');
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.ok) {
                setLogs(data.logs || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error('Error cargando logs:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredLogs = logs.filter(log => {
        if (!filter) return true;
        const searchStr = filter.toLowerCase();
        return (
            log.destinatario_nombre?.toLowerCase().includes(searchStr) ||
            log.destinatario_telefono?.includes(searchStr) ||
            log.conversacion_id?.toString().includes(searchStr) ||
            log.wa_profile_name?.toLowerCase().includes(searchStr)
        );
    });

    const totalPages = Math.ceil(total / limit);

    if (loading && logs.length === 0) {
        return <div className="text-center py-8 text-slate-500">Cargando historial...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        📊 Historial de Notificaciones SLA
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Registro de todas las notificaciones enviadas por el sistema SLA
                    </p>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                    Total: <span className="font-bold">{total}</span> notificaciones
                </div>
            </div>

            {/* Filtro */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <input
                    type="text"
                    placeholder="🔍 Buscar por nombre, teléfono, conversación..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
            </div>

            {/* Tabla */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Fecha/Hora</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Conv.</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Destinatario</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Plantilla</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Variables</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                                        {filter ? 'No se encontraron resultados' : 'No hay notificaciones registradas'}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {new Date(log.created_at).toLocaleString('es-MX', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <a 
                                                href={`/?conv=${log.conversacion_id}`}
                                                className="text-blue-600 hover:underline font-mono"
                                            >
                                                #{log.conversacion_id}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {log.wa_profile_name || log.wa_user || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">
                                                {log.destinatario_nombre}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono">
                                                {log.destinatario_telefono}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
                                            {log.template_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {log.variables ? (
                                                <details className="cursor-pointer">
                                                    <summary className="text-blue-600 hover:underline text-xs">
                                                        Ver ({JSON.parse(log.variables).length})
                                                    </summary>
                                                    <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
                                                        {JSON.parse(log.variables).map((v, i) => (
                                                            <div key={i}>
                                                                <span className="text-slate-500">{'{{' + (i+1) + '}}'}</span> → {v}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            ) : (
                                                <span className="text-slate-400 text-xs">Sin variables</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {log.enviado_exitosamente ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-medium">
                                                    ✅ Enviado
                                                </span>
                                            ) : (
                                                <div>
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-medium">
                                                        ❌ Error
                                                    </span>
                                                    {log.error_mensaje && (
                                                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                            {log.error_mensaje}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        ← Anterior
                    </button>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                        Página {page + 1} de {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        Siguiente →
                    </button>
                </div>
            )}
        </div>
    );
}
