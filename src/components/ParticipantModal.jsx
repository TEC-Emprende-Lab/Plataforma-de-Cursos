// ============================================================
//  ParticipantModal.jsx — React JSX
//  Modal crear / editar participante. Recibe courses dinámicos.
// ============================================================

import { useState }       from 'react'
import { Modal }          from './UI.jsx'
import { AccessBar }      from './UI.jsx'
import { TagSelector }    from './TagSelector.jsx'
import { todayISO, ACCESS_DAYS } from '../utils/time.js'

const EMPTY_FORM = {
  name:'', cedula:'', email:'', phone:'',
  status:'activo', payment:'pagado', access:true,
  fecha:todayISO(), courses:[], tags:[], notes:'',
}

/** Resuelve los días de acceso según los cursos seleccionados en el form */
function resolveAccessDays(selectedCourseIds, courses) {
  if (!selectedCourseIds?.length || !courses?.length) return ACCESS_DAYS
  const enrolled = courses.filter(c => selectedCourseIds.includes(c.id))
  if (!enrolled.length) return ACCESS_DAYS
  return Math.max(...enrolled.map(c => Number(c.accessDays) || ACCESS_DAYS))
}

export default function ParticipantModal({ participant, courses, tags, onSave, onClose }) {
  const [form, setForm]     = useState(participant ? { ...participant } : { ...EMPTY_FORM })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const f = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const toggleCourse = cid => f('courses',
    form.courses.includes(cid)
      ? form.courses.filter(x => x !== cid)
      : [...form.courses, cid]
  )
  const toggleTag = tid => f('tags',
    (form.tags||[]).includes(tid)
      ? form.tags.filter(x => x !== tid)
      : [...(form.tags||[]), tid]
  )

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Requerido'
    if (!form.email.trim()) e.email = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const result = await onSave(form)
      if (!result?.error) onClose()
    } finally {
      setSaving(false)
    }
  }

  // Solo mostrar cursos activos
  const activeCourses = courses.filter(c => c.active)

  // Días de acceso según los cursos actualmente seleccionados en el form
  const accessDays = resolveAccessDays(form.courses, courses)

  return (
    <Modal onClose={onClose} width={560}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <h3 className="h2">{participant ? 'Editar participante' : 'Nuevo participante'}</h3>
        <button onClick={onClose}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray)', fontSize:18 }}>
          <i className="ti ti-x"/>
        </button>
      </div>

      {/* Datos personales */}
      <div className="modal-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label className="text-sm text-muted" htmlFor="pm-name" style={{ display:'block', marginBottom:4 }}>Nombre completo *</label>
          <input id="pm-name" className="finput" value={form.name} onChange={e => f('name', e.target.value)}
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'pm-name-err' : undefined}/>
          {errors.name && <span id="pm-name-err" style={{ fontSize:11, color:'var(--orange-d)' }}>{errors.name}</span>}
        </div>
        <div>
          <label className="text-sm text-muted" htmlFor="pm-cedula" style={{ display:'block', marginBottom:4 }}>Cédula</label>
          <input id="pm-cedula" className="finput" value={form.cedula || ''}
            onChange={e => f('cedula', e.target.value)}
            inputMode="numeric" placeholder="1-0234-0567"/>
          <p className="text-xs text-muted" style={{ marginTop:4 }}>
            Escríbela completa, <strong>con todos los ceros</strong> (ej: 1-0234-0567).
          </p>
        </div>
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Teléfono</label>
          <input className="finput" value={form.phone} onChange={e => f('phone', e.target.value)}/>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label className="text-sm text-muted" htmlFor="pm-email" style={{ display:'block', marginBottom:4 }}>Correo electrónico *</label>
          <input id="pm-email" className="finput" type="email" value={form.email} onChange={e => f('email', e.target.value)}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? 'pm-email-err' : undefined}/>
          {errors.email && <span id="pm-email-err" style={{ fontSize:11, color:'var(--orange-d)' }}>{errors.email}</span>}
        </div>
      </div>

      {/* Estado / Pago / Acceso */}
      <div className="modal-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
        {[
          ['status',  'Estado',  [['activo','Activo'],['inactivo','Inactivo']]],
          ['payment', 'Pago',    [['pagado','Pagado'],['pendiente','Pendiente']]],
        ].map(([key, label, opts]) => (
          <div key={key}>
            <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>{label}</label>
            <select className="finput" value={form[key]} onChange={e => f(key, e.target.value)}>
              {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Acceso</label>
          <select className="finput" value={form.access ? 'si' : 'no'}
            onChange={e => f('access', e.target.value === 'si')}>
            <option value="si">Con acceso</option>
            <option value="no">Sin acceso</option>
          </select>
        </div>
      </div>

      {/* Cursos dinámicos — van ANTES de la fecha para que accessDays esté actualizado */}
      <div style={{ marginBottom:14 }}>
        <label className="text-sm text-muted" style={{ display:'block', marginBottom:8 }}>
          Cursos / talleres inscritos
        </label>
        {activeCourses.length === 0 ? (
          <p className="text-sm text-muted">No hay cursos activos. Creá uno en la sección Cursos.</p>
        ) : (
          <div>
            {activeCourses.map(c => (
              <span key={c.id}
                onClick={() => toggleCourse(c.id)}
                className={`pill${form.courses.includes(c.id) ? ' sel' : ''}`}>
                {c.short}
                {c.accessDays && c.accessDays !== 45
                  ? <span style={{ fontSize:10, opacity:.7, marginLeft:4 }}>({c.accessDays}d)</span>
                  : null}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Fecha + barra en vivo */}
      <div style={{ marginBottom:14 }}>
        <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>
          Fecha de ingreso
          <span style={{ marginLeft:8, color:'var(--orange)', fontSize:11 }}>
            (acceso por {accessDays} días
            {accessDays % 7 === 0 ? ` · ${accessDays/7} semana${accessDays/7!==1?'s':''}` : ''})
          </span>
        </label>
        <input className="finput" type="date" value={form.fecha}
          onChange={e => f('fecha', e.target.value)} style={{ maxWidth:200 }}/>
        {form.fecha && <div style={{ marginTop:10 }}><AccessBar fecha={form.fecha} days={accessDays}/></div>}
      </div>

      {/* Etiquetas */}
      <TagSelector tags={tags} selected={form.tags||[]} onChange={toggleTag}/>

      {/* Notas */}
      <div style={{ marginBottom:4 }}>
        <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Notas internas</label>
        <textarea className="finput" rows={2} value={form.notes}
          onChange={e => f('notes', e.target.value)} style={{ resize:'vertical' }}/>
      </div>

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-orange" onClick={handleSave} disabled={saving}>
          <i className={`ti ti-${saving ? 'loader-2' : 'check'}`}/> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}
