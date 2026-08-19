// ============================================================
//  ParticipantsView.jsx — React JSX (actualizado con courses dinámicos)
// ============================================================

import { useState }     from 'react'
import { isExpired, isWarning, daysLeft, getAccessDays } from '../utils/time.js'
import { mapWithConcurrency } from '../utils/async.js'
import { normalizeCedula } from '../utils/cedula.js'
import { AccessBar, Avatar, ConfirmDialog }  from './UI.jsx'
import { TagPill }      from './TagPill.jsx'
import { getTagColor }  from '../data/tags.js'
import { HACIENDA_API } from '../config.js'
import ParticipantModal from './ParticipantModal.jsx'

// Badge de estado del participante: punto de color + ícono + texto
// (no depende solo del color — accesible a daltonismo, WCAG 1.4.1)
function StatusBadge({ status }) {
  const active = status === 'activo'
  const color  = active ? 'var(--green)' : 'var(--gray)'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize:14 }}>
        {active ? 'check_circle' : 'pause_circle'}
      </span>
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

// Heurística de país según el FORMATO del documento (no es verificación oficial).
// Sirve para orientar la búsqueda manual de identificaciones extranjeras.
function detectIdCountry(rawId) {
  const id = String(rawId || '').trim().toUpperCase()
  const c  = id.replace(/[\s.]/g, '')
  // Nicaragua: 000-000000-0000X (termina en letra)
  if (/^\d{3}-?\d{6}-?\d{4}[A-Z]$/.test(c)) return { country:'Nicaragua', flag:'🇳🇮' }
  // Panamá: prefijo de provincia 1-13 o E/N/PE/AV + secciones (8-123-456, PE-12-3456, E-8-12345)
  if (/^(PE|E|N|AV|\d{1,2})-\d{1,5}-\d{1,6}$/.test(c)) return { country:'Panamá', flag:'🇵🇦' }
  // Guatemala (DPI) / Honduras / El Salvador: 13 dígitos
  if (/^\d{13}$/.test(c)) return { country:'Centroamérica', flag:'🌎' }
  // Con letras, formato no reconocido (pasaporte u otro)
  return { country:'Extranjero', flag:'🌎' }
}

