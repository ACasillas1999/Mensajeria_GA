import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL || ''

export default function TemplatePicker({ conversation, onClose, onSent }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [variables, setVariables] = useState([])
  const [headerMediaUrl, setHeaderMediaUrl] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const res = await fetch(`${BASE}/api/templates?estado=APPROVED`.replace(/\/\//g, '/'))
      const data = await res.json()
      console.log('[TemplatePicker] Datos recibidos:', data)
      console.log('[TemplatePicker] data.ok:', data.ok)
      console.log('[TemplatePicker] data.items:', data.items)
      if (data.ok) {
        const items = data.items || []
        console.log('[TemplatePicker] Plantillas cargadas:', items.length)
        console.log('[TemplatePicker] Primera plantilla:', items[0])
        if (items[0]) {
          console.log('[TemplatePicker] body_text tipo:', typeof items[0].body_text)
          console.log('[TemplatePicker] body_text valor:', items[0].body_text)
        }
        setTemplates(items)
      } else {
        console.error('[TemplatePicker] API retornó ok:false')
      }
    } catch (err) {
      console.error('Error cargando plantillas:', err)
    } finally {
      setLoading(false)
    }
  }

  function selectTemplate(tpl) {
    console.log('[TemplatePicker] Plantilla seleccionada:', tpl)
    setSelectedTemplate(tpl)

    // Extraer variables del body_text (formato {{1}}, {{2}}, etc.)
    const matches = tpl.body_text?.match(/\{\{(\d+)\}\}/g) || []
    const varCount = matches.length
    console.log('[TemplatePicker] Variables detectadas:', varCount, matches)
    setVariables(new Array(varCount).fill(''))

    // Reset header media URL
    setHeaderMediaUrl('')
  }

  async function sendTemplate() {
    if (!selectedTemplate) return

    // Validar que todas las variables estén llenas (solo si hay variables)
    if (variables.length > 0 && variables.some(v => !v.trim())) {
      alert('Por favor llena todas las variables de la plantilla')
      return
    }

    // Validar que si el template tiene header de media, se proporcione la URL
    const hasMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate.header_type)
    if (hasMediaHeader && !headerMediaUrl.trim()) {
      alert(`Esta plantilla requiere un ${selectedTemplate.header_type.toLowerCase()} en el header. Por favor proporciona la URL.`)
      return
    }

    setSending(true)
    try {
      const payload = {
        conversacion_id: conversation.id,
        to: conversation.wa_user,
        template: selectedTemplate.nombre,
        lang: selectedTemplate.idioma || 'es',
        params: variables.length > 0 ? variables : undefined,
      }

      // Agregar header media según el tipo
      if (selectedTemplate.header_type === 'IMAGE' && headerMediaUrl) {
        payload.header_image = headerMediaUrl
      } else if (selectedTemplate.header_type === 'VIDEO' && headerMediaUrl) {
        payload.header_video = headerMediaUrl
      } else if (selectedTemplate.header_type === 'DOCUMENT' && headerMediaUrl) {
        payload.header_document = headerMediaUrl
      }

      const res = await fetch(`${BASE}/api/send-template`.replace(/\/\//g, '/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    let bodyPreview = tpl.body_text || ''

    // Reemplazar variables con valores ingresados
    variables.forEach((val, idx) => {
      bodyPreview = bodyPreview.replace(`{{${idx + 1}}}`, val || `{{${idx + 1}}}`)
    })

    // Construir el contenido completo como se verá en WhatsApp
    let fullContent = ''
    if (tpl.header_text) fullContent += `*${tpl.header_text}*\n\n`
    fullContent += bodyPreview
    if (tpl.footer_text) fullContent += `\n\n_${tpl.footer_text}_`

    // Formatear el texto (convertir markdown a HTML)
    const formattedContent = fullContent
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')

    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div
          className="text-sm text-slate-300"
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Enviar plantilla</h3>
            <p className="text-sm text-slate-400">Para: {conversation.wa_profile_name || conversation.wa_user}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-2xl">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
              <p className="mt-2 text-slate-400">Cargando plantillas...</p>
            </div>
          ) : !selectedTemplate ? (
            // Lista de plantillas
            <div>
              <p className="text-sm text-slate-400 mb-4">Selecciona una plantilla aprobada:</p>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>No hay plantillas aprobadas</p>
                  <a href="/plantillas" className="text-emerald-400 hover:underline mt-2 inline-block">
                    Ir a gestión de plantillas
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map(tpl => {
                    console.log('[TemplatePicker] Renderizando plantilla:', tpl.nombre, 'body_text:', typeof tpl.body_text, tpl.body_text)
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => selectTemplate(tpl)}
                        className="w-full text-left p-4 border border-slate-800 rounded-lg bg-slate-900/50 hover:bg-slate-800/70 hover:border-emerald-700/50 transition group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-slate-200 group-hover:text-emerald-400 transition flex items-center gap-2">
                            {tpl.nombre}
                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tpl.header_type) && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 border border-amber-700/50" title={`Requiere ${tpl.header_type}`}>
                                {tpl.header_type === 'IMAGE' ? '🖼️' : tpl.header_type === 'VIDEO' ? '🎥' : '📄'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-slate-800 text-emerald-400 border border-emerald-800/50">
                            {tpl.categoria}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2 whitespace-pre-wrap">
                          {typeof tpl.body_text === 'string' ? tpl.body_text : JSON.stringify(tpl.body_text)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            // Formulario de variables y preview
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-200">{selectedTemplate.nombre}</h4>
                <button
                  onClick={() => {
                    setSelectedTemplate(null)
                    setVariables([])
                    setHeaderMediaUrl('')
                  }}
                  className="text-sm text-slate-400 hover:text-emerald-400"
                >
                  ← Cambiar plantilla
                </button>
              </div>

              {/* Header Media Input */}
              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate.header_type) && (
                <div className="bg-amber-950/20 border border-amber-700/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-300 mb-2">
                    Header {selectedTemplate.header_type} <span className="text-red-400">*</span>
                  </p>
                  <p className="text-xs text-slate-400 mb-3">
                    Esta plantilla requiere un {selectedTemplate.header_type.toLowerCase()} en el header.
                  </p>
                  <input
                    type="url"
                    value={headerMediaUrl}
                    onChange={e => setHeaderMediaUrl(e.target.value)}
                    placeholder={`URL del ${selectedTemplate.header_type.toLowerCase()} (https://...)`}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {variables.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-300 mb-3">Variables de la plantilla:</p>
                  <div className="space-y-3">
                    {variables.map((val, idx) => (
                      <div key={idx}>
                        <label className="block text-sm text-slate-400 mb-1">
                          Variable {idx + 1} <span className="text-red-400">*</span>
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
                          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 outline-none focus:border-emerald-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Vista previa:</p>
                {renderTemplatePreview(selectedTemplate)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedTemplate && (
          <div className="border-t border-slate-800 p-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-slate-700 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={sendTemplate}
              disabled={
                sending ||
                (variables.length > 0 && variables.some(v => !v.trim())) ||
                (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate.header_type) && !headerMediaUrl.trim())
              }
              className="flex-1 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {sending ? 'Enviando...' : 'Enviar plantilla'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
