import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function SalesReport() {
  // Default: primeros del mes actual
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: firstDay, end: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      const res = await fetch(`${BASE}/api/admin/reports/sales?${params}`.replace(/\/\//g, '/'));
      const json = await res.json();
      
      if (json.ok) {
        setData(json);
      } else {
        alert(json.error || 'Error cargando reporte');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []); // Cargar al inicio

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha Inicio</label>
          <input 
            type="date" 
            value={dateRange.start}
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha Fin</label>
          <input 
            type="date" 
            value={dateRange.end}
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>
        <button 
          onClick={loadReport}
          disabled={loading}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? 'Generando...' : '🔍 Generar Reporte'}
        </button>
      </div>

      {data && (
        <>
          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
              <div className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">Ventas Totales</div>
              <div className="text-3xl font-bold">
                ${data.totals.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </div>
            
             <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Ciclos con Venta</div>
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                {data.totals.count}
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Ticket Promedio</div>
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                ${data.totals.count > 0 
                  ? (data.totals.revenue / data.totals.count).toLocaleString('es-MX', { minimumFractionDigits: 2 }) 
                  : '0.00'}
              </div>
            </div>
          </div>

          {/* Tabla por Agente */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Rendimiento por Agente</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Agente</th>
                  <th className="px-4 py-3 text-right">Cant. Ventas</th>
                  <th className="px-4 py-3 text-right">Total Generado</th>
                  <th className="px-4 py-3 text-right ml-auto">% del Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.summary.map((agent, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {agent.name}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                      {agent.count}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ${agent.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {data.totals.revenue > 0 
                        ? ((agent.total / data.totals.revenue) * 100).toFixed(1) + '%' 
                        : '0%'}
                    </td>
                  </tr>
                ))}
                {data.summary.length === 0 && (
                   <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-slate-500 italic">
                      No se encontraron ventas en este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Lista Detallada (Dropdown o scroll) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Detalle de Transacciones</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Agente</th>
                    <th className="px-4 py-3 text-left">Estado Final</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.filter(i => i.has_sale).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                        {new Date(item.completed_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{item.client_name}</span>
                          <span className="text-xs text-slate-500">{item.client_phone}</span>
                          {item.cycle_number > 0 && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Ciclo #{item.cycle_number}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                        {item.agent_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800">
                          {item.status_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        ${item.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
