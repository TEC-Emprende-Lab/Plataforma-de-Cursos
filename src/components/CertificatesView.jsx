// ============================================================
//  CertificatesView.jsx — Módulo de generación de certificados
//  Requiere backend Flask corriendo en CERT_API (ver abajo)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTemplates } from '../hooks/useTemplates.js'

import { CERT_API } from '../config.js'
import { svgPreviewMarkup } from '../utils/svg.js'
import { certificateApiFetch } from '../lib/certificateApi.js'

const TODAY_ES = (() => {
  const d = new Date()
  const m = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
             'septiembre','octubre','noviembre','diciembre']
  return `${d.getDate()} de ${m[d.getMonth()]} de ${d.getFullYear()}`
})()

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const fmtDateEs = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_ES[m-1]} de ${y}`
}

const TIPO_PREFIX = { taller:'Taller de', curso:'Curso de', seminario:'Seminario de', bootcamp:'Bootcamp de', charla:'Charla sobre' }

function ExtraFieldInput({ id, value, onChange, size = 'sm', courses = [] }) {
  const isTipo       = /line_curso|tipo_curso/i.test(id)
  const isDateRange  = /line_fechas|fecha_rango|date_range/i.test(id)
  const isSingleDate = /date_issue_[12]|fecha_inicio|fecha_fin/i.test(id)
  const [startIso,  setStartIso]  = useState('')
  const [endIso,    setEndIso]    = useState('')
  const [singleIso, setSingleIso] = useState('')

  const fst = { background:'var(--cream-2)', color:'var(--black)', fontSize: size === 'xs' ? 11 : 13 }

  if (isTipo) {
    const certCourses = courses.some(c => c.certEnabled)
      ? courses.filter(c => c.active && c.certEnabled)
      : courses.filter(c => c.active)
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="finput" style={fst}>
        <option value="">— Seleccionar curso/taller —</option>
        {certCourses.map(c => {
          const prefix = TIPO_PREFIX[c.type] || 'Curso de'
          const label = c.name.startsWith(prefix) ? c.name : `${prefix} ${c.name}`
          return <option key={c.id} value={label}>{label}</option>
        })}
      </select>
    )
  }

  if (isDateRange) {
    const emit = (s, e) => {
      const sf = fmtDateEs(s), ef = fmtDateEs(e)
      onChange(sf && ef ? `Del ${sf} al ${ef}` : sf || ef || '')
    }
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:4 }}>Fecha inicio</p>
            <input type="date" value={startIso}
              onChange={e => { setStartIso(e.target.value); emit(e.target.value, endIso) }}
              className="finput" style={fst} />
          </div>
          <div>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:4 }}>Fecha fin</p>
            <input type="date" value={endIso}
              onChange={e => { setEndIso(e.target.value); emit(startIso, e.target.value) }}
              className="finput" style={fst} />
          </div>
        </div>
        {value && (
          <p style={{ fontSize:11, color:'var(--gray)', fontStyle:'italic', display:'flex', alignItems:'center', gap:4 }}>
            <span className="material-symbols-outlined" style={{fontSize:12}}>event</span>
            {value}
          </p>
        )}
      </div>
    )
  }

  if (isSingleDate) {
    return (
      <div>
        <p style={{ fontSize:11, color:'var(--gray)', marginBottom:4 }}>
          {id === 'date_issue_1' ? 'Fecha de inicio' : 'Fecha de finalización'}
        </p>
        <input type="date" value={value}
          onChange={e => onChange(e.target.value)}
          className="finput" style={fst} />
      </div>
    )
  }

  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={`Valor para ${id}`} className="finput" style={fst} />
  )
}

const BUILT_IN_TEMPLATES = []

/* ── TemplateCarousel ───────────────────────────────────────── */

function TemplateCarousel({ templates, selectedValue, svgFile, onSelect, certApi, loadSvgContent }) {
  const [idx, setIdx] = useState(0)
  const [thumbs, setThumbs] = useState({})    // optionId → svg string
  const VISIBLE = 2

  // Construir lista plana de opciones (built-in primero, luego custom)
  const options = [
    ...BUILT_IN_TEMPLATES.map(t => ({ id: t.file, label: t.name, isBuiltin: true })),
    ...templates.filter(t => !t.is_builtin).map(t => ({ id: t.id, label: t.name, isBuiltin: false, tpl: t })),
  ]

  const total   = options.length
  const maxIdx  = Math.max(0, total - VISIBLE)
  const visible = options.slice(idx, idx + VISIBLE)

  // Cargar miniaturas SVG para TODAS las opciones (built-in vía backend,
  // custom vía loadSvgContent del hook de Supabase)
  useEffect(() => {
    options.forEach(async opt => {
      if (thumbs[opt.id]) return
      try {
        let txt = null
        if (opt.isBuiltin) {
          const r = await fetch(`${certApi}/api/templates/${opt.id}`)
          if (r.ok) txt = await r.text()
        } else if (opt.tpl && loadSvgContent) {
          txt = await loadSvgContent(opt.tpl)
        }
        if (txt) setThumbs(prev => ({ ...prev, [opt.id]: txt }))
      } catch(_) {}
    })
  }, [certApi, templates.length])

  // Mantener idx dentro de rango si cambia el total
  useEffect(() => { if (idx > maxIdx) setIdx(maxIdx) }, [maxIdx])

  const activeId = svgFile ? '__file__' : (selectedValue || '')

  const arrowStyle = (disabled) => ({
    background:'none', border:'1px solid var(--border)', borderRadius:8,
    width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
    flexShrink:0, color:'var(--gray)', transition:'opacity .2s',
  })

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>

        {/* Flecha izquierda */}
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} style={arrowStyle(idx === 0)}>
          <span className="material-symbols-outlined" style={{fontSize:18}}>chevron_left</span>
        </button>

        {/* Cards */}
        <div style={{ flex:1, minWidth:0, display:'grid', gridTemplateColumns:`repeat(${VISIBLE}, 1fr)`, gap:8 }}>
          {visible.map(opt => {
            const isSelected = opt.id === activeId
            const svgRaw = thumbs[opt.id] || ''
            return (
              <button key={opt.id} onClick={() => onSelect(opt.id)}
                style={{
                  border: `2px solid ${isSelected ? 'var(--orange)' : 'var(--border)'}`,
                  borderRadius: 10, padding: 6, background: isSelected ? 'var(--alert-warm-bg)' : 'var(--cream-2)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all .18s', minWidth:0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                {/* Thumbnail */}
                <div style={{ width:'100%', aspectRatio:'4/3', borderRadius:6, overflow:'hidden',
                  background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {svgRaw
                    ? <div style={{ width:'100%', height:'100%' }}
                        dangerouslySetInnerHTML={{ __html: svgPreviewMarkup(svgRaw, {
                          preserveAspectRatio:'xMidYMid meet', style:'width:100%;height:100%;display:block',
                        }) }} />
                    : <span className="material-symbols-outlined" style={{ fontSize:28, color:'var(--gray)', opacity:.5 }}>
                        workspace_premium
                      </span>
                  }
                </div>
                {/* Nombre */}
                <span style={{ fontSize:11, fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--orange)' : 'var(--gray)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
                  {opt.label}
                </span>
                {isSelected && (
                  <span className="material-symbols-outlined" style={{ fontSize:14, color:'var(--orange)' }}>check_circle</span>
                )}
              </button>
            )
          })}
          {/* Relleno si hay menos de VISIBLE opciones */}
          {visible.length < VISIBLE && Array(VISIBLE - visible.length).fill(0).map((_, i) => (
            <div key={`empty-${i}`} style={{ border:'2px dashed var(--border)', borderRadius:10,
              aspectRatio:'4/3', background:'transparent', opacity:.3 }} />
          ))}
        </div>

        {/* Flecha derecha */}
        <button onClick={() => setIdx(i => Math.min(maxIdx, i + 1))} disabled={idx >= maxIdx} style={arrowStyle(idx >= maxIdx)}>
          <span className="material-symbols-outlined" style={{fontSize:18}}>chevron_right</span>
        </button>
      </div>

      {/* Indicador de posición */}
      {total > VISIBLE && (
        <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:8 }}>
          {Array(total).fill(0).map((_, i) => (
            <div key={i} onClick={() => setIdx(Math.min(maxIdx, Math.max(0, i - Math.floor(VISIBLE/2))))}
              style={{ width: i >= idx && i < idx + VISIBLE ? 16 : 6, height:6, borderRadius:3,
                background: i >= idx && i < idx + VISIBLE ? 'var(--orange)' : 'var(--border)',
                transition:'all .2s', cursor:'pointer' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function useDebounce(fn, delay) {
  const t = useRef(null)
  return useCallback((...args) => {
    clearTimeout(t.current)
    t.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}

/* ── Confeti ────────────────────────────────────────────────── */
// Animación de éxito ligera sobre <canvas>, sin dependencias externas.
// Refuerzo psicológico tras una generación masiva exitosa.
function ConfettiBurst({ trigger }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!trigger) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width  = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    const COLORS = ['#FE7210', '#FFA951', '#22c55e', '#3b82f6', '#eab308', '#ec4899']
    const N = 140
    const parts = Array.from({ length: N }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 7 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      life: 1,
    }))
    let frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      frame++
      parts.forEach(p => {
        p.vy += 0.4            // gravedad
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vrot
        p.life -= 0.008
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      })
      if (frame < 160) rafRef.current = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, W, H)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [trigger])

  if (!trigger) return null
  return (
    <canvas ref={canvasRef}
      style={{ position:'fixed', inset:0, width:'100vw', height:'100vh',
        pointerEvents:'none', zIndex:9999 }} />
  )
}

/* ── Atoms ──────────────────────────────────────────────────── */

function CertAlert({ type, msg, onDismiss }) {
  if (!msg) return null
  const cfg = {
    success: { bg:'var(--green-l)',      bc:'var(--green)',    tc:'var(--green)',    icon:'check_circle' },
    error:   { bg:'var(--row-exp-bg)',   bc:'var(--orange-d)', tc:'var(--orange-d)', icon:'error'        },
    info:    { bg:'var(--cream-2)',       bc:'var(--border)',   tc:'var(--gray)',     icon:'info'         },
  }[type] || { bg:'var(--cream-2)',      bc:'var(--border)',   tc:'var(--gray)',     icon:'info'         }
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 14px', borderRadius:10,
      border:`1px solid ${cfg.bc}`, background:cfg.bg, fontSize:13, marginTop:12 }}>
      <span className="material-symbols-outlined" style={{fontSize:16, color:cfg.tc, marginTop:1, flexShrink:0}}>{cfg.icon}</span>
      <span style={{ flex:1, lineHeight:1.6, color:'var(--black)' }}>{msg}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray)', opacity:.7 }}>
          <span className="material-symbols-outlined" style={{fontSize:14}}>close</span>
        </button>
      )}
    </div>
  )
}

function CertDropZone({ accept, title, subtitle, icon, file, onFile }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()
  const dzStyle = {
    border: `2px dashed ${file ? 'var(--green)' : drag ? 'var(--orange)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-lg)',
    padding: 20, textAlign:'center', cursor:'pointer',
    transition:'all .2s',
    background: file ? 'var(--green-l)' : drag ? 'var(--alert-warm-bg)' : 'var(--cream-2)',
  }
  return (
    <div style={dzStyle}
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = '' }} />
      {file ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span className="material-symbols-outlined" style={{fontSize:20, color:'var(--green)'}}>check_circle</span>
          <span style={{ fontSize:13, fontWeight:500, color:'var(--black)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>{file.name}</span>
          <button onClick={e => { e.stopPropagation(); onFile(null) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray)', marginLeft:2 }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>close</span>
          </button>
        </div>
      ) : (
        <>
          <span className="material-symbols-outlined" style={{fontSize:30, color:'var(--orange)', display:'block', marginBottom:8}}>{icon}</span>
          <p style={{ fontSize:13, fontWeight:500, color:'var(--black)' }}>{title}</p>
          {subtitle && <p style={{ fontSize:11, color:'var(--gray)', marginTop:2 }}>{subtitle}</p>}
        </>
      )}
    </div>
  )
}

