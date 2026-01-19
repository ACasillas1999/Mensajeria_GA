import type { APIRoute } from "astro";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../lib/db";

/**
 * API para generar reportes personalizables
 * GET /api/reports/generate
 */
export const GET: APIRoute = async ({ locals, url }) => {
    try {
        const user = (locals as any).user as { id: number; rol: string } | undefined;
        if (!user) {
            return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
        }

        const reportType = url.searchParams.get('reportType') || 'agents';
        const format = url.searchParams.get('format') || 'csv';
        const days = url.searchParams.get('days') || '30';
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        // Build date filter
        let dateFilter = `>= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`;
        if (startDate && endDate) {
            dateFilter = `BETWEEN '${startDate}' AND '${endDate}'`;
        }

        let data: any[] = [];
        let headers: string[] = [];
        let filename = `reporte_${reportType}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;

        // Generate report based on type
        if (reportType === 'agents') {
            headers = ['Agente', 'Cotizaciones Enviadas', 'Ventas Cerradas', 'Monto Cotizado', 'Ciclos Completados', 'Mensajes Enviados'];

            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT
          u.nombre AS agent_name,
          COUNT(DISTINCT q.id) AS quotations_sent,
          COUNT(DISTINCT CASE WHEN cc.cycle_data IS NOT NULL AND JSON_EXTRACT(cc.cycle_data, '$.monto') IS NOT NULL THEN cc.id END) AS sales_closed,
          (
            SELECT COALESCE(SUM(q_amount.amount), 0)
            FROM conversation_cycles cc_amount
            LEFT JOIN quotations q_amount ON q_amount.cycle_id = cc_amount.id
            WHERE cc_amount.assigned_to = u.id
              AND cc_amount.completed_at ${dateFilter}
          ) AS quotation_amount,
          COUNT(DISTINCT cc.id) AS cycles_completed,
          COUNT(m.id) AS messages_sent
        FROM usuarios u
        LEFT JOIN conversaciones c ON c.asignado_a = u.id AND c.creado_en ${dateFilter}
        LEFT JOIN mensajes m ON m.usuario_id = u.id AND m.from_me = 1 AND m.creado_en ${dateFilter}
        LEFT JOIN conversation_cycles cc ON cc.assigned_to = u.id AND cc.completed_at ${dateFilter}
        LEFT JOIN quotations q ON q.cycle_id = cc.id
        WHERE u.activo = 1 AND u.rol = 'AGENTE'
        GROUP BY u.id, u.nombre
        ORDER BY quotations_sent DESC`
            );

            data = rows.map(r => ([
                r.agent_name,
                r.quotations_sent,
                r.sales_closed,
                r.quotation_amount,
                r.cycles_completed,
                r.messages_sent
            ]));
        } else if (reportType === 'sales') {
            headers = ['Fecha', 'Número Cotización', 'Cliente', 'Teléfono', 'Monto', 'Agente', 'Estado'];

            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT 
          DATE_FORMAT(q.created_at, '%Y-%m-%d %H:%i') AS fecha,
          q.quotation_number,
          c.wa_profile_name,
          c.wa_user,
          q.amount,
          u.nombre AS agente,
          CASE 
            WHEN cc.cycle_data IS NOT NULL AND JSON_EXTRACT(cc.cycle_data, '$.monto') IS NOT NULL 
            THEN 'Vendida' 
            ELSE 'Pendiente' 
          END AS estado
        FROM quotations q
        LEFT JOIN conversaciones c ON q.conversation_id = c.id
        LEFT JOIN usuarios u ON c.asignado_a = u.id
        LEFT JOIN conversation_cycles cc ON q.cycle_id = cc.id
        WHERE q.created_at ${dateFilter}
        ORDER BY q.created_at DESC`
            );

            data = rows.map(r => [
                r.fecha,
                r.quotation_number,
                r.wa_profile_name || '',
                r.wa_user || '',
                r.amount,
                r.agente || 'Sin asignar',
                r.estado
            ]);
        } else if (reportType === 'conversations') {
            headers = ['Fecha Creación', 'Cliente', 'Teléfono', 'Estado', 'Agente', 'Total Mensajes', 'Última Actividad'];

            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT 
          DATE_FORMAT(c.creado_en, '%Y-%m-%d %H:%i') AS fecha_creacion,
          c.wa_profile_name,
          c.wa_user,
          cs.name AS estado,
          u.nombre AS agente,
          COUNT(m.id) AS total_mensajes,
          DATE_FORMAT(MAX(m.creado_en), '%Y-%m-%d %H:%i') AS ultima_actividad
        FROM conversaciones c
        LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
        LEFT JOIN usuarios u ON c.asignado_a = u.id
        LEFT JOIN mensajes m ON m.conversacion_id = c.id
        WHERE c.creado_en ${dateFilter}
        GROUP BY c.id
        ORDER BY c.creado_en DESC`
            );

            data = rows.map(r => [
                r.fecha_creacion,
                r.wa_profile_name || '',
                r.wa_user || '',
                r.estado || 'Sin estado',
                r.agente || 'Sin asignar',
                r.total_mensajes,
                r.ultima_actividad || ''
            ]);
        }

        // Generate CSV
        if (format === 'csv') {
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
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8

            return new Response(blob, {
                headers: {
                    'Content-Type': 'text/csv;charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        // Generate Excel (using exceljs)
        if (format === 'excel') {
            const ExcelJSImport = await import('exceljs');
            const ExcelJS = ExcelJSImport.default ?? ExcelJSImport;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Mensajeria';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Reporte');

            // Add headers
            const headerRow = sheet.addRow(headers);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' }
            };

            // Add data
            data.forEach(row => {
                sheet.addRow(row);
            });

            // Auto-fit columns
            sheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const length = cell.value ? String(cell.value).length : 10;
                    if (length > maxLength) maxLength = length;
                });
                column.width = Math.min(maxLength + 2, 50);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            return new Response(blob, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

        return new Response(JSON.stringify({ ok: false, error: 'Formato no soportado' }), { status: 400 });
    } catch (e: any) {
        console.error("Error generating report:", e);
        return new Response(
            JSON.stringify({ ok: false, error: e?.message || "Error al generar reporte" }),
            { status: 500 }
        );
    }
};
