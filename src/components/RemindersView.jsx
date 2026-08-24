// ============================================================
//  RemindersView.jsx — React JSX
// ============================================================
import { needsExamReminder, daysLeft, examDeadlineDate, expiryDate, getAccessDays } from '../utils/time.js'

import { AccessBar, Avatar } from './UI.jsx'
import { buildReminderEmail, openEmailClient, copyEmailToClipboard } from '../utils/email.js'
import { useState } from 'react'
import { Modal } from './UI.jsx'

function EmailModal({ participant, courses, onClose }) {
  const em = buildReminderEmail(participant, courses)
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    copyEmailToClipboard(participant, courses).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <Modal onClose={onClose} width={640}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <h3 className="h2"><i className="ti ti-mail" style={{color:'var(--orange)',marginRight:8}}/>Correo recordatorio</h3>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray)',fontSize:18}}><i className="ti ti-x"/></button>
      </div>
      <div className="email-preview">
        <div className="email-subject">Asunto: {em.subject}</div>
        <div className="text-sm text-muted" style={{marginBottom:8}}><b>Para:</b> {em.to} &nbsp;|&nbsp; <b>De:</b> {em.from}</div>
        <pre style={{whiteSpace:'pre-wrap',fontFamily:'var(--font-body)',fontSize:13,lineHeight:1.7}}>{em.body}</pre>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        <button className="btn btn-ghost" onClick={handleCopy} style={copied ? { color:'var(--green)', borderColor:'var(--green)' } : undefined}>
          <i className={`ti ti-${copied ? 'check' : 'copy'}`}/> {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button className="btn btn-orange" onClick={() => { openEmailClient(participant, courses); onClose() }}><i className="ti ti-mail-forward"/> Abrir en correo</button>
      </div>
    </Modal>
  )
}

export default function RemindersView({ participants, courses = [], setView }) {
  const [previewId, setPreviewId] = useState(null)
  const pending = participants.filter(p => p.access && needsExamReminder(p.fecha, getAccessDays(p, courses)))
  const previewP = previewId ? participants.find(x => x.id === previewId) : null

  return (
    <div>
      {previewP && <EmailModal participant={previewP} courses={courses} onClose={() => setPreviewId(null)}/>}
      <div className="page-header"><div><h2 className="h1">Recordatorios de pruebas</h2><p className="text-muted" style={{fontSize:13,marginTop:3}}>Participantes que deben realizar su prueba final durante esta semana</p></div></div>

      {pending.length === 0 ? (
        <div className="alert alert-green"><i className="ti ti-check"/> No hay recordatorios pendientes por ahora.</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(290px, 1fr))', gap:14 }}>
          {pending.map(p => {
            const days = getAccessDays(p, courses)
            const left = daysLeft(p.fecha, days)
            const courseNames = p.courses.map(id => courses.find(c => c.id === id)?.short || id).join(', ')
            const urgencia = left <= 1 ? 'Última oportunidad'
              : left <= 3 ? `Faltan ${left} días — urgente`
              : `Faltan ${left} días`
            return (
              <div key={p.id} className="card" style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                {/* Cabecera: avatar + nombre + curso */}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Avatar name={p.name} variant="warn"/>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                    <div className="text-xs text-muted" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{courseNames || p.email}</div>
                  </div>
                </div>

                {/* Vencimiento */}
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
                  <span className="material-symbols-outlined" aria-hidden="true"
                    style={{ fontSize:16, color: left <= 1 ? 'var(--orange-d)' : 'var(--amber)' }}>
                    {left <= 1 ? 'warning' : 'event'}
                  </span>
                  <span>Acceso expira: <b style={{ color: left <= 1 ? 'var(--orange-d)' : 'var(--amber-d)' }}>{expiryDate(p.fecha, days)}</b></span>
                </div>
                <div className="text-xs" style={{ color: left <= 1 ? 'var(--orange-d)' : left <= 3 ? 'var(--amber-d)' : 'var(--gray)', fontWeight: left <= 3 ? 600 : 400, marginTop:-4 }}>
                  {urgencia} · prueba antes del {examDeadlineDate(p.fecha, days)}
                </div>

                <AccessBar fecha={p.fecha} days={days} compact/>

                {/* Acciones */}
                <div style={{ display:'flex', gap:8, marginTop:2 }}>
                  <button className="btn btn-orange btn-sm" style={{ flex:1, justifyContent:'center' }}
                    onClick={() => setPreviewId(p.id)}>
                    <i className="ti ti-mail-forward"/> Enviar recordatorio
                  </button>
                  <button className="btn btn-ghost btn-sm" title="Ver perfil"
                    aria-label={`Ver perfil de ${p.name}`}
                    onClick={() => setView(`profile_${p.id}`)}>
                    <i className="ti ti-user"/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
