import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL || ''

export default function TemplatePicker({ conversation, onClose, onSent }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [variables, setVariables] = useState([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const res = await fetch(`${BASE}/api/templates?estado=APPROVED`.replace(/\/\//g, '/'))
      const data = await res.json()
      if (data.ok) {
        setTemplates(data.items || [])
      }
    } catch (err) {
      console.error('Error cargando plantillas:', err)
    } finally {
      setLoading(false)
    }
  }

  function selectTemplate(tpl) {
    setSelectedTemplate(tpl)

    // Extraer variables del body_text (formato {{1}}, {{2}}, etc.)
    const matches = tpl.body_text?.match(/\{\{(\d+)\}\}/g) || []
    const varCount = matches.length
    setVariables(new Array(varCount).fill(''))
  }

  async function sendTemplate() {
    if (!selectedTemplate) return

    // Validar que todas las variables estén llenas
    if (variables.some(v => !v.trim())) {
      alert('Por favor llena todas las variables de la plantilla')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`${BASE}/api/send-template`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversation.id,
          to: conversation.wa_user,
          template: selectedTemplate.nombre,
          lang: selectedTemplate.idioma || 'es',
          params: variables.length > 0 ? variables : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        alert(`Error: ${data?.error?.message || data?.error || 'No se pudo enviar'}`)
        return
      }

      onSent?.()
      onClose()
    } catch (err) {
      alert('Error enviando plantilla')
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  function renderTemplatePreview(tpl) {
    let preview = tpl.body_text || ''

    // Reemplazar variables con valores ingresados
    variables.forEach((val, idx) => {
      preview = preview.replace(`{{${idx + 1}}}`, val || `{{${idx + 1}}}`)
    })

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        {tpl.header_text && (
          <div className="font-semibold text-sm mb-2">{tpl.header_text}</div>
        )}
        <div className="text-sm whitespace-pre-wrap">{preview}</div>
        {tpl.footer_text && (
          <div className="text-xs text-gray-500 mt-2">{tpl.footer_text}</div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Enviar plantilla</h3>
            <p className="text-sm text-gray-600">Para: {conversation.wa_profile_name || conversation.wa_user}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Cargando plantillas...</p>
            </div>
          ) : !selectedTemplate ? (
            // Lista de plantillas
            <div>
              <p className="text-sm text-gray-600 mb-4">Selecciona una plantilla aprobada:</p>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay plantillas aprobadas</p>
                  <a href="/plantillas" className="text-green-600 hover:underline mt-2 inline-block">
                    Ir a gestión de plantillas
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className="w-full text-left p-4 border rounded-lg hover:border-green-500 hover:bg-green-50 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold">{tpl.nombre}</div>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                          {tpl.categoria}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{tpl.body_text}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Formulario de variables y preview
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{selectedTemplate.nombre}</h4>
                <button
                  onClick={() => {
                    setSelectedTemplate(null)
                    setVariables([])
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  ← Cambiar plantilla
                </button>
              </div>

              {variables.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium mb-3">Variables de la plantilla:</p>
                  <div className="space-y-3">
                    {variables.map((val, idx) => (
                      <div key={idx}>
                        <label className="block text-sm mb-1">
                          Variable {idx + 1} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={e => {
                            const newVars = [...variables]
                            newVars[idx] = e.target.value
                            setVariables(newVars)
                          }}
                          placeholder={`Ingresa el valor para {{${idx + 1}}}`}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Vista previa:</p>
                {renderTemplatePreview(selectedTemplate)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedTemplate && (
          <div className="border-t p-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={sendTemplate}
              disabled={sending || variables.some(v => !v.trim())}
              className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Enviando...' : 'Enviar plantilla'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
