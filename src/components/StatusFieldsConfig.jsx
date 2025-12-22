import { useState } from 'react';

const BASE = import.meta.env.BASE_URL || '';

/**
 * Modal para configurar campos personalizados de un estado
 * Permite definir qué información se debe capturar cuando
 * una conversación cambia a este estado
 */
export default function StatusFieldsConfig({ status, onClose, onSave }) {
  // required_fields puede venir como array (ya parseado por MySQL) o como string JSON
  const [fields, setFields] = useState(
    status?.required_fields
      ? (Array.isArray(status.required_fields)
          ? status.required_fields
          : JSON.parse(status.required_fields))
      : []
  );
  const [editingField, setEditingField] = useState(null);

  const fieldTypes = [
    { value: 'text', label: 'Texto corto' },
    { value: 'textarea', label: 'Texto largo' },
    { value: 'number', label: 'Número' },
    { value: 'select', label: 'Lista de opciones' },
    { value: 'date', label: 'Fecha' },
  ];

  function addField() {
    setEditingField({
      name: '',
      label: '',
      type: 'text',
      required: true,
      placeholder: '',
      options: [],
    });
  }

  function saveField() {
    if (!editingField.name || !editingField.label) {
      alert('Nombre y etiqueta son requeridos');
      return;
    }

    const newFields = [...fields];
    const existingIndex = fields.findIndex(f => f.name === editingField.name);

    if (existingIndex >= 0) {
      newFields[existingIndex] = editingField;
    } else {
      newFields.push(editingField);
    }

    setFields(newFields);
    setEditingField(null);
  }

  function removeField(fieldName) {
    setFields(fields.filter(f => f.name !== fieldName));
  }

  async function handleSave() {
    try {
      const res = await fetch(
        `${BASE}/api/admin/conversation-statuses?id=${status.id}`.replace(/\/\//g, '/'),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            required_fields: JSON.stringify(fields),
          }),
        }
      );

      const data = await res.json();
      if (!data.ok) {
        alert(data.error || 'Error guardando configuración');
        return;
      }

      onSave?.();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Error de red');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Configurar campos para: <span className="text-emerald-400">{status?.name}</span>
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-400 mb-6">
            Define qué información se debe capturar cuando una conversación cambia a este estado.
            Por ejemplo, si el estado es "Venta", puedes pedir monto, producto, método de pago, etc.
          </p>

          {/* Lista de campos configurados */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Campos configurados ({fields.length})</h3>
              <button
                onClick={addField}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
              >
                + Agregar campo
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                No hay campos configurados. Haz clic en "Agregar campo" para empezar.
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{field.label}</div>
                      <div className="text-xs text-slate-400">
                        Tipo: {fieldTypes.find(t => t.value === field.type)?.label} •
                        {field.required ? ' Obligatorio' : ' Opcional'}
                        {field.type === 'select' && ` • ${field.options?.length || 0} opciones`}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingField({ ...field })}
                      className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => removeField(field.name)}
                      className="px-3 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor de campo */}
          {editingField && (
            <div className="border border-emerald-700/50 bg-emerald-950/20 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-4 text-emerald-300">
                {fields.find(f => f.name === editingField.name) ? 'Editar' : 'Nuevo'} campo
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nombre técnico (sin espacios) *
                  </label>
                  <input
                    type="text"
                    value={editingField.name}
                    onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                    placeholder="ej: monto_venta"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Etiqueta visible *</label>
                  <input
                    type="text"
                    value={editingField.label}
                    onChange={e => setEditingField({ ...editingField, label: e.target.value })}
                    placeholder="ej: Monto de la venta"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de campo</label>
                  <select
                    value={editingField.type}
                    onChange={e => setEditingField({ ...editingField, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded outline-none focus:border-emerald-400"
                  >
                    {fieldTypes.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={editingField.placeholder || ''}
                    onChange={e =>
                      setEditingField({ ...editingField, placeholder: e.target.value })
                    }
                    placeholder="ej: Ingresa el monto"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingField.required}
                    onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Campo obligatorio</span>
                </label>
              </div>

              {editingField.type === 'select' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Opciones (una por línea)
                  </label>
                  <textarea
                    value={(editingField.options || []).join('\n')}
                    onChange={e =>
                      setEditingField({
                        ...editingField,
                        options: e.target.value.split('\n').filter(o => o.trim()),
                      })
                    }
                    placeholder={'Efectivo\nTarjeta\nTransferencia'}
                    rows={5}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded outline-none focus:border-emerald-400 font-mono text-sm"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={saveField}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-medium"
                >
                  Guardar campo
                </button>
                <button
                  onClick={() => setEditingField(null)}
                  className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            Guardar configuración
          </button>
        </div>
      </div>
    </div>
  );
}
