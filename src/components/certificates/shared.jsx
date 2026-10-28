import { useState, useRef, useCallback } from 'react'

const TODAY_ES = (() => {
  const d = new Date()
  const m = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
             'septiembre','octubre','noviembre','diciembre']
  return `${d.getDate()} de ${m[d.getMonth()]} de ${d.getFullYear()}`
})()

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const fmtDateEs = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_ES[m-1]} de ${y}`
}

const TIPO_PREFIX = { taller:'Taller de', curso:'Curso de', seminario:'Seminario de', bootcamp:'Bootcamp de', charla:'Charla sobre' }

export { TODAY_ES, MESES_ES, fmtDateEs, TIPO_PREFIX }

export function ExtraFieldInput({ id, value, onChange, size = 'sm', courses = [] }) {
  const isTipo       = /line_curso|tipo_curso/i.test(id)
  const isDateRange  = /line_fechas|fecha_rango|date_range/i.test(id)
  const isSingleDate = /date_issue_[12]|fecha_inicio|fecha_fin/i.test(id)
  const [startIso,  setStartIso]  = useState('')
  const [endIso,    setEndIso]    = useState('')

  const fst = { background:'var(--cream-2)', color:'var(--black)', fontSize: size === 'xs' ? 11 : 13 }

  if (isTipo) {
    const certCourses = courses.some(c => c.certEnabled)
      ? courses.filter(c => c.active && c.certEnabled)
      : courses.filter(c => c.active)
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="finput" style={fst}>
        <option value="">— Seleccionar curso/taller —</option>
        {certCourses.map(c => {
          const prefix = TIPO_PREFIX[c.type] || 'Curso de'
          const label = c.name.startsWith(prefix) ? c.name : `${prefix} ${c.name}`
          return <option key={c.id} value={label}>{label}</option>
        })}
      </select>
    )
  }

  if (isDateRange) {
    const emit = (s, e) => {
      const sf = fmtDateEs(s), ef = fmtDateEs(e)
      onChange(sf && ef ? `Del ${sf} al ${ef}` : sf || ef || '')
    }
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:4 }}>Fecha inicio</p>
            <input type="date" value={startIso}
              onChange={e => { setStartIso(e.target.value); emit(e.target.value, endIso) }}
              className="finput" style={fst} />
          </div>
          <div>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:4 }}>Fecha fin</p>
            <input type="date" value={endIso}
              onChange={e => { setEndIso(e.target.value); emit(startIso, e.target.value) }}
              className="finput" style={fst} />
          </div>
        </div>
        {value && (
          <p style={{ fontSize:11, color:'var(--gray)', fontStyle:'italic', display:'flex', alignItems:'center', gap:4 }}>
            <span className="material-symbols-outlined" style={{fontSize:12}}>event</span>
            {value}
          </p>
        )}
      </div>
    )
  }

  if (isSingleDate) {
    return (
      <div>
        <p style={{ fontSize:11, color:'var(--gray)', marginBottom:4 }}>
          {id === 'date_issue_1' ? 'Fecha de inicio' : 'Fecha de finalización'}
        </p>
        <input type="date" value={value}
          onChange={e => onChange(e.target.value)}
          className="finput" style={fst} />
      </div>
    )
  }

  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={`Valor para ${id}`} className="finput" style={fst} />
  )
}

export function useDebounce(fn, delay) {
  const t = useRef(null)
  return useCallback((...args) => {
    clearTimeout(t.current)
    t.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}
