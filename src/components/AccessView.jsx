// ============================================================
//  AccessView.jsx — React JSX
// ============================================================
import { classifyAccess, daysLeft, getAccessDays } from '../utils/time.js'

import { StatCard, AccessBar, TimerBadge } from './UI.jsx'
import { openEmailClient } from '../utils/email.js'

export default function AccessView({ participants, courses = [], onToggleAccess, onRenew }) {
  const state      = p => classifyAccess(p, courses)
  const expired    = participants.filter(p => state(p) === 'expirado')
  const warning    = participants.filter(p => state(p) === 'por_vencer')
  const sinAcceso  = participants.filter(p => p.status === 'activo' && p.payment === 'pagado' && state(p) === 'sin_acceso')
  const conAcceso  = participants.filter(p => p.access)
  const shortName  = id => courses.find(c => c.id === id)?.short || id

  return (
    <div>
      <div className="page-header"><div><h2 className="h1">Control de Accesos</h2><p className="text-muted" style={{fontSize:13,marginTop:3}}>Vigencia personalizada por curso · Revocación automática al expirar</p></div></div>
      <div className="stats-grid">
        <StatCard num={conAcceso.length} label="Activos" />
        <StatCard num={sinAcceso.length} label="Pendientes" accent="var(--orange)" />
        <StatCard num={warning.length}   label="Expiran ≤7 días" accent="var(--amber)" />
        <StatCard num={expired.length}   label="Expirados" accent="var(--orange-d)" />
      </div>

      {expired.length > 0 && (
        <div className="alert alert-red">
          <div className="alert-title"><i className="ti ti-lock"/> {expired.length} acceso{expired.length!==1?'s':''} expirado{expired.length!==1?'s':''}</div>
          {expired.map(p => {
            const days = getAccessDays(p, courses)
            return (
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--cream-2)',flexWrap:'wrap',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:13}}>{p.name}</div>
                  <div className="text-xs text-muted" style={{marginBottom:6}}>{p.email}</div>
                  <div style={{maxWidth:280}}><AccessBar fecha={p.fecha} days={days}/></div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto'}} onClick={() => onRenew(p.id)}><i className="ti ti-refresh"/> Renovar</button>
              </div>
            )
          })}
        </div>
      )}

      {warning.length > 0 && (
        <div className="alert alert-orange">
          <div className="alert-title"><i className="ti ti-clock"/> {warning.length} por vencer esta semana</div>
          {warning.map(p => {
            const days = getAccessDays(p, courses)
            return (
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--cream-2)',flexWrap:'wrap',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:13}}>{p.name} <span style={{fontSize:11,color:'var(--amber-d)'}}>· {daysLeft(p.fecha, days)}d</span></div>
                  <div style={{maxWidth:280,marginTop:4}}><AccessBar fecha={p.fecha} days={days}/></div>
                </div>
                <button className="btn btn-orange btn-sm" style={{marginLeft:'auto'}} onClick={() => openEmailClient(p)}><i className="ti ti-mail"/> Recordatorio</button>
              </div>
            )
          })}
        </div>
      )}

      {sinAcceso.length > 0 && (
        <div className="alert alert-orange">
          <div className="alert-title"><i className="ti ti-alert-triangle"/> Sin acceso (pago confirmado)</div>
          {sinAcceso.map(p => (
            <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--cream-2)',flexWrap:'wrap',gap:8}}>
              <div><div style={{fontWeight:500,fontSize:13}}>{p.name}</div><div className="text-xs text-muted">{p.email}</div></div>
              <button className="btn btn-orange btn-sm" onClick={() => onToggleAccess(p.id)}><i className="ti ti-key"/> Dar acceso</button>
            </div>
          ))}
        </div>
      )}

      {!expired.length && !warning.length && !sinAcceso.length && (
        <div className="alert alert-green"><i className="ti ti-check"/> Todo en orden — sin alertas de acceso pendientes.</div>
      )}

      <h3 className="h3" style={{marginBottom:12}}>Todos los participantes</h3>
      <div className="card ttable-responsive">
        <table className="ttable">
          <thead><tr><th style={{width:'24%'}}>Participante</th><th style={{width:'18%'}}>Cursos</th><th style={{width:'28%'}}>Tiempo de acceso</th><th style={{width:'15%'}}>Estado</th><th style={{width:'15%'}}>Acción</th></tr></thead>
          <tbody>
            {participants.map(p => {
              const days = getAccessDays(p, courses)
              const st   = state(p)
              return (
                <tr key={p.id} className={st === 'expirado' ? 'row-exp' : st === 'por_vencer' ? 'row-warn' : ''}>
                  <td style={{fontWeight:500}}>{p.name}</td>
                  <td className="text-xs text-muted">{p.courses.map(shortName).join(', ')}</td>
                  <td>{p.access ? <AccessBar fecha={p.fecha} days={days}/> : <span className="text-sm text-muted">Sin acceso</span>}</td>
                  <td><TimerBadge fecha={p.fecha} access={p.access} days={days}/></td>
                  <td>
                    <button onClick={() => onToggleAccess(p.id)}
                      style={{background:'none',border:`1px solid ${p.access?'var(--orange)':'var(--border)'}`,borderRadius:6,padding:'5px 12px',fontSize:11,cursor:'pointer',color:p.access?'var(--orange)':'var(--gray)',fontFamily:'var(--font-body)'}}>
                      {p.access ? 'Revocar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Cards — móvil */}
      <div className="card-stack">
        {participants.map(p => {
          const days = getAccessDays(p, courses)
          const st   = state(p)
          return (
            <div key={p.id} className={`pcard ${st === 'expirado' ? 'row-exp' : st === 'por_vencer' ? 'row-warn' : ''}`}>
              <div className="pcard-head">
                <div className="pcard-id">
                  <div className="pname">{p.name}</div>
                  <div className="pemail">{p.courses.map(shortName).join(', ') || 'Sin cursos'}</div>
                </div>
                <TimerBadge fecha={p.fecha} access={p.access} days={days}/>
              </div>
              {p.access
                ? <AccessBar fecha={p.fecha} days={days}/>
                : <span className="text-sm text-muted">Sin acceso</span>}
              <button onClick={() => onToggleAccess(p.id)}
                className="btn btn-sm"
                style={{background:'none',border:`1px solid ${p.access?'var(--orange)':'var(--border)'}`,color:p.access?'var(--orange)':'var(--gray)',justifyContent:'center'}}>
                <i className={`ti ti-${p.access ? 'key-off' : 'key'}`}/>
                {p.access ? 'Revocar acceso' : 'Activar acceso'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
