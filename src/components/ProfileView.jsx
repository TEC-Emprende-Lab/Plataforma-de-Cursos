// ============================================================
//  ProfileView.jsx — React JSX
//  Perfil individual. Muestra etiquetas y permite editarlas.
// ============================================================

import { isExpired, isWarning, daysLeft, daysElapsed, fmtDate, expiryDate, examDeadlineDate, needsExamReminder, getAccessDays } from '../utils/time.js'

import { AccessBar, TimerBadge, Badge } from './UI.jsx'
import DiagnosticPanel from './DiagnosticPanel.jsx'
import { TagPill }          from './TagPill.jsx'
import { TagSelector }      from './TagSelector.jsx'
import { openEmailClient }  from '../utils/email.js'
import { useState }         from 'react'

export default function ProfileView({ id, participants, courses, tags, onToggleAccess, onRenew, onUpdateTags, setView }) {
  const p = participants.find(x => x.id === id)

  const [editingTags, setEditingTags] = useState(false)
  const [selectedTags, setSelectedTags] = useState(p?.tags || [])

  if (!p) return <div>Participante no encontrado</div>

  const days        = getAccessDays(p, courses)
  const exp         = isExpired(p.fecha, days)
  const warn        = isWarning(p.fecha, days)
  const examRemind  = needsExamReminder(p.fecha, days)
  const ptags       = tags.filter(t => (p.tags||[]).includes(t.id))

  const toggleTag = tid => setSelectedTags(prev =>
    prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]
  )

  const saveTags = () => {
    onUpdateTags(p.id, selectedTags)
    setEditingTags(false)
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => setView('participants')}
        style={{ marginBottom:16 }}>
        <i className="ti ti-arrow-left"/> Volver
      </button>

      {/* Header oscuro */}
      <div className="profile-header">
        <div className="profile-av">
          {p.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:22 }}>{p.name}</div>
          <div style={{ fontSize:13, color:'var(--gray)', marginTop:4 }}>
            {p.cedula && <><i className="ti ti-id-badge" style={{marginRight:3}}/>{p.cedula} · </>}{p.email} · {p.phone || 'Sin teléfono'}
          </div>
          {/* Etiquetas en el header */}
          <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', alignItems:'center', gap:4 }}>
            {ptags.map(t => <TagPill key={t.id} tag={t}/>)}
            <Badge type={p.status === 'activo' ? 'green' : 'gray'}>{p.status}</Badge>
            <Badge type={p.payment === 'pagado' ? 'green' : 'amber'}>{p.payment}</Badge>
            <TimerBadge fecha={p.fecha} access={p.access} days={days}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {p.access
            ? <button className="btn btn-ghost btn-sm"
                style={{ color:'var(--orange-l)', borderColor:'var(--orange)' }}
                onClick={() => { onToggleAccess(p.id); setView(`profile_${p.id}`) }}>
                <i className="ti ti-key"/> Revocar
              </button>
            : <button className="btn btn-orange btn-sm"
                onClick={() => { onToggleAccess(p.id); setView(`profile_${p.id}`) }}>
                <i className="ti ti-key"/> Dar acceso
              </button>
          }
          {exp && (
            <button className="btn btn-ghost btn-sm"
              style={{ color:'var(--cream)', borderColor:'rgba(255,255,255,.2)' }}
              onClick={() => { onRenew(p.id); setView(`profile_${p.id}`) }}>
              <i className="ti ti-refresh"/> Renovar
            </button>
          )}
        </div>
      </div>

      {/* Grid: acceso + cursos */}
      <div className="grid-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Acceso */}
        <div className="card card-padded">
          <div className="text-xs text-muted"
            style={{ marginBottom:12, fontWeight:600, letterSpacing:.5 }}>
            ACCESO A PLATAFORMA
          </div>
          <AccessBar fecha={p.fecha} days={days}/>
          <div className="grid-2col" style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
            <div><span style={{ color:'var(--gray)' }}>Ingreso:</span> <b>{fmtDate(p.fecha)}</b></div>
            <div>
              <span style={{ color:'var(--gray)' }}>Expiración:</span>{' '}
              <b style={{ color: exp ? 'var(--orange-d)' : warn ? 'var(--amber-d)' : 'var(--black)' }}>
                {expiryDate(p.fecha, days)}
              </b>
            </div>
            <div><span style={{ color:'var(--gray)' }}>Transcurridos:</span> <b>{daysElapsed(p.fecha)}d</b></div>
            <div><span style={{ color:'var(--gray)' }}>Restantes:</span> <b>{daysLeft(p.fecha, days)}d</b></div>
          </div>
        </div>

        {/* Cursos */}
        <div className="card card-padded">
          <div className="text-xs text-muted"
            style={{ marginBottom:12, fontWeight:600, letterSpacing:.5 }}>
            CURSOS INSCRITOS
          </div>
          {p.courses.length ? p.courses.map(cid => {
            const c = courses.find(x => x.id === cid)
            if (!c) return null
            return (
              <div key={cid} style={{ paddingBottom:10, marginBottom:10, borderBottom:'1px solid var(--cream-2)' }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{c.name}</div>
                <div className="text-xs text-muted" style={{ marginTop:2 }}>
                  {c.platform} · {fmtDate(c.start)} → {fmtDate(c.end)}
                </div>
                <div style={{ marginTop:4, display:'flex', gap:6, alignItems:'center' }}>
                  <span className="badge badge-gray">{c.code}</span>
                  <span className="text-xs text-muted">{c.accessDays ?? 45}d de acceso</span>
                </div>
              </div>
            )
          }) : <p className="text-sm text-muted">Sin cursos inscritos</p>}
        </div>
      </div>

      {/* Etiquetas editables */}
      <div className="card card-padded" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div className="text-xs text-muted" style={{ fontWeight:600, letterSpacing:.5 }}>ETIQUETAS</div>
          <button className="btn-icon"
            onClick={() => { setEditingTags(!editingTags); setSelectedTags(p.tags||[]) }}>
            <i className={`ti ti-${editingTags ? 'x' : 'edit'}`}/>
            {editingTags ? 'Cancelar' : 'Editar etiquetas'}
          </button>
        </div>
        {editingTags ? (
          <div>
            <TagSelector tags={tags} selected={selectedTags} onChange={toggleTag}/>
            <button className="btn btn-orange btn-sm" onClick={saveTags} style={{ marginTop:8 }}>
              <i className="ti ti-check"/> Guardar etiquetas
            </button>
          </div>
        ) : (
          ptags.length
            ? <div style={{ display:'flex', flexWrap:'wrap' }}>
                {ptags.map(t => <TagPill key={t.id} tag={t}/>)}
              </div>
            : <span className="text-sm text-muted" style={{ fontStyle:'italic' }}>Sin etiquetas asignadas</span>
        )}
      </div>

      {/* Contacto rápido */}
      <div className="card card-padded" style={{ marginBottom:16 }}>
        <div className="text-xs text-muted" style={{ marginBottom:12, fontWeight:600, letterSpacing:.5 }}>
          CONTACTO RÁPIDO
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {p.email && (
            <a href={`mailto:${p.email}`}
              className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>
              <i className="ti ti-mail"/> {p.email}
            </a>
          )}
          {p.phone && (
            <a href={`tel:${p.phone.replace(/\s/g,'')}`}
              className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>
              <i className="ti ti-phone"/> {p.phone}
            </a>
          )}
          {!p.email && !p.phone && (
            <span className="text-sm text-muted" style={{ fontStyle:'italic' }}>Sin datos de contacto</span>
          )}
        </div>
      </div>

      {/* Recordatorio */}
      {(examRemind || warn) && (
        <div className="alert alert-orange" style={{ marginBottom:16 }}>
          <div className="alert-title"><i className="ti ti-mail"/> Recordatorio de prueba final</div>
          <p className="text-sm text-muted" style={{ marginBottom:12 }}>
            Prueba antes del <b>{examDeadlineDate(p.fecha, days)}</b> · Acceso expira el <b>{expiryDate(p.fecha, days)}</b>
          </p>
          <button className="btn btn-orange btn-sm" onClick={() => openEmailClient(p)}>
            <i className="ti ti-mail-forward"/> Abrir correo recordatorio
          </button>
        </div>
      )}

      {/* Diagnóstico de Emprendimiento */}
      <DiagnosticPanel cedula={p.cedula} />

      {/* Notas */}
      {p.notes && (
        <div className="card card-padded">
          <div className="text-xs text-muted" style={{ marginBottom:6, fontWeight:600, letterSpacing:.5 }}>
            NOTAS INTERNAS
          </div>
          <p style={{ fontSize:13 }}>{p.notes}</p>
        </div>
      )}
    </div>
  )
}