export default function ParticipantsView({
  participants, courses, tags,
  onAdd, onUpdate, onDelete, onToggleAccess, setView,
}) {
  const [search,       setSearch]       = useState('')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTag,    setFilterTag]    = useState('all')
  const [sortBy,       setSortBy]       = useState('fecha_desc')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)
  const [verifying,    setVerifying]    = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)   // participante a eliminar

  // ¿El número parece cédula CR o DIMEX? (solo dígitos, largo 9/10/11/12)
  // Si no, se trata como identificación extranjera (sin API → revisión manual).
  const normalizeName = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/gi, "n").trim().toUpperCase()

  const isCrVerifiable = (cedula) => {
    const norm = String(cedula).replace(/[-. ]/g, '')
    return /^\d+$/.test(norm) && [9, 10, 11, 12].includes(norm.length)
  }

  const verifyCedulas = async () => {
    const conCedula = participants.filter(p => p.cedula)
    if (!conCedula.length) { setVerifyResult({ error: 'Ningún participante tiene cédula registrada.' }); return }

    // Separar nacionales/DIMEX (verificables por API) de extranjeros (manual)
    const verificables = conCedula.filter(p => isCrVerifiable(p.cedula))
    const extranjerosList = conCedula
      .filter(p => !isCrVerifiable(p.cedula))
      .map(p => {
        const det = detectIdCountry(p.cedula)
        return { id: p.id, name: p.name, cedula: String(p.cedula).trim(), country: det.country, flag: det.flag }
      })

    setVerifying(true); setVerifyResult(null)

    // Consultar Hacienda en paralelo (hasta 6 a la vez) para que no sea
    // lento con muchos participantes, sin saturar la API pública.
    const results = await mapWithConcurrency(verificables, 6, async (p) => {
      const ced = normalizeCedula(p.cedula)
      try {
        const res = await fetch(
          `${HACIENDA_API}/${ced}`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (res.ok) {
          const data = await res.json()
          const r = data.results?.[0]
          const nombre = r ? (r.firstname + " " + r.lastname).trim().toUpperCase() : (data.nombre || "").trim().toUpperCase()
          return { cedula: ced, nombre: nombre || null, ok: !!nombre }
        }
        return { cedula: ced, nombre: null, ok: false }
      } catch {
        return { cedula: ced, nombre: null, ok: false }
      }
    })

    const updates = []
    const noEncontradosList = []
    for (const r of results) {
      const p = verificables.find(p => normalizeCedula(p.cedula) === r.cedula)
      if (!r.ok) {
        if (p) noEncontradosList.push({ id: p.id, name: p.name, cedula: r.cedula })
        continue
      }
      if (p && r.nombre && normalizeName(r.nombre) !== normalizeName(p.name)) {
        updates.push({ id: p.id, nombreActual: p.name, nombreTSE: r.nombre, cedula: r.cedula })
      }
    }
    setVerifyResult({
      updates,
      total: conCedula.length,
      found: results.filter(r => r.ok).length,
      noEncontrados: noEncontradosList.length,
      noEncontradosList,
      extranjerosList,
    })
    setVerifying(false)
  }

  const applyUpdate = (id, nombre) => {
    // Buscar el participante completo y solo cambiar el nombre
    const p = participants.find(p => p.id === id)
    if (p) onUpdate(id, { ...p, name: nombre })
    setVerifyResult(prev => ({ ...prev, updates: prev.updates.filter(u => u.id !== id) }))
  }

  const filtered = participants
    .filter(p => {
      const days = getAccessDays(p, courses)
      const q = search.toLowerCase()
      const matchQ = !q || p.name.toLowerCase().includes(q)
        || p.email.toLowerCase().includes(q) || p.phone.includes(q)
      const matchC = filterCourse === 'all' || p.courses.includes(filterCourse)
      const matchT = filterTag    === 'all' || (p.tags||[]).includes(filterTag)
      const matchS = filterStatus === 'all'
        || (filterStatus === 'activo'    && p.status === 'activo')
        || (filterStatus === 'inactivo'  && p.status === 'inactivo')
        || (filterStatus === 'acceso'    && p.access)
        || (filterStatus === 'sinacceso' && !p.access)
        || (filterStatus === 'expirado'  && isExpired(p.fecha, days))
        || (filterStatus === 'warning'   && isWarning(p.fecha, days))
      return matchQ && matchC && matchT && matchS
    })
    .sort((a, b) => {
      if (sortBy === 'fecha_asc') return a.fecha.localeCompare(b.fecha)
      if (sortBy === 'nombre')    return a.name.localeCompare(b.name)
      if (sortBy === 'expiry')    return daysLeft(a.fecha, getAccessDays(a, courses)) - daysLeft(b.fecha, getAccessDays(b, courses))
      return b.fecha.localeCompare(a.fecha)
    })

  const openNew  = ()  => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (p) => { setEditTarget(p);    setModalOpen(true) }
  const handleSave = form =>
    editTarget ? onUpdate(editTarget.id, form) : onAdd(form)

  const shortName = cid => courses.find(c => c.id === cid)?.short || cid

  const filtersActive = search !== '' || filterCourse !== 'all' || filterStatus !== 'all'
    || filterTag !== 'all' || sortBy !== 'fecha_desc'
  const clearFilters = () => {
    setSearch(''); setFilterCourse('all'); setFilterStatus('all'); setFilterTag('all'); setSortBy('fecha_desc')
  }

  // Métricas reales para la fila inferior
  const totalActivos = participants.filter(p => p.status === 'activo').length
  const conAcceso    = participants.filter(p => p.access).length
  const porVencer    = participants.filter(p => p.access && isWarning(p.fecha, getAccessDays(p, courses))).length

  return (
    <div>
      {modalOpen && (
        <ParticipantModal
          participant={editTarget}
          courses={courses}
          tags={tags}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Eliminar participante"
          message={`¿Seguro que querés eliminar a ${confirmTarget.name}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={() => onDelete(confirmTarget.id)}
          onClose={() => setConfirmTarget(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h2 className="h1">Participantes</h2>
          <p className="text-muted" style={{ fontSize:13, marginTop:3 }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost"
            onClick={verifyCedulas} disabled={verifying}>
            {verifying
              ? <><i className="ti ti-loader-2" style={{ animation:'spin 1s linear infinite' }}/> Verificando...</>
              : <><i className="ti ti-id-badge"/> Verificar nombres por cédula</>}
          </button>
          <button className="btn btn-orange" onClick={openNew}>
            <i className="ti ti-plus"/> Nuevo participante
          </button>
        </div>
      </div>

      {/* Resultados de verificación por cédula */}
      {verifyResult && (
        <div style={{ margin:'0 0 14px', padding:'12px 16px', borderRadius:10,
          background: verifyResult.error ? '#fff1f2' : '#f0fdf4',
          border: `1px solid ${verifyResult.error ? '#fecdd3' : '#bbf7d0'}` }}>
          {verifyResult.error ? (
            <p style={{ color:'#be123c', fontSize:13 }}><i className="ti ti-alert-circle"/> {verifyResult.error}</p>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: verifyResult.updates?.length ? 8 : 0 }}>
                <p style={{ color:'#15803d', fontSize:13, fontWeight:600 }}>
                  <i className="ti ti-check"/> Consultados: {verifyResult.total} · Encontrados: {verifyResult.found}
                  {verifyResult.noEncontrados > 0 && <span style={{color:'#d97706'}}> · No encontrados: {verifyResult.noEncontrados}</span>}
                  {verifyResult.extranjerosList?.length > 0 && <span style={{color:'#0369a1'}}> · Extranjeros: {verifyResult.extranjerosList.length}</span>}
                  {' · '}Diferencias: {verifyResult.updates?.length || 0}
                </p>
                <button onClick={() => setVerifyResult(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:16 }}>✕</button>
              </div>
              {verifyResult.updates?.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {verifyResult.updates.map(u => (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13,
                      background:'white', padding:'6px 10px', borderRadius:6, border:'1px solid #bbf7d0' }}>
                      <span style={{ color:'#6b7280', minWidth:90 }}>Céd. {u.cedula}</span>
                      <span style={{ color:'#ef4444', textDecoration:'line-through' }}>{u.nombreActual}</span>
                      <i className="ti ti-arrow-right" style={{ color:'#9ca3af' }}/>
                      <span style={{ color:'#15803d', fontWeight:600 }}>{u.nombreTSE}</span>
                      <button onClick={() => applyUpdate(u.id, u.nombreTSE)}
                        style={{ marginLeft:'auto', padding:'2px 10px', borderRadius:5,
                          background:'#16a34a', color:'white', border:'none', cursor:'pointer', fontSize:12 }}>
                        Actualizar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {verifyResult.updates?.length === 0 && (
                <p style={{ color:'#15803d', fontSize:13 }}>✓ Todos los nombres coinciden con el Registro Civil.</p>
              )}

              {/* No encontrados en el Registro Civil */}
              {verifyResult.noEncontradosList?.length > 0 && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #bbf7d0' }}>
                  <p style={{ color:'#b45309', fontSize:12, fontWeight:600, marginBottom:6 }}>
                    <i className="ti ti-alert-triangle"/> Sin coincidencia en el Registro Civil ({verifyResult.noEncontradosList.length})
                    <span style={{ fontWeight:400, color:'#92732b' }}> — revisá la cédula manualmente</span>
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {verifyResult.noEncontradosList.map(n => (
                      <div key={n.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13,
                        background:'#fffbeb', padding:'6px 10px', borderRadius:6, border:'1px solid #fde68a' }}>
                        <span style={{ color:'#6b7280', minWidth:90 }}>Céd. {n.cedula}</span>
                        <span style={{ fontWeight:500 }}>{n.name}</span>
                        <button onClick={() => { setVerifyResult(null); openEdit(participants.find(p => p.id === n.id)) }}
                          style={{ marginLeft:'auto', padding:'2px 10px', borderRadius:5,
                            background:'#fff', color:'#b45309', border:'1px solid #fde68a', cursor:'pointer', fontSize:12 }}>
                          <i className="ti ti-edit"/> Revisar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extranjeros — sin API, revisión manual */}
              {verifyResult.extranjerosList?.length > 0 && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #bbf7d0' }}>
                  <p style={{ color:'#0369a1', fontSize:12, fontWeight:600, marginBottom:6 }}>
                    <i className="ti ti-world"/> Identificación extranjera ({verifyResult.extranjerosList.length})
                    <span style={{ fontWeight:400, color:'#3b6b85' }}> — sin registro automático, revisión manual</span>
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {verifyResult.extranjerosList.map(n => {
                      const known = n.country && n.country !== 'Extranjero'
                      const query = known
                        ? `"${n.name}" cédula ${n.cedula} ${n.country}`
                        : `"${n.name}" ${n.cedula}`
                      return (
                      <div key={n.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, flexWrap:'wrap',
                        background:'#f0f9ff', padding:'6px 10px', borderRadius:6, border:'1px solid #bae6fd' }}>
                        <span style={{ color:'#6b7280', minWidth:90 }}>ID {n.cedula}</span>
                        <span style={{ fontWeight:500 }}>{n.name}</span>
                        <span style={{ fontSize:11, fontWeight:600, color:'#0369a1',
                          background:'#e0f2fe', border:'1px solid #bae6fd', borderRadius:20, padding:'1px 8px' }}>
                          {n.flag} {n.country}
                        </span>
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft:'auto', padding:'2px 10px', borderRadius:5, textDecoration:'none',
                            background:'#0369a1', color:'#fff', fontSize:12 }}>
                          <i className="ti ti-external-link"/> Buscar en web
                        </a>
                        <button onClick={() => { setVerifyResult(null); openEdit(participants.find(p => p.id === n.id)) }}
                          style={{ padding:'2px 10px', borderRadius:5,
                            background:'#fff', color:'#0369a1', border:'1px solid #bae6fd', cursor:'pointer', fontSize:12 }}>
                          <i className="ti ti-edit"/> Revisar
                        </button>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="filters-row" style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input className="finput" placeholder="Buscar nombre, correo, teléfono..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200 }}/>
        <select className="finput" style={{ width:'auto' }}
          value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
          <option value="all">Todos los cursos</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.short}</option>)}
        </select>
        <select className="finput" style={{ width:'auto' }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="acceso">Con acceso</option>
          <option value="sinacceso">Sin acceso</option>
          <option value="expirado">Expirados</option>
          <option value="warning">Por vencer</option>
        </select>
        <select className="finput" style={{ width:'auto' }}
          value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="all">Todas las etiquetas</option>
          {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="finput" style={{ width:'auto' }}
          value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="fecha_desc">Más recientes</option>
          <option value="fecha_asc">Más antiguos</option>
          <option value="nombre">Nombre A-Z</option>
          <option value="expiry">Por vencer primero</option>
        </select>
        {filtersActive && (
          <button onClick={clearFilters}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--orange)',
              fontWeight:600, fontSize:13, fontFamily:'inherit', whiteSpace:'nowrap' }}>
            <i className="ti ti-x" style={{ fontSize:12 }}/> Limpiar filtros
          </button>
        )}
      </div>

      {/* Chip de etiqueta activa */}
      {filterTag !== 'all' && (() => {
        const t = tags.find(x => x.id === filterTag)
        if (!t) return null
        const c = getTagColor(t.color)
        return (
          <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
            <span className="text-sm text-muted">Filtrando por:</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px',
              borderRadius:20, fontSize:11, fontWeight:500,
              background:c.bg, border:`1px solid ${c.border}`, color:c.text }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot }}/>
              {t.name}
              <button onClick={() => setFilterTag('all')}
                style={{ background:'none', border:'none', cursor:'pointer', color:c.text,
                  fontSize:10, padding:0, marginLeft:2, display:'flex', alignItems:'center' }}>
                <i className="ti ti-x" style={{ fontSize:9 }}/>
              </button>
            </span>
          </div>
        )
      })()}

      {/* Tabla — desktop */}
      <div className="card ttable-responsive">
        <table className="ttable">
          <thead>
            <tr>
              <th style={{ width:'24%' }}>Participante</th>
              <th style={{ width:'14%' }}>Cursos</th>
              <th style={{ width:'20%' }}>Tiempo de acceso</th>
              <th style={{ width:'14%' }}>Etiquetas</th>
              <th style={{ width:'14%' }}>Estado</th>
              <th style={{ width:'14%' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map(p => {
              const days = getAccessDays(p, courses)
              const exp   = p.access && isExpired(p.fecha, days)
              const warn  = p.access && isWarning(p.fecha, days)
              const ptags = tags.filter(t => (p.tags||[]).includes(t.id))
              return (
                <tr key={p.id} className={exp ? 'row-exp' : warn ? 'row-warn' : ''}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <Avatar name={p.name} variant={exp ? 'red' : warn ? 'warn' : 'cream'}/>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.name}
                        </div>
                        <div className="text-xs text-muted" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-xs text-muted" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.courses.map(shortName).join(', ')}
                  </td>
                  <td>
                    {p.access ? <AccessBar fecha={p.fecha} days={days}/> : <span className="text-sm text-muted">Sin acceso</span>}
                  </td>
                  <td>
                    {ptags.length
                      ? <div style={{ display:'flex', flexWrap:'wrap' }}>{ptags.map(t => <TagPill key={t.id} tag={t} small/>)}</div>
                      : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td><StatusBadge status={p.status}/></td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn-icon" onClick={() => openEdit(p)} title="Editar">
                        <i className="ti ti-edit"/> Editar
                      </button>
                      <button className="btn-icon" onClick={() => setView(`profile_${p.id}`)} title="Perfil">
                        <i className="ti ti-user"/>
                      </button>
                      <button className={`btn-icon${p.access ? ' orange' : ''}`}
                        onClick={() => onToggleAccess(p.id)}>
                        <i className="ti ti-key"/>
                      </button>
                      <button className="btn-icon danger"
                        onClick={() => setConfirmTarget(p)}>
                        <i className="ti ti-trash"/>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--gray)' }}>
                  No se encontraron participantes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — móvil */}
      <div className="card-stack">
        {filtered.length ? filtered.map(p => {
          const days = getAccessDays(p, courses)
          const exp   = p.access && isExpired(p.fecha, days)
          const warn  = p.access && isWarning(p.fecha, days)
          const ptags = tags.filter(t => (p.tags||[]).includes(t.id))
          return (
            <div key={p.id} className={`pcard ${exp ? 'row-exp' : warn ? 'row-warn' : ''}`}>
              <div className="pcard-head">
                <Avatar name={p.name} variant={exp ? 'red' : warn ? 'warn' : 'cream'}/>
                <div className="pcard-id">
                  <div className="pname">{p.name}</div>
                  <div className="pemail">{p.email}</div>
                </div>
                <StatusBadge status={p.status}/>
              </div>

              {p.access && (
                <div className="pcard-section">
                  <span className="pcard-label">Tiempo de acceso</span>
                  <AccessBar fecha={p.fecha} days={days}/>
                </div>
              )}

              {p.courses.length > 0 && (
                <div className="pcard-section">
                  <span className="pcard-label">Cursos</span>
                  <div style={{ fontSize:12, color:'var(--gray)' }}>
                    {p.courses.map(shortName).join(', ')}
                  </div>
                </div>
              )}

              {ptags.length > 0 && (
                <div className="pcard-section">
                  <span className="pcard-label">Etiquetas</span>
                  <div style={{ display:'flex', flexWrap:'wrap' }}>
                    {ptags.map(t => <TagPill key={t.id} tag={t} small/>)}
                  </div>
                </div>
              )}

              <div className="pcard-actions">
                <button className="btn-icon" onClick={() => openEdit(p)}>
                  <i className="ti ti-edit"/> Editar
                </button>
                <button className="btn-icon" onClick={() => setView(`profile_${p.id}`)}>
                  <i className="ti ti-user"/> Perfil
                </button>
                <button className={`btn-icon${p.access ? ' orange' : ''}`}
                  onClick={() => onToggleAccess(p.id)}>
                  <i className="ti ti-key"/> {p.access ? 'Revocar' : 'Acceso'}
                </button>
                <button className="btn-icon danger"
                  onClick={() => setConfirmTarget(p)}>
                  <i className="ti ti-trash"/>
                </button>
              </div>
            </div>
          )
        }) : (
          <div className="card" style={{ padding:32, textAlign:'center', color:'var(--gray)' }}>
            No se encontraron participantes
          </div>
        )}
      </div>

      {/* Resumen real al pie */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginTop:16 }}>
        {[
          { icon:'group',    label:'Total activos',   value: totalActivos, color:'var(--orange)' },
          { icon:'key',      label:'Con acceso',      value: conAcceso,    color:'var(--green)' },
          { icon:'schedule', label:'Expiran ≤7 días', value: porVencer,    color:'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'var(--cream-2)', color:s.color }}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize:20 }}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xs text-muted" style={{ margin:0 }}>{s.label}</p>
              <p style={{ margin:0, fontSize:22, fontWeight:700, color:'var(--black)' }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
