// ============================================================
//  CoursesView.jsx — React JSX
//  Vista de cursos/talleres con CRUD completo.
// ============================================================

import { useState } from 'react'
import { fmtDate }    from '../utils/time.js'
import { fmtPrice }   from '../data/courses.js'
import { Badge, ConfirmDialog } from './UI.jsx'
import CourseModal    from './CourseModal.jsx'

const VALID_TYPES = ['curso','taller','seminario','bootcamp','charla']

function TypeBadge({ type }) {
  const t = VALID_TYPES.includes(type) ? type : 'curso'
  return (
    <span className={`type-badge type-badge-${t}`}>
      {type?.charAt(0).toUpperCase() + type?.slice(1)}
    </span>
  )
}

export default function CoursesView({ courses, participants, setView, onAdd, onUpdate, onDelete, onToggleActive }) {
  const [modal,      setModal]      = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [search,     setSearch]     = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)   // curso a eliminar

  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    const matchT = filterType === 'all' || c.type === filterType
    const matchA = showInactive ? true : c.active
    return matchQ && matchT && matchA
  })

  const openNew  = ()  => { setEditTarget(null); setModal(true) }
  const openEdit = (c) => { setEditTarget(c);    setModal(true) }

  const handleSave = form =>
    editTarget ? onUpdate(editTarget.id, form) : onAdd(form)

  const enrolled = (cid) => participants.filter(p => p.courses.includes(cid)).length

  return (
    <div>
      {modal && (
        <CourseModal
          course={editTarget}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Eliminar programa"
          message={`¿Seguro que querés eliminar "${confirmTarget.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => onDelete(confirmTarget.id)}
          onClose={() => setConfirmTarget(null)}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="h1">Cursos y Talleres</h2>
          <p className="text-muted" style={{ fontSize:13, marginTop:3 }}>
            {courses.filter(c=>c.active).length} activos · {courses.filter(c=>!c.active).length} inactivos
          </p>
        </div>
        <button className="btn btn-orange" onClick={openNew}>
          <i className="ti ti-plus"/> Nuevo curso / taller
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-num">{courses.length}</div>
          <div className="stat-label">Total programas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color:'var(--orange)' }}>
            {courses.filter(c=>c.type==='taller').length}
          </div>
          <div className="stat-label">Talleres</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color:'var(--blue,#185FA5)' }}>
            {courses.filter(c=>c.type==='curso').length}
          </div>
          <div className="stat-label">Cursos</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">
            {courses.reduce((sum,c) => sum + enrolled(c.id), 0)}
          </div>
          <div className="stat-label">Inscripciones totales</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-row" style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input className="finput" placeholder="Buscar por nombre o código..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:180 }}/>
        <select className="finput" style={{ width:'auto' }}
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Todos los tipos</option>
          <option value="curso">Cursos</option>
          <option value="taller">Talleres</option>
          <option value="seminario">Seminarios</option>
          <option value="bootcamp">Bootcamps</option>
          <option value="charla">Charlas</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
          color:'var(--gray)', cursor:'pointer', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}/>
          Mostrar inactivos
        </label>
      </div>

      {/* Lista de cursos */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray)' }}>
          No se encontraron programas. {!showInactive && 'Activá "Mostrar inactivos" para ver todos.'}
        </div>
      ) : (
       <div className="courses-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(440px, 1fr))', gap:14 }}>
      {filtered.map(c => {
        const enr = enrolled(c.id)
        const pct = Math.round(enr / c.capacity * 100)
        const ps  = participants.filter(p => p.courses.includes(c.id))

        return (
          <div key={c.id} className="card"
            style={{ padding:'18px 20px',
              opacity: c.active ? 1 : .55, transition:'opacity .2s' }}>

            {/* Header de la card */}
            <div className="course-card-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <TypeBadge type={c.type}/>
                  {!c.active && (
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20,
                      background:'var(--cream-3)', color:'var(--gray)', border:'1px solid var(--border)' }}>
                      Inactivo
                    </span>
                  )}
                </div>
                <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:400, marginBottom:4 }}>
                  {c.name}
                </h3>
                <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:12, color:'var(--gray)' }}>
                  {c.start && <span><i className="ti ti-calendar" style={{ fontSize:12, verticalAlign:-1, marginRight:3 }}/>{fmtDate(c.start)} → {fmtDate(c.end)}</span>}
                  <span><i className="ti ti-device-laptop" style={{ fontSize:12, verticalAlign:-1, marginRight:3 }}/>{c.platform}</span>
                  <span><i className="ti ti-credit-card" style={{ fontSize:12, verticalAlign:-1, marginRight:3 }}/>{fmtPrice(c.price)} IVAI</span>
                  <span style={{ padding:'2px 8px', borderRadius:20, background:'var(--cream-3)', color:'var(--gray)' }}>
                    {c.modalidad}
                  </span>
                </div>
                {c.description && (
                  <p style={{ fontSize:12, color:'var(--gray)', marginTop:6, lineHeight:1.5 }}>
                    {c.description}
                  </p>
                )}
              </div>

              {/* Código + acciones */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, marginLeft:16, flexShrink:0 }}>
                <span style={{ fontFamily:'monospace', background:'var(--cream-2)',
                  border:'1px dashed var(--border)', padding:'4px 12px', borderRadius:8,
                  fontSize:12, color:'var(--gray)' }}>
                  {c.code}
                </span>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn-icon" onClick={() => openEdit(c)} title="Editar">
                    <i className="ti ti-edit"/> Editar
                  </button>
                  <button className="btn-icon"
                    onClick={() => onToggleActive(c.id)}
                    title={c.active ? 'Desactivar' : 'Activar'}
                    style={{ color: c.active ? 'var(--orange)' : 'var(--gray)' }}>
                    <i className={`ti ti-${c.active ? 'eye-off' : 'eye'}`}/>
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn-icon danger"
                    onClick={() => setConfirmTarget(c)}
                    title="Eliminar programa">
                    <i className="ti ti-trash"/>
                  </button>
                </div>
              </div>
            </div>

            {/* Barra de inscripción */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom: ps.length ? 12 : 0 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12,
                  color:'var(--gray)', marginBottom:4 }}>
                  <span>{enr} de {c.capacity} cupos ocupados ({pct}%)</span>
                  <span>{c.capacity - enr} disponibles</span>
                </div>
                <div className="pbar-wrap">
                  <div className={`pbar ${pct >= 90 ? 'pbar-warn' : 'pbar-green'}`}
                    style={{ width:`${pct}%` }}/>
                </div>
              </div>
              <Badge type="black">{enr} inscritos</Badge>
            </div>

            {/* Participantes inscritos */}
            {ps.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {ps.map(p => (
                  <span key={p.id} onClick={() => setView(`profile_${p.id}`)}
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer',
                      background: p.access ? 'var(--black)' : 'var(--cream-3)',
                      color:      p.access ? 'var(--cream)' : 'var(--gray)' }}>
                    {p.access ? '✓ ' : ''}{p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
       </div>
      )}
    </div>
  )
}