function CertFormatToggle({ value, onChange }) {
  return (
    <div style={{ display:'flex', borderRadius:'var(--radius-md)', overflow:'hidden', border:'1px solid var(--border)' }}>
      {[{v:'pdf',icon:'picture_as_pdf',label:'PDF'},{v:'png',icon:'image',label:'PNG'}].map(f => (
        <button key={f.v} onClick={() => onChange(f.v)}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 0',
            fontSize:12, fontWeight:600, cursor:'pointer', border:'none', transition:'all .15s', fontFamily:'var(--font-body)',
            background: value === f.v ? 'var(--black)' : 'var(--white)',
            color:      value === f.v ? 'var(--cream)' : 'var(--gray)',
          }}>
          <span className="material-symbols-outlined" style={{fontSize:14}}>{f.icon}</span>{f.label}
        </button>
      ))}
    </div>
  )
}

// Indicador de pasos del asistente (wizard)
function Stepper({ steps, current, onStep }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:14 }}>
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={label} style={{ display:'flex', alignItems:'center', flex: i < steps.length - 1 ? 1 : 'unset' }}>
            <button
              onClick={() => onStep && n <= current && onStep(n)}
              disabled={n > current}
              style={{
                display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
                cursor: n <= current ? 'pointer' : 'default', padding:0, fontFamily:'var(--font-body)',
              }}>
              <span style={{
                width:24, height:24, borderRadius:'50%', display:'inline-flex',
                alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                flexShrink:0, transition:'all .15s',
                background: active ? 'var(--orange)' : done ? 'var(--green)' : 'var(--cream-3)',
                color: active || done ? '#fff' : 'var(--gray)',
              }}>
                {done ? <span className="material-symbols-outlined" style={{fontSize:14}}>check</span> : n}
              </span>
              <span style={{ fontSize:12, fontWeight: active ? 600 : 400,
                color: active ? 'var(--black)' : 'var(--gray)', whiteSpace:'nowrap' }}>
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div style={{ flex:1, height:2, margin:'0 8px', borderRadius:2,
                background: done ? 'var(--green)' : 'var(--cream-3)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Helper: encabezado de sección ─────────────────────────── */

function SectionHeader({ icon, label, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14,
      paddingBottom:12, borderBottom:'1px solid var(--cream-3)' }}>
      <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--orange)' }}>{icon}</span>
      <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
        letterSpacing:'.6px', color:'var(--gray)', flex:1 }}>{label}</span>
      {action}
    </div>
  )
}

