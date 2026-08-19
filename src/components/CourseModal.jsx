// ============================================================
//  CourseModal.jsx — React JSX
//  Modal para crear / editar un curso o taller.
// ============================================================

import { useState } from 'react'
import { Modal } from './UI.jsx'
import {
  COURSE_TYPES, COURSE_PLATFORMS, COURSE_MODALITIES, fmtPrice,
} from '../data/courses.js'

const EMPTY = {
  name:'', short:'', type:'curso', platform:'TEC Digital',
  start:'', end:'', capacity:'30', price:'', modalidad:'Asincrónico',
  code:'', description:'', active:true, accessDays:'45', certEnabled:false,
}

function genCode(name, type) {
  const prefix = (type === 'taller' ? 'TAL' : 'CUR')
  const slug   = name.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9]/g,'').slice(0,6)
  const year   = new Date().getFullYear()
  return `${prefix}${slug}${year}`
}

export default function CourseModal({ course, onSave, onClose }) {
  const [form, setForm]     = useState(course ? { ...course, capacity: String(course.capacity), accessDays: String(course.accessDays ?? 45), certEnabled: course.certEnabled ?? false } : { ...EMPTY })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Requerido'
    if (!form.start)        e.start = 'Requerido'
    if (!form.end)          e.end   = 'Requerido'
    if (form.start && form.end && form.end < form.start) e.end = 'Debe ser posterior al inicio'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const result = await onSave({
        ...form,
        short:    form.short.trim() || form.name.slice(0, 24),
        code:     form.code.trim()  || genCode(form.name, form.type),
        capacity: Number(form.capacity) || 30,
        accessDays: Number(form.accessDays) || 45,
      })
      if (!result?.error) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} width={580}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <h3 className="h2">
          <i className="ti ti-book" style={{ color:'var(--orange)', marginRight:8, fontSize:18 }}/>
          {course ? 'Editar' : 'Nuevo'} {form.type}
        </h3>
        <button onClick={onClose}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray)', fontSize:18 }}>
          <i className="ti ti-x"/>
        </button>
      </div>

      {/* Tipo */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {COURSE_TYPES.map(t => (
          <span key={t} onClick={() => f('type', t)}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:500,
              cursor:'pointer', transition:'all .15s',
              background: form.type === t ? 'var(--black)' : 'var(--cream-2)',
              color:      form.type === t ? 'var(--cream)' : 'var(--gray)',
              border:     `1px solid ${form.type === t ? 'var(--black)' : 'var(--border)'}` }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </span>
        ))}
      </div>

      {/* Nombre + nombre corto */}
      <div className="modal-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div style={{ gridColumn:'1/-1' }}>
          <label className="text-sm text-muted" htmlFor="cm-name" style={{ display:'block', marginBottom:4 }}>
            Nombre completo *
          </label>
          <input id="cm-name" className="finput" value={form.name}
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'cm-name-err' : undefined}
            onChange={e => {
              f('name', e.target.value)
              if (!form.short || form.short === form.name.slice(0,24))
                f('short', e.target.value.slice(0,24))
            }}/>
          {errors.name && <span id="cm-name-err" style={{ fontSize:11, color:'var(--orange-d)' }}>{errors.name}</span>}
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>
            Nombre corto <span style={{ color:'var(--gray)' }}>(para tablas)</span>
          </label>
          <input className="finput" value={form.short} maxLength={28}
            onChange={e => f('short', e.target.value)}
            placeholder="Máx. 28 caracteres"/>
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>
            Código <span style={{ color:'var(--gray)' }}>(se genera automáticamente)</span>
          </label>
          <input className="finput" value={form.code}
            onChange={e => f('code', e.target.value.toUpperCase())}
            placeholder={genCode(form.name||'CURSO', form.type)}
            style={{ fontFamily:'monospace' }}/>
        </div>
      </div>

      {/* Fechas + capacidad + precio */}
      <div className="modal-grid-4" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label className="text-sm text-muted" htmlFor="cm-start" style={{ display:'block', marginBottom:4 }}>Inicio *</label>
          <input id="cm-start" className="finput" type="date" value={form.start} onChange={e => f('start', e.target.value)}
            aria-invalid={!!errors.start} aria-describedby={errors.start ? 'cm-start-err' : undefined}/>
          {errors.start && <span id="cm-start-err" style={{ fontSize:11, color:'var(--orange-d)' }}>{errors.start}</span>}
        </div>
        <div>
          <label className="text-sm text-muted" htmlFor="cm-end" style={{ display:'block', marginBottom:4 }}>Fin *</label>
          <input id="cm-end" className="finput" type="date" value={form.end} onChange={e => f('end', e.target.value)}
            aria-invalid={!!errors.end} aria-describedby={errors.end ? 'cm-end-err' : undefined}/>
          {errors.end && <span id="cm-end-err" style={{ fontSize:11, color:'var(--orange-d)' }}>{errors.end}</span>}
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Capacidad</label>
          <input className="finput" type="number" min="1" value={form.capacity}
            onChange={e => f('capacity', e.target.value)}/>
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Días de acceso</label>
          <input className="finput" type="number" min="1" max="365" value={form.accessDays}
            onChange={e => f('accessDays', e.target.value)}
            placeholder="45"/>
          {form.accessDays && (
            <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>
              {Number(form.accessDays) >= 7 && Number(form.accessDays) % 7 === 0
                ? `${Number(form.accessDays) / 7} semana${Number(form.accessDays)/7!==1?'s':''}`
                : `${form.accessDays} días`}
            </div>
          )}
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>
            Inversión (₡, sin puntos)
          </label>
          <input className="finput" type="number" min="0" value={form.price}
            onChange={e => f('price', e.target.value)}
            placeholder="ej. 22440"/>
          {form.price && (
            <div style={{ fontSize:10, color:'var(--gray)', marginTop:2 }}>
              {fmtPrice(form.price)} IVAI
            </div>
          )}
        </div>
      </div>

      {/* Plataforma + modalidad */}
      <div className="modal-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Plataforma</label>
          <select className="finput" value={form.platform} onChange={e => f('platform', e.target.value)}>
            {COURSE_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Modalidad</label>
          <select className="finput" value={form.modalidad} onChange={e => f('modalidad', e.target.value)}>
            {COURSE_MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Descripción */}
      <div style={{ marginBottom:14 }}>
        <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>
          Descripción / objetivo del curso
        </label>
        <textarea className="finput" rows={3} value={form.description}
          onChange={e => f('description', e.target.value)}
          style={{ resize:'vertical' }}
          placeholder="Breve descripción del contenido y objetivos..."/>
      </div>

      {/* Estado activo + certificados */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10,
          padding:'10px 12px', background:'var(--cream-2)', borderRadius:8 }}>
          <input type="checkbox" id="active-check" checked={form.active}
            onChange={e => f('active', e.target.checked)}
            style={{ width:14, height:14, cursor:'pointer' }}/>
          <label htmlFor="active-check" style={{ fontSize:12, cursor:'pointer' }}>
            Curso activo — visible para inscripciones y asignaciones
          </label>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10,
          padding:'10px 12px', background:'var(--cream-2)', borderRadius:8 }}>
          <input type="checkbox" id="cert-check" checked={form.certEnabled}
            onChange={e => f('certEnabled', e.target.checked)}
            style={{ width:14, height:14, cursor:'pointer' }}/>
          <label htmlFor="cert-check" style={{ fontSize:12, cursor:'pointer' }}>
            <i className="ti ti-certificate" style={{ marginRight:5, color:'var(--orange)' }}/>
            Habilitado para generación de certificados
          </label>
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-orange" onClick={handleSave} disabled={saving}>
          <i className={`ti ti-${saving ? 'loader-2' : 'check'}`}/> {saving ? 'Guardando…' : `Guardar ${form.type}`}
        </button>
      </div>
    </Modal>
  )
}
