import { useState } from 'react';
import Swal from 'sweetalert2';

const BASE = import.meta.env.BASE_URL || '';

export default function QuotationModal({ conversacionId, mensajeId, archivoUrl, onSave, onCancel }) {
    const [numeroCotizacion, setNumeroCotizacion] = useState('');
    const [monto, setMonto] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSave() {
        if (!numeroCotizacion.trim()) {
            Swal.fire('Error', 'El número de cotización es requerido', 'error');
            return;
        }

        if (!monto || parseFloat(monto) <= 0) {
            Swal.fire('Error', 'El monto debe ser mayor a 0', 'error');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${BASE}/api/quotations/create`.replace(/\/\//g, '/'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversacion_id: conversacionId,
                    numero_cotizacion: numeroCotizacion.trim(),
                    monto: parseFloat(monto),
                    mensaje_id: mensajeId,
                    archivo_url: archivoUrl
                })
            });

            const data = await res.json();

            if (data.ok) {
                Swal.fire('Éxito', 'Cotización guardada correctamente', 'success');
                onSave(data.quotation);
            } else {
                Swal.fire('Error', data.error || 'Error al guardar cotización', 'error');
            }
        } catch (err) {
            console.error('Error saving quotation:', err);
            Swal.fire('Error', 'Error al guardar cotización', 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    📄 Registrar Cotización
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Número de Cotización *
                        </label>
                        <input
                            type="text"
                            value={numeroCotizacion}
                            onChange={(e) => setNumeroCotizacion(e.target.value)}
                            placeholder="Ej: COT-2024-001"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Monto (MXN) *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            placeholder="Ej: 15000.00"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? '⏳ Guardando...' : '💾 Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
