// ============================================================
//  Charts.jsx — Gráficos SVG hechos a mano.
//  Sin librerías externas; los colores vienen de tokens CSS
//  para respetar dark mode automáticamente.
// ============================================================

import { classifyAccess } from '../utils/time.js'

// ── Donut: estado de accesos ──────────────────────────────
/**
 * Donut con 3 segmentos: con acceso vigente / por vencer ≤7d / expirados.
 * No cuenta participantes en 'sin_acceso' (sin acceso habilitado y con
 * vigencia aún viva). Los expirados se cuentan aunque la marca de acceso
 * ya se haya revocado.
 */
export function DonutAccess({ participants, courses }) {
  let activos = 0, warning = 0, expired = 0
  for (const p of participants) {
    const st = classifyAccess(p, courses)
    if (st === 'sin_acceso') continue
    if (st === 'expirado')      expired++
    else if (st === 'por_vencer') warning++
    else                          activos++
  }
  const total = activos + warning + expired

  const SIZE = 160
  const R    = 60
  const C    = 2 * Math.PI * R
  const cx = SIZE / 2, cy = SIZE / 2

  // Segmentos con offset acumulado
  const segs = [
    { value: activos, color: 'var(--green)',    label: 'Vigentes' },
    { value: warning, color: 'var(--orange)',   label: 'Por vencer' },
    { value: expired, color: 'var(--orange-d)', label: 'Expirados' },
  ]
  let acc = 0
  const arcs = segs.map(s => {
    const frac    = total ? s.value / total : 0
    const dash    = frac * C
    const offset  = -acc
    acc += dash
    return { ...s, dash, offset, frac }
  })

  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Estado de accesos">
        {/* Pista de fondo */}
        <circle cx={cx} cy={cy} r={R} fill="none"
          stroke="var(--cream-3)" strokeWidth={18}/>
        {/* Segmentos */}
        {total > 0 && arcs.map((a, i) => a.value > 0 && (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={a.color} strokeWidth={18}
            strokeDasharray={`${a.dash} ${C - a.dash}`}
            strokeDashoffset={a.offset}
            transform={`rotate(-90 ${cx} ${cy})`}/>
        ))}
        {/* Total al centro */}
        <text x={cx} y={cy - 2} textAnchor="middle"
          fontFamily="var(--font-display)" fontSize="22" fontWeight="600"
          fill="var(--black)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          fontSize="10" fill="var(--gray)">participantes</text>
      </svg>

      <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:8, fontSize:13, minWidth:140 }}>
        {arcs.map((a, i) => (
          <li key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:a.color, flexShrink:0 }}/>
            <span style={{ flex:1, color:'var(--black)' }}>{a.label}</span>
            <span style={{ fontWeight:600, color:'var(--black)' }}>{a.value}</span>
            <span className="text-xs text-muted" style={{ minWidth:38, textAlign:'right' }}>
              {total ? Math.round(a.frac * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Bar chart: inscritos por curso activo ─────────────────
/**
 * Barras horizontales con ocupación de cada curso activo.
 * Si no hay cursos activos, muestra mensaje vacío.
 */
export function BarChartCourses({ participants, courses }) {
  const activeCourses = courses.filter(c => c.active)

  if (!activeCourses.length) {
    return (
      <div className="text-sm text-muted" style={{ padding:'8px 0' }}>
        No hay cursos activos.
      </div>
    )
  }

  const rows = activeCourses.map(c => {
    const enr = participants.filter(p => p.courses.includes(c.id)).length
    const pct = Math.min(100, Math.round(enr / c.capacity * 100))
    const cls = pct >= 100 ? 'pbar pbar-exp' : pct >= 80 ? 'pbar pbar-warn' : 'pbar pbar-green'
    return { ...c, enr, pct, cls }
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {rows.map(r => (
        <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ fontWeight:500, color:'var(--black)' }}>{r.short}</span>
            <span className="text-muted">{r.enr}/{r.capacity}</span>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <div className="pbar-wrap">
              <div className={r.cls} style={{ width:`${r.pct}%` }}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
