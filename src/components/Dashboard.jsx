import { classifyAccess, fmtDate, getAccessDays, accessPct } from '../utils/time.js'
import { StatCard, TimerBadge, Avatar } from './UI.jsx'
import { DonutAccess, BarChartCourses } from './Charts.jsx'

// Etiqueta corta del tipo de curso para el badge de la tarjeta
const TYPE_LABEL = { taller:'Taller', curso:'Curso', seminario:'Seminario', bootcamp:'Bootcamp', charla:'Charla' }

export default function Dashboard({ participants, courses, setView }) {
  const today    = new Date().toLocaleDateString('es-CR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const activos  = participants.filter(p=>p.status==='activo').length
  const conAcc   = participants.filter(p=>p.access).length
  const expired  = participants.filter(p=>classifyAccess(p,courses)==='expirado').length
  const warning  = participants.filter(p=>classifyAccess(p,courses)==='por_vencer').length
  const recent   = [...participants].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,6)
  const activeCourses = courses.filter(c=>c.active)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="h1">Dashboard</h2>
          <p className="text-muted" style={{fontSize:13,marginTop:3,display:'flex',alignItems:'center',gap:6}}>
            <span className="material-symbols-outlined" style={{fontSize:15}} aria-hidden="true">calendar_today</span>
            Resumen · {today}
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="stats-grid">
        <StatCard num={participants.length} label="Total participantes"/>
        <StatCard num={activos}  label="Activos"/>
        <StatCard num={conAcc}   label="Con acceso"/>
        <StatCard num={warning}  label="Expiran ≤7 días"   accent="var(--amber)"/>
        <StatCard num={expired}  label="Accesos expirados" accent="var(--orange-d)"/>
      </div>

      {/* Alertas */}
      {expired>0&&<div className="alert alert-red"><div className="alert-title"><i className="ti ti-lock"/> {expired} acceso{expired!==1?'s':''} expirado{expired!==1?'s':''} — revocados automáticamente</div><p className="text-sm text-muted">Podés renovarlos desde Control de Accesos.</p></div>}
      {warning>0&&<div className="alert alert-orange"><div className="alert-title"><i className="ti ti-clock"/> {warning} participante{warning!==1?'s':''} con acceso por vencer</div><p className="text-sm text-muted">Enviá el recordatorio de prueba desde Recordatorios.</p></div>}

      {/* Bento: cursos activos (izq) + participantes recientes (der) */}
      <div className="dash-bento" style={{display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:20,alignItems:'start',marginBottom:24}}>

        {/* Cursos activos */}
        <section className="card" style={{padding:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <h3 className="h3" style={{margin:0}}>Cursos y talleres activos</h3>
            <button onClick={()=>setView('courses')}
              style={{background:'none',border:'none',color:'var(--orange)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>
              Ver todos
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:12}}>
            {activeCourses.map(c=>{
              const enr=participants.filter(p=>p.courses.includes(c.id)).length
              const pct=c.capacity?Math.round(enr/c.capacity*100):0
              return(
                <div key={c.id} onClick={()=>setView('courses')}
                  role="button" tabIndex={0}
                  onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setView('courses') } }}
                  aria-label={`Ver curso ${c.short || c.name}`}
                  style={{border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'12px 14px',
                    background:'var(--cream-2)',cursor:'pointer',transition:'border-color .15s'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',
                      color:'var(--orange-d)',background:'var(--alert-warm-bg)',border:'1px solid var(--orange-l)',
                      borderRadius:999,padding:'2px 8px'}}>{TYPE_LABEL[c.type]||'Curso'}</span>
                    {c.code && <span className="text-xs text-muted" style={{fontFamily:'monospace'}}>{c.code}</span>}
                  </div>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{c.short || c.name}</div>
                  <div className="text-xs text-muted" style={{marginBottom:8}}>{fmtDate(c.start)} → {fmtDate(c.end)} · {c.modalidad}</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                    <span className="text-muted">Ocupación · {enr}/{c.capacity}</span>
                    <span style={{fontWeight:700,color:'var(--black)'}}>{pct}%</span>
                  </div>
                  <div className="pbar-wrap"><div className="pbar pbar-green" style={{width:`${Math.min(pct,100)}%`}}/></div>
                </div>
              )
            })}
            {activeCourses.length===0&&
              <div style={{padding:20,color:'var(--gray)',fontSize:13,gridColumn:'1/-1'}}>
                No hay cursos activos. <button onClick={()=>setView('courses')}
                  style={{background:'none',border:'none',color:'var(--orange)',cursor:'pointer',fontSize:13,fontFamily:'inherit',textDecoration:'underline'}}>Crear uno</button>.
              </div>}
          </div>
        </section>

        {/* Participantes recientes */}
        <section className="card" style={{padding:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <h3 className="h3" style={{margin:0}}>Participantes recientes</h3>
            <button onClick={()=>setView('participants')}
              style={{background:'none',border:'none',color:'var(--orange)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>
              Ver todos
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column'}}>
            {recent.map((p,i)=>{
              const days = getAccessDays(p, courses)
              const pct  = p.access ? accessPct(p.fecha, days) : 0
              return (
                <div key={p.id} onClick={()=>setView(`profile_${p.id}`)}
                  role="button" tabIndex={0}
                  onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setView(`profile_${p.id}`) } }}
                  aria-label={`Ver perfil de ${p.name}`}
                  className="recent-row"
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',
                    borderTop:i>0?'1px solid var(--cream-2)':'none',cursor:'pointer'}}>
                  <Avatar name={p.name} variant={classifyAccess(p,courses)==='expirado'?'red':classifyAccess(p,courses)==='por_vencer'?'warn':'cream'}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                    <div className="text-xs text-muted" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {p.access ? `Acceso: ${pct}%` : p.email}
                    </div>
                  </div>
                  <TimerBadge fecha={p.fecha} access={p.access} days={days}/>
                </div>
              )
            })}
            {recent.length===0&&<div style={{padding:'12px 0',color:'var(--gray)',fontSize:13}}>Sin participantes todavía.</div>}
          </div>
        </section>
      </div>

      {/* Gráficos */}
      <div className="charts-grid">
        <div className="card card-padded">
          <div className="chart-title">Estado de accesos</div>
          <DonutAccess participants={participants} courses={courses}/>
        </div>
        <div className="card card-padded">
          <div className="chart-title">Inscritos por curso</div>
          <BarChartCourses participants={participants} courses={courses}/>
        </div>
      </div>
    </div>
  )
}
