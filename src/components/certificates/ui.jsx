import { useState, useEffect, useRef } from 'react'

export function ConfettiBurst({ trigger }) {
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
        p.vy += 0.4
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

export function CertAlert({ type, msg, onDismiss }) {
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

export function CertDropZone({ accept, title, subtitle, icon, file, onFile }) {
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
          <span className="material-symbols-outlined" style={{fontSize:30, color:'var(--orange-text)', display:'block', marginBottom:8}}>{icon}</span>
          <p style={{ fontSize:13, fontWeight:500, color:'var(--black)' }}>{title}</p>
          {subtitle && <p style={{ fontSize:11, color:'var(--gray)', marginTop:2 }}>{subtitle}</p>}
        </>
      )}
    </div>
  )
}

export function CertFormatToggle({ value, onChange }) {
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

export function Stepper({ steps, current, onStep }) {
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
                background: active ? 'var(--action)' : done ? 'var(--green)' : 'var(--cream-3)',
                color: active || done ? 'var(--action-fg)' : 'var(--black)',
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

export function SectionHeader({ icon, label, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14,
      paddingBottom:12, borderBottom:'1px solid var(--cream-3)' }}>
      <span className="material-symbols-outlined" style={{ fontSize:16, color:'var(--orange-text)' }}>{icon}</span>
      <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
        letterSpacing:'.6px', color:'var(--gray)', flex:1 }}>{label}</span>
      {action}
    </div>
  )
}
