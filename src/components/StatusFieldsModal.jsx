import { useState } from 'react';

/**
 * Modal reutilizable para capturar campos personalizados al cambiar estado
 * Usado tanto en ChatPane como en PipelineView
 */
export default function StatusFieldsModal({ status, conversationName, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // required_fields puede venir como array (ya parseado por MySQL) o como string JSON
  const fields = status?.required_fields
    ? (Array.isArray(status.required_fields)
        ? status.required_fields
        : JSON.parse(status.required_fields))
    : [];

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validar campos requeridos
    const newErrors = {};
    fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = 'Este campo es obligatorio';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (field) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    const updateValue = (val) => {
      setFormData({ ...formData, [field.name]: val });
      if (errors[field.name]) {
        setErrors({ ...errors, [field.name]: null });
      }
    };

    const commonClasses = "w-full px-3 py-2 bg-slate-900 border rounded outline-none focus:border-emerald-400 " +
      (error ? "border-red-500" : "border-slate-700");

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.placeholder || ''}
            rows={4}
            className={commonClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            className={commonClasses}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            className={commonClasses}
          >
            <option value="">-- Seleccionar --</option>
            {(field.options || []).map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            className={commonClasses}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4">
          <h3 className="text-lg font-bold">
            Información requerida para: <span className="text-emerald-400">{status?.name}</span>
          </h3>
          {conversationName && (
            <p className="text-sm text-slate-400 mt-1">
              Conversación: {conversationName}
            </p>
          )}
          <p className="text-sm text-slate-400 mt-1">
            Completa los siguientes campos antes de cambiar el estado
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {fields.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <p className="text-red-400 text-xs mt-1">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
              Confirmar cambio de estado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
