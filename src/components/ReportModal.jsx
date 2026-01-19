import { useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

export default function ReportModal({ dateRange, customStartDate, customEndDate, onClose }) {
  const [reportType, setReportType] = useState('agents'); // agents, sales, conversations
  const [format, setFormat] = useState('excel'); // excel, csv
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      // Build date filter params
      const params = new URLSearchParams();
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.set('startDate', customStartDate);
        params.set('endDate', customEndDate);
      } else {
        params.set('days', dateRange);
      }

      // Fetch data from API
      const url = `${BASE}/api/reports/data?reportType=${reportType}&${params.toString()}`.replace(/\/\//g, '/');
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Error obteniendo datos del reporte');
      }

      const { ok, data, headers: dataHeaders } = await response.json();
      
      if (!ok || !data) {
        throw new Error('No se pudieron obtener los datos');
      }

      // Generate file based on format
      if (format === 'excel') {
        await generateExcel(data, dataHeaders, reportType);
      } else {
        generateCSV(data, dataHeaders, reportType);
      }

      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte. Por favor intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  }

  async function generateExcel(data, headers, type) {
    const ExcelJSImport = await import('exceljs');
    const ExcelJS = ExcelJSImport.default ?? ExcelJSImport;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mensajeria';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Reporte');

    // Add headers
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FF1E293B' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    headerRow.height = 20;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data
    data.forEach((row, index) => {
      const dataRow = sheet.addRow(row);
      if (index % 2 === 1) {
        dataRow.eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        });
      }
    });

    // Auto-fit columns
    sheet.columns.forEach((column, idx) => {
      let maxLength = headers[idx]?.length || 10;
      column.eachCell({ includeEmpty: false }, cell => {
        const length = cell.value ? String(cell.value).length : 0;
        if (length > maxLength) maxLength = length;
      });
      column.width = Math.min(maxLength + 3, 50);
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(`reporte_${type}_${Date.now()}.xlsx`, blob);
  }

  function generateCSV(data, headers, type) {
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const escaped = row.map(cell => {
        const str = String(cell || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(escaped.join(','));
    });

    const csv = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(`reporte_${type}_${Date.now()}.csv`, blob);
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const reportTypes = [
    {
      id: 'agents',
      title: 'Por Agente',
      description: 'Rendimiento individual: cotizaciones, ventas, monto cotizado',
      icon: '👥',
    },
    {
      id: 'sales',
      title: 'Por Ventas',
      description: 'Detalle de cotizaciones y ventas con montos y estados',
      icon: '💰',
    },
    {
      id: 'conversations',
      title: 'Por Conversaciones',
      description: 'Actividad general: mensajes, duración, estados',
      icon: '💬',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            📥 Descargar Reporte
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Selecciona el tipo de reporte y formato de descarga
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Tipo de Reporte
            </label>
            <div className="space-y-2">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setReportType(type.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    reportType === type.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 dark:text-white">
                        {type.title}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {type.description}
                      </div>
                    </div>
                    {reportType === type.id && (
                      <div className="text-emerald-500 dark:text-emerald-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Formato
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat('excel')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  format === 'excel'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="font-semibold text-slate-800 dark:text-white">Excel</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">.xlsx</div>
                </div>
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  format === 'csv'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">📄</div>
                  <div className="font-semibold text-slate-800 dark:text-white">CSV</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">.csv</div>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Info */}
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <strong>Período:</strong>{' '}
              {dateRange === 'custom' && customStartDate && customEndDate
                ? `${customStartDate} a ${customEndDate}`
                : `Últimos ${dateRange} días`}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Generar Reporte
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
