import { useState, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL || ''

export default function TemplatesManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState({ estado: '', categoria: '' })
  const [showPreview, setShowPreview] = useState(null)

  // Cargar plantillas
  useEffect(() => {
    loadTemplates()
  }, [filter])

  async function loadTemplates() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.estado) params.set('estado', filter.estado)
      if (filter.categoria) params.set('categoria', filter.categoria)

      const res = await fetch(`${BASE}/api/templates?${params}`.replace(/\/\//g, '/'))
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

  async function syncFromMeta() {
    if (!confirm('¿Sincronizar plantillas desde Meta Business Manager?\n\nEsto puede tardar unos segundos.')) return

    setSyncing(true)
    try {
      const res = await fetch(`${BASE}/api/sync-templates`.replace(/\/\//g, '/'), {
        method: 'POST'
      })
      const data = await res.json()

      if (data.ok) {
        alert(`✅ ${data.message}\n\nTotal: ${data.total}\nSincronizadas: ${data.synced}\nErrores: ${data.errors}`)
        loadTemplates()
      } else {
        alert(`❌ Error: ${data.error}`)
      }
    } catch (err) {
      alert('❌ Error sincronizando plantillas')
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  function openMetaBusiness() {
    window.open('https://business.facebook.com/wa/manage/message-templates/', '_blank')
  }

  function renderPreview(tpl) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(null)}>
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Vista previa: {tpl.nombre}</h3>
            <button onClick={() => setShowPreview(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {tpl.header_text && (
              <div className="font-semibold text-sm">{tpl.header_text}</div>
            )}

            <div className="text-sm whitespace-pre-wrap">{tpl.body_text}</div>

            {tpl.footer_text && (
              <div className="text-xs text-gray-500">{tpl.footer_text}</div>
            )}

            {tpl.buttons && (
              <div className="border-t pt-3 space-y-2">
                {JSON.parse(tpl.buttons).map((btn, i) => (
                  <button key={i} className="w-full py-2 text-sm border rounded text-blue-600">
                    {btn.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div><span className="font-semibold">Categoría:</span> {tpl.categoria}</div>
            <div><span className="font-semibold">Idioma:</span> {tpl.idioma}</div>
            <div><span className="font-semibold">Estado:</span> {tpl.estado}</div>
            <div><span className="font-semibold">ID:</span> {tpl.wa_template_id?.slice(0, 12)}...</div>
          </div>

          <button
            onClick={() => setShowPreview(null)}
            className="mt-4 w-full py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Plantillas WhatsApp</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gestiona y sincroniza tus plantillas aprobadas de Meta Business
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openMetaBusiness}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <span>📝</span>
                <span>Crear en Meta</span>
              </button>
              <button
                onClick={syncFromMeta}
                disabled={syncing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <span>{syncing ? '⏳' : '🔄'}</span>
                <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg border p-4 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select
              value={filter.estado}
              onChange={e => setFilter(f => ({ ...f, estado: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="PENDING">Pendientes</option>
              <option value="REJECTED">Rechazadas</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Categoría</label>
            <select
              value={filter.categoria}
              onChange={e => setFilter(f => ({ ...f, categoria: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Todas</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utilidad</option>
              <option value="AUTHENTICATION">Autenticación</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de plantillas */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div>
            <p className="mt-2 text-gray-600">Cargando plantillas...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold mb-2">No hay plantillas</h3>
            <p className="text-gray-600 mb-6">
              Sincroniza tus plantillas desde Meta Business Manager para comenzar
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={openMetaBusiness}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Crear plantilla en Meta
              </button>
              <button
                onClick={syncFromMeta}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Sincronizar ahora
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-white rounded-lg border hover:shadow-lg transition-shadow">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{tpl.nombre}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          tpl.estado === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          tpl.estado === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {tpl.estado}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                          {tpl.categoria}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-3 mb-3 max-h-32 overflow-hidden">
                    <p className="text-sm text-gray-700 line-clamp-4">
                      {tpl.body_text}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreview(tpl)}
                      className="flex-1 py-2 text-sm border rounded hover:bg-gray-50"
                    >
                      👁 Ver completa
                    </button>
                    {tpl.estado === 'APPROVED' && (
                      <button
                        onClick={() => alert('Función de envío en desarrollo')}
                        className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        📤 Usar
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t px-4 py-2 bg-gray-50 text-xs text-gray-600">
                  Actualizada: {new Date(tpl.updated_at).toLocaleDateString('es-MX')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de vista previa */}
      {showPreview && renderPreview(showPreview)}
    </div>
  )
}