/* ── Pestaña Individual ─────────────────────────────────────── */

function CertIndividual({ participants, courses = [], galleryTplPick, onGalleryConsumed }) {
  const { templates, loadSvgContent } = useTemplates()
  const [templateName,    setTemplateName]    = useState(null)
  const [svgFile,         setSvgFile]         = useState(null)
  const [nameId,          setNameId]          = useState('recipient_name')
  const [dateId,          setDateId]          = useState('issue_date')
  const [recipient,       setRecipient]       = useState('')
  const [date,            setDate]            = useState(TODAY_ES)
  const [fmt,             setFmt]             = useState('pdf')
  const [detectedIds,     setDetectedIds]     = useState([])
  const [extraFieldValues,setExtraFieldValues]= useState({})
  const [loading,         setLoading]         = useState(false)
  const [alert,           setAlert]           = useState(null)
  const [previewSvg,      setPreviewSvg]      = useState(null)
  const [previewLoading,  setPreviewLoading]  = useState(false)
  const [errors,          setErrors]          = useState({})
  const [step,            setStep]            = useState(1)   // wizard: 1=plantilla 2=datos 3=generar
  const [filterCourse,    setFilterCourse]    = useState('')   // filtra el select de participante por curso

  // IDs detectados que no son nombre ni fecha
  const extraIds = detectedIds.filter(({id}) => id !== nameId && id !== dateId)

  // Participantes activos, filtrados por curso si hay uno seleccionado
  const eligibleParticipants = participants.filter(p =>
    p.status === 'activo' &&
    (!filterCourse || (p.courses || []).includes(filterCourse)))

  const hasTemplate = !!(templateName || svgFile)
  const dataValid   = recipient.trim().length >= 2 && date.trim().length >= 4

  // Construye el objeto fields completo para enviar al backend
  const buildFields = (rcp, dt, nId, dId, extra) => {
    const fields = {}
    if (rcp && nId) fields[nId] = rcp
    if (dt  && dId) fields[dId] = dt
    Object.entries(extra || {}).forEach(([k, v]) => { if (v) fields[k] = v })
    return fields
  }

  useEffect(() => {
    if (!galleryTplPick) return
    if (galleryTplPick._file) {
      setSvgFile(galleryTplPick._file)
      setTemplateName(null)
    } else {
      setTemplateName(galleryTplPick.file)
      setSvgFile(null)
    }
    if (galleryTplPick.ids?.name) setNameId(galleryTplPick.ids.name)
    if (galleryTplPick.ids?.date) setDateId(galleryTplPick.ids.date)
    if (onGalleryConsumed) onGalleryConsumed()
  }, [galleryTplPick])

  const doPreview = useCallback(async (tpl, file, rcp, dt, nId, dId, extra) => {
    if (!tpl && !file) return
    const form = new FormData()
    if (file) form.append('file', file); else form.append('template_name', tpl)
    const fields = buildFields(rcp, dt, nId, dId, extra)
    if (Object.keys(fields).length) form.append('fields', JSON.stringify(fields))
    if (nId) form.append('name_field_id', nId)
    if (dId) form.append('date_field_id', dId)
    setPreviewLoading(true)
    try {
      const r = await certificateApiFetch(`${CERT_API}/api/preview`, { method:'POST', body:form })
      if (r.ok) setPreviewSvg(await r.text())
    } catch(_) {}
    finally { setPreviewLoading(false) }
  }, [])

  const debouncedPreview = useDebounce(doPreview, 380)
  useEffect(() => { debouncedPreview(templateName, svgFile, recipient, date, nameId, dateId, extraFieldValues) },
    [templateName, svgFile, recipient, date, nameId, dateId, extraFieldValues])

  const parseIds = async (file) => {
    const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml')
    const ids = Array.from(doc.querySelectorAll('text[id]')).map(el => ({
      id: el.getAttribute('id'), text: el.textContent.trim().slice(0, 30),
    }))
    setDetectedIds(ids)
    setExtraFieldValues(prev => {
      const next = {}
      ids.forEach(({id}) => { next[id] = prev[id] ?? '' })
      return next
    })
  }

  const selectTemplate = async (val) => {
    if (!val) { setTemplateName(null); setSvgFile(null); return }
    // Plantilla built-in
    const builtin = BUILT_IN_TEMPLATES.find(t => t.file === val)
    if (builtin) {
      setTemplateName(val); setSvgFile(null)
      try {
        const r = await fetch(`${CERT_API}/api/templates/${val}`)
        if (r.ok) {
          const txt = await r.text()
          parseIds(new File([new Blob([txt], {type:'image/svg+xml'})], val))
        }
      } catch(_) {}
      return
    }
    // Plantilla custom de Supabase
    const tpl = templates.find(t => t.id === val)
    if (tpl) {
      const svgText = await loadSvgContent(tpl)
      if (svgText) {
        const file = new File([svgText], tpl.file_name, { type: 'image/svg+xml' })
        setSvgFile(file); setTemplateName(null)
        parseIds(file)
        if (tpl.name_id) setNameId(tpl.name_id)
        if (tpl.date_id) setDateId(tpl.date_id)
      }
    }
  }

  const validate = () => {
    const e = {}
    if (!recipient.trim() || recipient.trim().length < 2) e.recipient = 'Nombre demasiado corto'
    if (!date.trim() || date.trim().length < 4) e.date = 'Ingresa una fecha válida'
    setErrors(e); return Object.keys(e).length === 0
  }

  const generate = async () => {
    if (!validate()) return
    if (!templateName && !svgFile) { setAlert({type:'error',msg:'Seleccioná una plantilla primero.'}); return }
    setLoading(true); setAlert(null)
    const form = new FormData()
    if (svgFile) form.append('file', svgFile); else form.append('template_name', templateName)
    const fields = buildFields(recipient.trim(), date.trim(), nameId.trim(), dateId.trim(), extraFieldValues)
    form.append('fields', JSON.stringify(fields))
    form.append('name_field_id', nameId.trim())
    form.append('date_field_id', dateId.trim())
    form.append('output_format', fmt)
    try {
      const r = await certificateApiFetch(`${CERT_API}/api/generate`, { method:'POST', body:form })
      if (!r.ok) { const d = await r.json(); setAlert({type:'error',msg:d.error||'Error al generar.'}); return }
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `certificado_${recipient.trim().replace(/\s+/g,'_')}.${fmt}`
      a.click(); URL.revokeObjectURL(a.href)
      setAlert({type:'success',msg:`¡Certificado generado para ${recipient.trim()}!`})
    } catch(e) { setAlert({type:'error',msg:`Error: ${e.message}`}) }
    finally { setLoading(false) }
  }

  const idPillStyle = (active) => ({
    padding:'3px 10px', borderRadius:20, fontSize:11, fontFamily:'monospace', cursor:'pointer',
    border:`1px solid ${active ? 'var(--black)' : 'var(--border)'}`,
    background: active ? 'var(--black)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--gray)',
    transition:'all .15s',
  })

  return (
    <div style={{ display:'flex', gap:20 }}>
      {/* Left: wizard */}
      <div style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column', gap:14 }}>

        <Stepper steps={['Plantilla', 'Datos', 'Generar']} current={step} onStep={setStep} />

        {/* ── Paso 1: Plantilla ── */}
        {step === 1 && (<>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="layers" label="Plantilla" />
          <div style={{ marginBottom:12 }}>
            <TemplateCarousel
              templates={templates}
              selectedValue={svgFile ? '' : (templateName || '')}
              svgFile={svgFile}
              onSelect={selectTemplate}
              certApi={CERT_API}
              loadSvgContent={loadSvgContent}
            />
          </div>

          {participants.length > 0 && (
            <div style={{ marginBottom:12 }}>
              {courses.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>
                    Filtrar por curso / taller
                  </label>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                    className="finput" style={{ background:'var(--cream-2)' }}>
                    <option value="">Todos los cursos</option>
                    {(courses.some(c => c.certEnabled)
                      ? courses.filter(c => c.active && c.certEnabled)
                      : courses.filter(c => c.active)
                    ).map(c => <option key={c.id} value={c.id}>{c.short || c.name}</option>)}
                  </select>
                </div>
              )}
              <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>
                Participante {filterCourse && `(${eligibleParticipants.length})`}
              </label>
              <select onChange={e => { const p = participants.find(x => x.id === e.target.value); if (p) setRecipient(p.name) }}
                className="finput" style={{ background:'var(--cream-2)' }}>
                <option value="">— Elegir de la lista —</option>
                {eligibleParticipants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {courses.length > 0 && detectedIds.some(({id}) => /line_fechas|date_issue_[12]/.test(id)) && (
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>
                Curso/Taller (auto-llenar fechas)
              </label>
              <select onChange={e => {
                const c = courses.find(x => x.id === e.target.value)
                if (c && c.start && c.end) {
                  const sf = fmtDateEs(c.start), ef = fmtDateEs(c.end)
                  setExtraFieldValues(prev => ({
                    ...prev,
                    // Para line_fechas (certificado de Corbana)
                    line_fechas: sf && ef ? `Del ${sf} al ${ef}` : '',
                    // Para date_issue_1 y date_issue_2 (si existen)
                    date_issue_1: c.start,
                    date_issue_2: c.end,
                  }))
                }
              }} className="finput" style={{ background:'var(--cream-2)' }}>
                <option value="">— Elegir para auto-llenar —</option>
                {courses.filter(c => c.active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <CertDropZone accept=".svg" title="SVG propio (opcional)" subtitle="Arrastrá o hacé clic"
            icon="upload_file" file={svgFile}
            onFile={f => { setSvgFile(f); if (f) { setTemplateName(null); parseIds(f) } else setDetectedIds([]) }} />
        </div>

        <button onClick={() => setStep(2)} disabled={!hasTemplate}
          className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
          Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
        </button>
        </>)}

        {/* ── Paso 2: Datos ── */}
        {step === 2 && (<>
        {/* IDs detectados */}
        {detectedIds.length > 0 && (
          <div className="card" style={{ padding:16 }}>
            <SectionHeader icon="tag" label="IDs detectados" />
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:6 }}>Campo → Nombre del participante</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
              {detectedIds.map(({id, text}) => (
                <button key={id} onClick={() => setNameId(id)} title={text} style={idPillStyle(nameId === id)}>
                  {id}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:6 }}>Campo → Fecha de otorgación</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {detectedIds.map(({id, text}) => (
                <button key={id} onClick={() => setDateId(id)} title={text} style={idPillStyle(dateId === id)}>
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Datos del certificado */}
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="badge" label="Datos del certificado" />
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>Nombre del participante</label>
            <input value={recipient}
              onChange={e => { setRecipient(e.target.value); setErrors(p => ({...p, recipient:''})) }}
              placeholder="Ej: María González Rojas"
              className="finput"
              style={{ background:'var(--cream-2)', borderColor: errors.recipient ? 'var(--orange-d)' : 'var(--border)' }} />
            {errors.recipient && <p style={{ fontSize:11, color:'var(--orange-d)', marginTop:4 }}>{errors.recipient}</p>}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>Fecha de otorgación</label>
            <input value={date}
              onChange={e => { setDate(e.target.value); setErrors(p => ({...p, date:''})) }}
              placeholder="22 de mayo de 2026"
              className="finput"
              style={{ background:'var(--cream-2)', borderColor: errors.date ? 'var(--orange-d)' : 'var(--border)' }} />
            {errors.date && <p style={{ fontSize:11, color:'var(--orange-d)', marginTop:4 }}>{errors.date}</p>}
          </div>
          {extraIds.length > 0 && (
            <div style={{ paddingTop:10, borderTop:'1px solid var(--cream-3)', display:'flex', flexDirection:'column', gap:10 }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--gray)' }}>
                Campos adicionales
              </p>
              {extraIds.map(({id}) => (
                <div key={id}>
                  <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4, fontFamily:'monospace' }}>{id}</label>
                  <ExtraFieldInput id={id} courses={courses}
                    value={extraFieldValues[id] ?? ''}
                    onChange={v => setExtraFieldValues(prev => ({...prev, [id]: v}))} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setStep(1)}
            className="btn btn-ghost" style={{ flex:'0 0 auto', justifyContent:'center', padding:'11px 16px', fontSize:14 }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
          </button>
          <button onClick={() => { if (validate()) setStep(3) }} disabled={!dataValid}
            className="btn btn-orange" style={{ flex:1, justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
          </button>
        </div>
        </>)}

        {/* ── Paso 3: Generar ── */}
        {step === 3 && (<>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="download" label="Generar certificado" />
          <div style={{ background:'var(--cream-2)', borderRadius:'var(--radius-md)', padding:12, marginBottom:12 }}>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:2 }}>Participante</p>
            <p style={{ fontSize:14, fontWeight:600, color:'var(--black)', marginBottom:8 }}>{recipient.trim() || '—'}</p>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:2 }}>Fecha de otorgación</p>
            <p style={{ fontSize:13, color:'var(--black)' }}>{date.trim() || '—'}</p>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:6 }}>Formato de salida</label>
            <CertFormatToggle value={fmt} onChange={setFmt} />
          </div>
          <button onClick={generate} disabled={loading || !hasTemplate}
            className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            {loading
              ? <><span className="material-symbols-outlined spinner" style={{fontSize:16}}>refresh</span>Procesando…</>
              : <><span className="material-symbols-outlined" style={{fontSize:16}}>download</span>Generar y descargar</>}
          </button>
          <CertAlert type={alert?.type} msg={alert?.msg} onDismiss={() => setAlert(null)} />
        </div>
        <button onClick={() => setStep(2)}
          className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'10px 0', fontSize:14 }}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
        </button>
        </>)}
      </div>

      {/* Right: live preview */}
      <div className="card" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderBottom:'1px solid var(--cream-3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="material-symbols-outlined" style={{ fontSize:15, color:'var(--orange)' }}>preview</span>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--black)' }}>Vista previa en tiempo real</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {previewLoading
              ? <><span className="material-symbols-outlined spinner" style={{fontSize:13, color:'var(--orange)'}}>refresh</span>
                  <span style={{ fontSize:11, color:'var(--gray)' }}>Actualizando…</span></>
              : <><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />
                  <span style={{ fontSize:11, color:'var(--gray)' }}>Actualizado</span></>}
          </div>
        </div>
        <div style={{ flex:1, background:'var(--cream-2)', padding:24,
          display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'auto' }}>
          {previewSvg
            ? <div style={{ background:'var(--white)', borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,.12)',
                width:'100%', maxWidth:700, transition:'opacity .2s', opacity: previewLoading ? .5 : 1 }}
                dangerouslySetInnerHTML={{ __html: svgPreviewMarkup(previewSvg, { style:'display:block;width:100%;height:auto' }) }} />
            : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                height:200, color:'var(--border)', gap:12 }}>
                <span className="material-symbols-outlined" style={{fontSize:48}}>workspace_premium</span>
                <p style={{ fontSize:13, color:'var(--gray)' }}>Seleccioná una plantilla para ver la vista previa</p>
              </div>}
        </div>
      </div>
    </div>
  )
}

/* ── Pestaña Lote CSV ───────────────────────────────────────── */

function CertBatch({ participants = [], courses = [] }) {
  const { templates, loadSvgContent } = useTemplates()
  const [templateName,   setTemplateName]   = useState(null)
  const [svgFile,        setSvgFile]        = useState(null)
  const [csvFile,        setCsvFile]        = useState(null)
  const [csvMeta,        setCsvMeta]        = useState(null)
  const [nameId,         setNameId]         = useState('recipient_name')
  const [dateId,         setDateId]         = useState('issue_date')
  const [fmt,            setFmt]            = useState('pdf')
  const [loading,        setLoading]        = useState(false)
  const [progress,       setProgress]       = useState(0)
  const [alert,          setAlert]          = useState(null)
  const [result,         setResult]         = useState(null)
  const [confetti,       setConfetti]       = useState(0)
  const [filterCourses,  setFilterCourses]  = useState([])   // selección múltiple
  const [filterStatus,   setFilterStatus]   = useState('')    // opcional (Todos por defecto)
  const [filterPayment,  setFilterPayment]  = useState('')    // opcional (Todos por defecto)
  const [certDate,       setCertDate]       = useState(TODAY_ES)
  const [globalDate,     setGlobalDate]     = useState('')
  const [detectedIds,    setDetectedIds]    = useState([])
  const [extraFieldValues, setExtraFieldValues] = useState({})
  const [step,           setStep]           = useState(1)   // wizard: 1=plantilla 2=participantes 3=generar

  const extraIds = detectedIds.filter(({id}) => id !== nameId && id !== dateId)
  const hasTemplate = !!(templateName || svgFile)

  const parseIdsSvg = async (svgTextOrFile) => {
    const text = typeof svgTextOrFile === 'string' ? svgTextOrFile : await svgTextOrFile.text()
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const ids = Array.from(doc.querySelectorAll('text[id]')).map(el => ({
      id: el.getAttribute('id'), text: el.textContent.trim().slice(0, 30),
    }))
    setDetectedIds(ids)
    setExtraFieldValues(prev => {
      const next = {}
      ids.forEach(({id}) => { next[id] = prev[id] ?? '' })
      return next
    })
  }

  const filteredParticipants = participants.filter(p => {
    // Sin cursos seleccionados → no filtra por curso; si hay, basta pertenecer a uno
    const matchCourse  = filterCourses.length === 0 ||
                         (p.courses || []).some(cid => filterCourses.includes(cid))
    const matchStatus  = !filterStatus  || p.status  === filterStatus
    const matchPayment = !filterPayment || p.payment === filterPayment
    return matchCourse && matchStatus && matchPayment
  })

  const toggleCourse = (cid) => setFilterCourses(prev =>
    prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid])

  const applyFilters = () => {
    if (!filteredParticipants.length) return
    const lines = ['nombre,fecha', ...filteredParticipants.map(p => `"${p.name}","${certDate}"`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    handleCsvFile(new File([blob], 'participantes_filtrados.csv', { type: 'text/csv' }))
  }

  // Auto-rellenar campos de fecha y tipo desde el curso seleccionado.
  // Solo aplica cuando hay exactamente UN curso elegido (con varios sería ambiguo).
  useEffect(() => {
    if (filterCourses.length !== 1) return
    const course = courses.find(c => c.id === filterCourses[0])
    if (!course) return
    setExtraFieldValues(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(id => {
        if (/line_curso|tipo_curso/i.test(id)) {
          const _prefix = TIPO_PREFIX[course.type] || 'Curso de'
          next[id] = course.name.startsWith(_prefix) ? course.name : `${_prefix} ${course.name}`
        }
        if (/line_fechas|fecha_rango|date_range/i.test(id)) {
          const s = fmtDateEs(course.start), e = fmtDateEs(course.end)
          if (s || e) next[id] = s && e ? `Del ${s} al ${e}` : s || e
        }
        if (/date_issue_1|fecha_inicio/i.test(id) && course.start)
          next[id] = fmtDateEs(course.start)
        if (/date_issue_2|fecha_fin/i.test(id) && course.end)
          next[id] = fmtDateEs(course.end)
      })
      return next
    })
  }, [filterCourses, courses])

  const handleCsvFile = async (file) => {
    if (!file) { setCsvFile(null); setCsvMeta(null); return }
    setCsvFile(file)
    const lines = (await file.text()).trim().split('\n').filter(l => l.trim())
    setCsvMeta({ rows: lines.length - 1, header: lines[0] })
  }

  const downloadSample = () => {
    const csv = `nombre,fecha\nMaría González Rojas,${TODAY_ES}\nCarlos Méndez Alvarado,${TODAY_ES}\nLaura Jiménez Vega,${TODAY_ES}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
    a.download = 'ejemplo_participantes.csv'; a.click()
  }

  const generate = async () => {
    if (!templateName && !svgFile) { setAlert({type:'error',msg:'Seleccioná una plantilla SVG primero.'}); return }
    if (!csvFile) { setAlert({type:'error',msg:'Cargá un archivo CSV con los participantes.'}); return }
    setLoading(true); setAlert(null); setResult(null); setProgress(10)
    const form = new FormData()
    if (svgFile) form.append('file', svgFile); else form.append('template_name', templateName)
    form.append('csv_file', csvFile)
    form.append('name_field_id', nameId.trim())
    form.append('date_field_id', dateId.trim())
    form.append('output_format', fmt)
    if (globalDate.trim()) form.append('global_date', globalDate.trim())
    const extraFields = {}
    extraIds.forEach(({id}) => { if (extraFieldValues[id]?.trim()) extraFields[id] = extraFieldValues[id].trim() })
    if (Object.keys(extraFields).length) form.append('extra_fields', JSON.stringify(extraFields))
    try {
      setProgress(30)
      const r = await certificateApiFetch(`${CERT_API}/api/generate/batch`, { method:'POST', body:form })
      setProgress(85)
      if (!r.ok) {
        let errMsg = 'Error al generar el lote.'
        try { const d = await r.json(); errMsg = d.error || errMsg } catch(_) {}
        setAlert({type:'error',msg:errMsg})
        return
      }
      const generated = r.headers.get('X-Generated-Count') || '?'
      const errCount  = r.headers.get('X-Error-Count') || '0'
      const total     = r.headers.get('X-Total-Count') || '?'
      const blob = await r.blob()
      if (blob.size < 100) { setAlert({type:'error',msg:'El archivo descargado parece estar vacío. Revisá la consola del servidor.'}); return }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'certificados_lote.zip'
      a.click()
      URL.revokeObjectURL(a.href)
      setProgress(100)
      setResult({generated, errors: errCount, total})
      const errNote = Number(errCount) > 0 ? ` (${errCount} con errores — incluidos en el ZIP como .txt)` : ''
      setAlert({type:'success',msg:`✓ ${generated} de ${total} certificados generados y descargados${errNote}.`})
      if (Number(generated) > 0) setConfetti(c => c + 1)   // celebración 🎉
    } catch(e) {
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setAlert({type:'error',msg:'No se puede conectar con el servidor. Verificá que esté activo.'})
      } else {
        setAlert({type:'error',msg:`Error inesperado: ${e.message}`})
      }
    }
    finally { setLoading(false); setTimeout(() => setProgress(0), 2000) }
  }

  const fInp = { background:'var(--cream-2)', color:'var(--black)', fontSize:12 }

  return (
    <div style={{ maxWidth:760, margin:'0 auto' }}>
      <ConfettiBurst trigger={confetti} />
      <Stepper steps={['Plantilla', 'Participantes', 'Generar']} current={step} onStep={setStep} />

      {/* ── Paso 1: Plantilla + mapeo ── */}
      {step === 1 && (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Plantilla */}
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="layers" label="Plantilla SVG" />
          <div style={{ marginBottom:10 }}>
            <TemplateCarousel
              templates={templates}
              selectedValue={svgFile ? '' : (templateName || '')}
              svgFile={svgFile}
              onSelect={async val => {
                if (!val) { setTemplateName(null); setSvgFile(null); setDetectedIds([]); return }
                const builtin = BUILT_IN_TEMPLATES.find(t => t.file === val)
                if (builtin) {
                  setTemplateName(val); setSvgFile(null)
                  try { const r = await fetch(`${CERT_API}/api/templates/${val}`); if (r.ok) parseIdsSvg(await r.text()) } catch(_) {}
                  return
                }
                const tpl = templates.find(t => t.id === val)
                if (tpl) {
                  const svgText = await loadSvgContent(tpl)
                  if (svgText) { const f = new File([svgText], tpl.file_name, { type:'image/svg+xml' }); setSvgFile(f); setTemplateName(null); parseIdsSvg(svgText) }
                }
              }}
              certApi={CERT_API}
              loadSvgContent={loadSvgContent}
            />
          </div>
          <CertDropZone accept=".svg" title="O subir SVG propio" subtitle="Opcional"
            icon="upload_file" file={svgFile} onFile={f => {
              setSvgFile(f); if (f) { setTemplateName(null); parseIdsSvg(f) } else setDetectedIds([])
            }} />
        </div>

        {/* Mapeo de IDs */}
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="alt_route" label="Mapeo de campos" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>ID → Nombre</label>
              <input value={nameId} onChange={e => setNameId(e.target.value)}
                className="finput" style={{ background:'var(--cream-2)', fontFamily:'monospace', fontSize:11 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>ID → Fecha</label>
              <input value={dateId} onChange={e => setDateId(e.target.value)}
                className="finput" style={{ background:'var(--cream-2)', fontFamily:'monospace', fontSize:11 }} />
            </div>
          </div>
        </div>

        <button onClick={() => setStep(2)} disabled={!hasTemplate}
          className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
          Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
        </button>
      </div>
      )}

      {/* ── Paso 2: Participantes / CSV ── */}
      {step === 2 && (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Filtros */}
        {participants.length > 0 && (
          <div className="card" style={{ padding:16 }}>
            <SectionHeader icon="filter_list" label="Filtrar participantes" />

            {/* Cursos — selección múltiple por chips */}
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <label style={{ fontSize:11, color:'var(--gray)' }}>
                  Cursos / talleres {filterCourses.length > 0 && `(${filterCourses.length} seleccionado${filterCourses.length !== 1 ? 's' : ''})`}
                </label>
                {filterCourses.length > 0 && (
                  <button onClick={() => setFilterCourses([])}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:11,
                      color:'var(--orange)', fontWeight:600 }}>
                    Limpiar
                  </button>
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(courses.some(c => c.certEnabled)
                  ? courses.filter(c => c.active && c.certEnabled)
                  : courses.filter(c => c.active)
                ).map(c => {
                  const on = filterCourses.includes(c.id)
                  return (
                    <button key={c.id} onClick={() => toggleCourse(c.id)} title={c.name}
                      style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        padding:'4px 10px', borderRadius:999, cursor:'pointer',
                        fontSize:12, fontWeight: on ? 600 : 400,
                        border:`1px solid ${on ? 'var(--orange)' : 'var(--border)'}`,
                        background: on ? 'var(--alert-warm-bg)' : 'var(--cream-2)',
                        color: on ? 'var(--orange-d)' : 'var(--gray)',
                        transition:'all .15s',
                      }}>
                      {on && <span className="material-symbols-outlined" style={{fontSize:13}}>check</span>}
                      {c.short || c.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>Estado</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="finput" style={fInp}>
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>Pago</label>
                <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
                  className="finput" style={fInp}>
                  <option value="">Todos</option>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>Fecha del certificado</label>
              <input value={certDate} onChange={e => setCertDate(e.target.value)}
                className="finput" style={fInp} placeholder="22 de mayo de 2026" />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:6 }}>
              <span style={{ fontSize:12, fontWeight:600, color: filteredParticipants.length ? 'var(--black)' : 'var(--gray)' }}>
                {filteredParticipants.length} participante{filteredParticipants.length !== 1 ? 's' : ''} coinciden
              </span>
              <button onClick={applyFilters} disabled={!filteredParticipants.length}
                className="btn btn-orange btn-sm">
                <span className="material-symbols-outlined" style={{fontSize:14}}>group</span>
                Usar estos {filteredParticipants.length}
              </button>
            </div>
          </div>
        )}

        <CertDropZone accept=".csv" title="Arrastrá tu archivo CSV aquí"
          subtitle="Columnas requeridas: nombre, fecha — límite 200 registros"
          icon="upload_file" file={csvFile} onFile={handleCsvFile} />

        {/* Requisitos */}
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="table_view" label="Requisitos del CSV" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[{col:'nombre',ej:'Juan Pérez'},{col:'fecha',ej:TODAY_ES}].map(c => (
              <div key={c.col} style={{ background:'var(--cream-2)', borderRadius:'var(--radius-md)',
                padding:'10px 12px', border:'1px solid var(--border)' }}>
                <p style={{ fontSize:10, color:'var(--gray)', marginBottom:2 }}>Columna requerida</p>
                <p style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'var(--black)' }}>{c.col}</p>
                <p style={{ fontSize:10, color:'var(--gray)', fontStyle:'italic', marginTop:2 }}>Ej: {c.ej}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize:11, color:'var(--gray)', marginBottom:8 }}>
            También acepta: <code>name</code>, <code>participante</code>, <code>date</code>, <code>issue_date</code>
          </p>
          <button onClick={downloadSample} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
            fontWeight:500, color:'var(--orange)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <span className="material-symbols-outlined" style={{fontSize:14}}>download</span> Descargar CSV de ejemplo
          </button>
        </div>

        {csvMeta && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="card" style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:11, color:'var(--gray)' }}>Filas detectadas</p>
              <p style={{ fontSize:28, fontWeight:700, color:'var(--black)', marginTop:2 }}>{csvMeta.rows}</p>
            </div>
            <div className="card" style={{ padding:'14px 16px', overflow:'hidden' }}>
              <p style={{ fontSize:11, color:'var(--gray)' }}>Encabezado CSV</p>
              <p style={{ fontSize:11, fontFamily:'monospace', color:'var(--black)', marginTop:4,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{csvMeta.header}</p>
            </div>
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setStep(1)}
            className="btn btn-ghost" style={{ flex:'0 0 auto', justifyContent:'center', padding:'11px 16px', fontSize:14 }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
          </button>
          <button onClick={() => setStep(3)} disabled={!csvFile}
            className="btn btn-orange" style={{ flex:1, justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
          </button>
        </div>
      </div>
      )}

      {/* ── Paso 3: Generar ── */}
      {step === 3 && (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Configuración de salida */}
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="tune" label="Configuración de salida" />
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>
              Fecha global <span style={{ fontWeight:400 }}>(sobreescribe la del CSV)</span>
            </label>
            <input value={globalDate} onChange={e => setGlobalDate(e.target.value)}
              placeholder={`Ej: ${TODAY_ES}`}
              className="finput" style={{ background:'var(--cream-2)', fontSize:11 }} />
          </div>
          {extraIds.length > 0 && (
            <div style={{ paddingTop:10, borderTop:'1px solid var(--cream-3)', display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--gray)' }}>
                Campos adicionales
              </p>
              {extraIds.map(({id}) => (
                <div key={id}>
                  <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:3, fontFamily:'monospace' }}>{id}</label>
                  <ExtraFieldInput id={id} size="xs" courses={courses}
                    value={extraFieldValues[id] ?? ''}
                    onChange={v => setExtraFieldValues(prev => ({...prev, [id]: v}))} />
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:10 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:6 }}>Formato</label>
            <CertFormatToggle value={fmt} onChange={setFmt} />
          </div>
        </div>

        {/* Generar ZIP */}
        <div style={{ background:'var(--alert-warm-bg)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-lg)', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:38, height:38, background:'var(--orange)', borderRadius:'var(--radius-md)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span className="material-symbols-outlined" style={{fontSize:18, color:'#fff'}}>folder_zip</span>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--black)' }}>
                {csvMeta ? `${csvMeta.rows} registros listos` : 'Sin CSV cargado'}
              </p>
              <p style={{ fontSize:11, color:'var(--gray)' }}>
                {(templateName||svgFile) ? '✓ Plantilla seleccionada' : 'Falta seleccionar plantilla'}
              </p>
            </div>
          </div>
          {progress > 0 && (
            <div style={{ height:4, borderRadius:20, background:'var(--cream-3)', overflow:'hidden', marginBottom:12 }}>
              <div style={{ height:'100%', background:'var(--orange)', borderRadius:20, transition:'width .5s', width:`${progress}%` }} />
            </div>
          )}
          <button onClick={generate} disabled={loading || (!templateName && !svgFile) || !csvFile}
            className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            {loading
              ? <><span className="material-symbols-outlined spinner" style={{fontSize:16}}>refresh</span>Procesando…</>
              : <><span className="material-symbols-outlined" style={{fontSize:16}}>folder_zip</span>Generar ZIP</>}
          </button>
        </div>

        {result && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:'var(--radius-lg)',
              padding:'12px 16px', textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--green)' }}>Generados</p>
              <p style={{ fontSize:24, fontWeight:700, color:'var(--green)' }}>{result.generated}</p>
            </div>
            <div style={{ background: Number(result.errors) > 0 ? 'var(--row-exp-bg)' : 'var(--cream-2)',
              border:`1px solid ${Number(result.errors) > 0 ? 'var(--orange-d)' : 'var(--border)'}`,
              borderRadius:'var(--radius-lg)', padding:'12px 16px', textAlign:'center' }}>
              <p style={{ fontSize:11, color: Number(result.errors) > 0 ? 'var(--orange-d)' : 'var(--gray)' }}>Errores</p>
              <p style={{ fontSize:24, fontWeight:700, color: Number(result.errors) > 0 ? 'var(--orange-d)' : 'var(--black)' }}>{result.errors}</p>
            </div>
          </div>
        )}
        <CertAlert type={alert?.type} msg={alert?.msg} onDismiss={() => setAlert(null)} />

        <button onClick={() => setStep(2)}
          className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'10px 0', fontSize:14 }}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
        </button>
      </div>
      )}
    </div>
  )
}

/* ── Tabla de referencia de campos SVG ──────────────────────── */

const FIELD_REFERENCE = [
  { id:'recipient_name', csv:'nombre / name', desc:'Nombre completo del participante' },
  { id:'issue_date',     csv:'fecha / date',  desc:'Fecha de emisión del certificado' },
  { id:'line_curso',     csv:'—',             desc:'Nombre del curso/taller (se muestra en bold después de "...el")' },
  { id:'line_horas',     csv:'horas',         desc:'Horas del curso (ej: "40" → aparece en "con un total de 40 impartidas")' },
  { id:'line_fechas',    csv:'—',             desc:'Rango de fechas del curso — se completa con los dos calendarios' },
  { id:'course_name_1',  csv:'tipo_curso',    desc:'Prefijo del tipo: "Taller de" / "Curso de" (plantillas antiguas)' },
  { id:'course_name_2',  csv:'nombre_curso',  desc:'Nombre del curso sin prefijo (plantillas antiguas)' },
  { id:'date_issue_1',   csv:'fecha_inicio',  desc:'Fecha de inicio por separado (plantillas antiguas)' },
  { id:'date_issue_2',   csv:'fecha_fin',     desc:'Fecha de fin por separado (plantillas antiguas)' },
]

function CertFieldsReference() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom:20, overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className="material-symbols-outlined" style={{fontSize:15, color:'var(--orange)'}}>table_chart</span>
          <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--gray)' }}>
            Referencia de campos SVG
          </span>
          <span style={{ fontSize:11, color:'var(--gray)', opacity:.7 }}>— IDs y columnas CSV</span>
        </div>
        <span className="material-symbols-outlined" style={{fontSize:16, color:'var(--gray)',
          transition:'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)'}}>
          expand_more
        </span>
      </button>

      {open && (
        <div style={{ borderTop:'1px solid var(--cream-3)', overflowX:'auto' }}>
          <table className="ttable" style={{ minWidth:'unset' }}>
            <thead>
              <tr>
                {['Campo SVG (id=)', 'CSV sugerido', 'Descripción'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELD_REFERENCE.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code style={{ fontFamily:'monospace', fontWeight:700, fontSize:11,
                      color:'var(--orange)', background:'var(--alert-warm-bg)',
                      padding:'2px 6px', borderRadius:4 }}>{row.id}</code>
                  </td>
                  <td style={{ fontFamily:'monospace', fontSize:11 }}>{row.csv}</td>
                  <td style={{ fontSize:12 }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Vista principal ────────────────────────────────────────── */

export default function CertificatesView({ participants, courses = [], galleryTplPick, onGalleryConsumed }) {
  const [certTab,     setCertTab]     = useState('individual')
  const [apiOk,       setApiOk]       = useState(null)
  const [aiAvailable, setAiAvailable] = useState(false)

  useEffect(() => {
    fetch(`${CERT_API}/api/health`)
      .then(r => r.ok ? setApiOk(true) : setApiOk(false))
      .catch(() => setApiOk(false))
    fetch(`${CERT_API}/api/ai/status`)
      .then(r => r.ok ? r.json() : {available:false})
      .then(d => setAiAvailable(d.available))
      .catch(() => {})
  }, [])

  const tabs = [
    { id:'individual', icon:'person',      label:'Individual'   },
    { id:'batch',      icon:'upload_file', label:'Lote CSV'     },
  ]

  const apiBadge = apiOk === true
    ? { bg:'var(--green-l)', bc:'var(--green)', tc:'var(--green)', dot:'var(--green)' }
    : apiOk === false
    ? { bg:'var(--row-exp-bg)', bc:'var(--orange-d)', tc:'var(--orange-d)', dot:'var(--orange-d)' }
    : { bg:'var(--cream-2)', bc:'var(--border)', tc:'var(--gray)', dot:'var(--gray)' }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, color:'var(--black)',
            display:'flex', alignItems:'center', gap:8 }}>
            <span className="material-symbols-outlined" style={{ color:'var(--orange)' }}>workspace_premium</span>
            Generador de Certificados
          </h2>
          <p style={{ fontSize:13, color:'var(--gray)', marginTop:4 }}>Emití certificados digitales para los participantes de los programas</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20,
            fontSize:12, fontWeight:600, border:`1px solid ${apiBadge.bc}`,
            background:apiBadge.bg, color:apiBadge.tc }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:apiBadge.dot, display:'inline-block' }} />
            {apiOk === null ? 'Verificando…' : apiOk ? 'API activa' : 'API no disponible'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20,
            fontSize:12, fontWeight:600,
            border: aiAvailable ? '1px solid #7C3AED' : '1px solid var(--border)',
            background: aiAvailable ? '#F5F3FF' : 'var(--cream-2)',
            color: aiAvailable ? '#6D28D9' : 'var(--gray)' }}>
            <span className="material-symbols-outlined" style={{fontSize:13}}>{aiAvailable ? 'auto_awesome' : 'key_off'}</span>
            {aiAvailable ? 'Claude activo' : 'IA inactiva'}
          </div>
        </div>
      </div>

      {apiOk === false && (
        <div style={{ marginBottom:20, display:'flex', alignItems:'center', gap:8, padding:'12px 16px',
          background:'var(--row-exp-bg)', border:'1px solid var(--orange-d)', borderRadius:'var(--radius-lg)',
          fontSize:13, color:'var(--orange-d)' }}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>warning</span>
          El servidor Flask no está disponible. Ejecutá
          <code style={{ margin:'0 6px', background:'var(--cream-3)', padding:'2px 6px', borderRadius:4, fontFamily:'monospace' }}>cd backend && python3 app.py</code>
          para iniciarlo.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, padding:4, background:'var(--cream-2)',
        borderRadius:'var(--radius-lg)', marginBottom:20, width:'fit-content',
        border:'1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setCertTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
              borderRadius:'var(--radius-md)', fontSize:13, fontWeight:500, cursor:'pointer',
              border:'none', transition:'all .15s', fontFamily:'var(--font-body)',
              background: certTab === t.id ? 'var(--white)' : 'transparent',
              color:      certTab === t.id ? 'var(--black)' : 'var(--gray)',
              boxShadow:  certTab === t.id ? 'var(--shadow-card)' : 'none',
            }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <CertFieldsReference />

      {certTab === 'individual' && <CertIndividual participants={participants} courses={courses} galleryTplPick={galleryTplPick} onGalleryConsumed={onGalleryConsumed} />}
      {certTab === 'batch'      && <CertBatch participants={participants} courses={courses} />}
    </div>
  )
}
