// ============================================================
//  GalleryView.jsx — Galería de plantillas SVG
//  Usa useTemplates → Supabase Storage (o memoria si no config)
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useTemplates } from '../hooks/useTemplates.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { ConfirmDialog } from './UI.jsx'
import { svgPreviewMarkup } from '../utils/svg.js'

function ColorDot({ color }) {
  return (
    <span title={color} style={{
      display:'inline-block', width:12, height:12, borderRadius:'50%',
      background:color, border:'1px solid rgba(0,0,0,0.1)', flexShrink:0,
    }} />
  )
}

function SvgPreviewCard({ tpl, loading, selected, onSelect, onPreview, onDelete }) {
  return (
    <div
      onClick={() => onSelect(tpl)}
      className={`bg-white border-2 rounded-2xl overflow-hidden transition-all cursor-pointer group
        ${selected
          ? 'border-orange-500 shadow-lg shadow-orange-100'
          : 'border-stone-200 hover:border-orange-300 hover:shadow-md'}`}
    >
      {/* Miniatura */}
      <div className="relative bg-stone-100 overflow-hidden" style={{ aspectRatio:'1.414/1' }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-stone-300 animate-spin" style={{fontSize:28}}>refresh</span>
          </div>
        ) : tpl.svgContent ? (
          <div
            className="w-full h-full"
            style={{ transform:'scale(0.45)', transformOrigin:'top left', width:'222%', pointerEvents:'none' }}
            dangerouslySetInnerHTML={{ __html: svgPreviewMarkup(tpl.svgContent, { style:'display:block;width:100%;height:auto' }) }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-300">
            <span className="material-symbols-outlined text-4xl">workspace_premium</span>
            <span className="text-xs">Sin vista previa</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
          <button
            onClick={e => { e.stopPropagation(); onPreview(tpl) }}
            className="flex items-center gap-1 px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg shadow hover:bg-orange-50 transition-colors">
            <span className="material-symbols-outlined" style={{fontSize:13}}>zoom_in</span>
            Ver
          </button>
          {!tpl.is_builtin && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(tpl.id) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 text-xs font-semibold rounded-lg shadow hover:bg-red-50 transition-colors">
              <span className="material-symbols-outlined" style={{fontSize:13}}>delete</span>
              Eliminar
            </button>
          )}
        </div>

        {/* Checkmark si seleccionada */}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow">
            <span className="material-symbols-outlined text-white" style={{fontSize:14}}>check</span>
          </div>
        )}

        {/* Badge built-in vs custom */}
        <div className="absolute top-2 left-2">
          {tpl.is_builtin
            ? <span className="text-xs bg-white/90 text-stone-500 px-1.5 py-0.5 rounded font-medium">Built-in</span>
            : <span className="text-xs bg-orange-500/90 text-white px-1.5 py-0.5 rounded font-medium">Tuya</span>}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">{tpl.style}</p>
          </div>
          <div className="flex gap-1 mt-0.5 shrink-0">
            {(tpl.colors||[]).slice(0,4).map((c,i) => <ColorDot key={i} color={c} />)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(tpl.tags||[]).map(tag => (
            <span key={tag} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SvgFullModal({ tpl, onClose, onUse }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{tpl.name}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{tpl.file_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onUse(tpl)}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors">
              <span className="material-symbols-outlined" style={{fontSize:16}}>workspace_premium</span>
              Usar esta plantilla
            </button>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100">
              <span className="material-symbols-outlined" style={{fontSize:18}}>close</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-stone-50 flex items-center justify-center">
          {tpl.svgContent ? (
            <div className="bg-white rounded-xl shadow-md w-full max-w-3xl"
              dangerouslySetInnerHTML={{ __html: svgPreviewMarkup(tpl.svgContent, { style:'display:block;width:100%;height:auto' }) }} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-stone-300 py-20">
              <span className="material-symbols-outlined text-6xl">image_not_supported</span>
              <p className="text-sm">Vista previa no disponible</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50">
          <div className="flex flex-wrap gap-6 text-xs text-stone-500">
            <span><strong className="text-gray-700">Estilo:</strong> {tpl.style}</span>
            <span><strong className="text-gray-700">ID nombre:</strong> <code className="font-mono bg-stone-100 px-1 rounded">{tpl.name_id}</code></span>
            <span><strong className="text-gray-700">ID fecha:</strong> <code className="font-mono bg-stone-100 px-1 rounded">{tpl.date_id}</code></span>
            <span><strong className="text-gray-700">Agregada:</strong> {tpl.created_at?.slice?.(0,10) || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadModal({ onClose, onSave, uploading, error }) {
  const [file,   setFile]   = useState(null)
  const [name,   setName]   = useState('')
  const [style,  setStyle]  = useState('Personalizado')
  const [tags,   setTags]   = useState('')
  const fileRef = useRef()

  const handleFile = f => {
    if (!f) return
    setFile(f)
    if (!name) setName(f.name.replace('.svg','').replace(/[-_]/g,' '))
  }

  const submit = () => {
    if (!file) return
    const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean)
    onSave(file, { name: name || file.name, style, tags: tagArr.length ? tagArr : ['personalizado'] })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-6"
      onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500" style={{fontSize:18}}>upload_file</span>
            Subir nueva plantilla SVG
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <span className="material-symbols-outlined" style={{fontSize:18}}>close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
              ${file ? 'border-green-400 bg-green-50' : 'border-stone-300 bg-stone-50 hover:border-orange-400'}`}>
            <input ref={fileRef} type="file" accept=".svg" className="hidden"
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value='' }} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-green-600" style={{fontSize:18}}>check_circle</span>
                <span className="text-sm font-medium text-green-700 truncate max-w-[200px]">{file.name}</span>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-orange-400 text-3xl mb-2 block">upload_file</span>
                <p className="text-sm text-stone-500">Clic o arrastrá un archivo .svg</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">Nombre de la plantilla</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Certificado Marketing 2026"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-amber-50 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Estilo</label>
              <select value={style} onChange={e => setStyle(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-amber-50 focus:outline-none focus:ring-2 focus:ring-orange-400">
                {['Personalizado','Institucional','Contemporáneo','Minimalista','Colorido'].map(s =>
                  <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Etiquetas (separadas por coma)</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="moderno, azul, 2026"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-amber-50 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          {/* Indicador de almacenamiento */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            isSupabaseConfigured
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
            <span className="material-symbols-outlined" style={{fontSize:14}}>
              {isSupabaseConfigured ? 'cloud_upload' : 'memory'}
            </span>
            {isSupabaseConfigured
              ? 'Se guardará en Supabase Storage y estará disponible para todos.'
              : 'Supabase no configurado — la plantilla se guardará solo en esta sesión.'}
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <span className="material-symbols-outlined shrink-0 mt-0.5" style={{fontSize:14}}>error</span>
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={!file || uploading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors">
            {uploading
              ? <><span className="material-symbols-outlined animate-spin" style={{fontSize:15}}>refresh</span>Subiendo…</>
              : <><span className="material-symbols-outlined" style={{fontSize:15}}>cloud_upload</span>Subir plantilla</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GalleryView({ onUseCertificate }) {
  const {
    templates, loading, uploading, error,
    uploadTemplate, deleteTemplate, loadSvgContent, setSvgContent, reload,
  } = useTemplates()

  const [search,      setSearch]      = useState('')
  const [filterStyle, setFilterStyle] = useState('all')
  const [selectedId,  setSelectedId]  = useState(null)
  const [previewTpl,  setPreviewTpl]  = useState(null)
  const [showUpload,  setShowUpload]  = useState(false)
  const [loadingIds,  setLoadingIds]  = useState(new Set())
  const [confirmTpl,  setConfirmTpl]  = useState(null)   // plantilla a eliminar

  // Cargar SVG content cuando aparece una plantilla sin él
  useEffect(() => {
    templates.forEach(async tpl => {
      if (tpl.svgContent || loadingIds.has(tpl.id)) return
      setLoadingIds(s => new Set([...s, tpl.id]))
      const content = await loadSvgContent(tpl)
      if (content) setSvgContent(tpl.id, content)
      setLoadingIds(s => { const n = new Set(s); n.delete(tpl.id); return n })
    })
  }, [templates])

  const handleUpload = async (file, meta) => {
    const result = await uploadTemplate(file, meta)
    if (result) setShowUpload(false)
  }

  // Pide confirmación; el borrado real ocurre en confirmDelete()
  const handleDelete = (id) => {
    const tpl = templates.find(t => t.id === id)
    setConfirmTpl(tpl || { id, name: 'esta plantilla' })
  }
  const confirmDelete = async () => {
    const id = confirmTpl.id
    await deleteTemplate(id)
    if (selectedId === id) setSelectedId(null)
  }

  const handleUse = async (tpl) => {
    // Para plantillas de Supabase: cargar el SVG y convertirlo en File object
    // Para built-ins: pasar file_name para que el backend lo sirva desde /templates/
    let _file = tpl._file || null

    if (!_file && !tpl.is_builtin) {
      // Plantilla custom en Supabase — cargar el SVG content
      const svgText = await loadSvgContent(tpl)
      if (svgText) {
        _file = new File([svgText], tpl.file_name, { type: 'image/svg+xml' })
      }
    }

    const adapted = {
      ...tpl,
      file: tpl.is_builtin ? tpl.file_name : null,
      _file,
      ids: { name: tpl.name_id, date: tpl.date_id },
    }
    setSelectedId(null)
    onUseCertificate(adapted)
  }

  const styles   = ['all', ...new Set(templates.map(t => t.style).filter(Boolean))]
  const filtered = templates.filter(t => {
    const q = search.toLowerCase()
    return (filterStyle === 'all' || t.style === filterStyle)
      && (!q || t.name.toLowerCase().includes(q) || (t.tags||[]).some(tag => tag.toLowerCase().includes(q)))
  })

  const selectedTpl = templates.find(t => t.id === selectedId)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, color:'var(--black)' }}>
            Galería de Plantillas
          </h2>
          <p style={{ fontSize:13, color:'var(--gray)', marginTop:4 }}>
            Explorá y administrá las plantillas SVG para certificados
            {isSupabaseConfigured
              ? <span className="ml-2 text-green-600 font-medium">· Sincronizado con Supabase</span>
              : <span className="ml-2 text-amber-600 font-medium">· Solo en memoria (configura Supabase para persistir)</span>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {loading && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-stone-500">
              <span className="material-symbols-outlined animate-spin" style={{fontSize:14}}>refresh</span>
              Cargando…
            </div>
          )}
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-stone-200 text-stone-600 text-sm font-medium rounded-lg hover:border-orange-300 hover:text-orange-600 bg-white transition-colors">
            <span className="material-symbols-outlined" style={{fontSize:16}}>upload_file</span>
            Subir SVG
          </button>
          {selectedId && (
            <button onClick={() => handleUse(selectedTpl)}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors">
              <span className="material-symbols-outlined" style={{fontSize:16}}>workspace_premium</span>
              Usar seleccionada
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { icon:'workspace_premium', label:'Total plantillas', value: templates.length,                              color:'var(--orange)' },
          { icon:'star',              label:'Tuyas',            value: templates.filter(t => !t.is_builtin).length,    color:'var(--green)' },
          { icon:'shield',            label:'Predefinidas',     value: templates.filter(t => t.is_builtin).length,     color:'var(--gray)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center', background:'var(--cream-2)', color:s.color }}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize:20 }}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xs text-muted" style={{ margin:0 }}>{s.label}</p>
              <p style={{ margin:0, fontSize:22, fontWeight:700, color:'var(--black)' }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" style={{fontSize:16}}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o etiqueta…"
            className="w-full border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div className="flex gap-1 p-1 bg-stone-100 rounded-xl flex-wrap">
          {styles.map(s => (
            <button key={s} onClick={() => setFilterStyle(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                ${filterStyle === s ? 'bg-white text-gray-900 shadow-sm' : 'text-stone-500 hover:text-gray-700'}`}>
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 rounded-xl text-xs text-stone-500">
          <span className="material-symbols-outlined" style={{fontSize:14}}>grid_view</span>
          {filtered.length} plantilla{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          <span className="material-symbols-outlined shrink-0" style={{fontSize:16}}>error</span>
          {error}
          <button onClick={reload} className="ml-auto text-xs underline hover:no-underline">Reintentar</button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-4">
          <span className="material-symbols-outlined text-6xl">photo_library</span>
          <p className="text-sm">No hay plantillas que coincidan</p>
          <button onClick={() => { setSearch(''); setFilterStyle('all') }}
            className="text-xs text-orange-600 hover:underline">Limpiar filtros</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(tpl => (
            <SvgPreviewCard key={tpl.id}
              tpl={tpl}
              loading={loadingIds.has(tpl.id)}
              selected={selectedId === tpl.id}
              onSelect={t => setSelectedId(t.id === selectedId ? null : t.id)}
              onPreview={t => setPreviewTpl(t)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Barra flotante de selección */}
      {selectedId && selectedTpl && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3 bg-gray-900 text-amber-50 rounded-2xl shadow-xl z-40 text-sm max-w-[90vw]">
          <span className="material-symbols-outlined text-orange-400 shrink-0" style={{fontSize:18}}>workspace_premium</span>
          <span className="font-medium truncate">{selectedTpl.name}</span>
          <button onClick={() => handleUse(selectedTpl)}
            className="ml-auto shrink-0 px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors">
            Usar →
          </button>
          <button onClick={() => setSelectedId(null)} className="text-stone-500 hover:text-stone-300 shrink-0">
            <span className="material-symbols-outlined" style={{fontSize:16}}>close</span>
          </button>
        </div>
      )}

      {/* Modal vista completa */}
      {previewTpl && (
        <SvgFullModal
          tpl={previewTpl}
          onClose={() => setPreviewTpl(null)}
          onUse={t => { setPreviewTpl(null); handleUse(t) }}
        />
      )}

      {/* Modal subir */}
      {showUpload && (
        <UploadModal
          uploading={uploading}
          error={error}
          onClose={() => setShowUpload(false)}
          onSave={handleUpload}
        />
      )}

      {confirmTpl && (
        <ConfirmDialog
          title="Eliminar plantilla"
          message={`¿Seguro que querés eliminar "${confirmTpl.name}"? No se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onClose={() => setConfirmTpl(null)}
        />
      )}
    </div>
  )
}
