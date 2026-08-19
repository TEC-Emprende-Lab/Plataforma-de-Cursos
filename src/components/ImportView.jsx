// ============================================================
//  ImportView.jsx — React JSX
//  Importa participantes desde un CSV con columnas
//    Cédula, Nombre y apellidos, Facturar a nombre de, Teléfono, Correo
//  Hace match contra los participantes existentes por email
//  (y cédula como fallback). Muestra un panel de confirmación
//  con los que se agregarán (nuevos) y los que ya existen.
// ============================================================

import { useState, useRef } from 'react'
import { todayISO } from '../utils/time.js'
import { normalizeCedula } from '../utils/cedula.js'
import { mapWithConcurrency } from '../utils/async.js'
import { HACIENDA_API } from '../config.js'

// ---------- CSV parser robusto ----------
// El CSV puede traer filas malformadas (columnas duplicadas, comas extra
// dentro de la fila). Detectamos cada campo por su tipo en lugar de
// confiar en la posición:
//   - email: contiene '@'
//   - cédula: solo dígitos, 8-15 chars
//   - teléfono: 8 dígitos (CR) o con guión (8888-8888)
//   - nombre: el token restante más largo no numérico

const EMAIL_RE   = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const CEDULA_RE  = /^\d{8,15}$/
const PHONE_RE   = /^\d{4}-?\d{4}$/

function splitCsvLine(line) {
  // Sin soporte de comillas porque el formato del TEC no las usa.
  // Si en el futuro las trae, cambiar a un parser tipo papaparse.
  return line.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

function parseRow(tokens) {
  let email = null, cedula = null, phone = null
  const others = []
  for (const t of tokens) {
    if (!email && EMAIL_RE.test(t)) { email = t.match(EMAIL_RE)[0]; continue }
    if (!cedula && CEDULA_RE.test(t)) { cedula = t; continue }
    if (!phone && PHONE_RE.test(t.replace(/\s/g,''))) { phone = t.replace(/\s/g,''); continue }
    others.push(t)
  }
  // Nombre = token alfa más largo (suele ser el nombre completo)
  const name = others
    .filter(t => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(t))
    .sort((a, b) => b.length - a.length)[0] || ''
  return { name, cedula, email, phone }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { rows: [], errors: [] }

  // Detectar y descartar header
  const first = lines[0].toLowerCase()
  const startIdx = first.includes('cédula') || first.includes('cedula') ||
                   first.includes('correo')  || first.includes('email')  ? 1 : 0

  const rows = []
  const errors = []
  for (let i = startIdx; i < lines.length; i++) {
    const tokens = splitCsvLine(lines[i])
    if (!tokens.length) continue
    const row = parseRow(tokens)
    if (!row.name && !row.email && !row.cedula) {
      errors.push({ line: i + 1, raw: lines[i] })
      continue
    }
    rows.push(row)
  }
  return { rows, errors }
}

// ---------- Match contra DB ----------
function matchExisting(rows, participants) {
  const byEmail  = new Map()
  const byCedula = new Map()
  for (const p of participants) {
    if (p.email)  byEmail.set(p.email.toLowerCase(), p)
    if (p.cedula) byCedula.set(normalizeCedula(p.cedula), p)
  }
  const nuevos = []
  const existentes = []
  for (const r of rows) {
    const existing =
      (r.email  && byEmail.get(r.email.toLowerCase())) ||
      (r.cedula && byCedula.get(normalizeCedula(r.cedula)))
    if (existing) existentes.push({ csv: r, db: existing })
    else          nuevos.push(r)
  }
  return { nuevos, existentes }
}

// ---------- Vista ----------
export default function ImportView({ participants, courses = [], onImport, onBulkUpdate }) {
  const [csvText,     setCsvText]     = useState('')
  const [parseRes,    setParseRes]    = useState(null)
  const [matchRes,    setMatchRes]    = useState(null)
  const [selected,    setSelected]    = useState(new Set())
  const [drag,        setDrag]        = useState(false)
  const [done,        setDone]        = useState(false)
  const [importedIds, setImportedIds] = useState([])
  // fecha de ingreso por fila (índice → 'YYYY-MM-DD'); default = hoy
  const [rowFechas,   setRowFechas]   = useState({})
  const [bulkFecha,   setBulkFecha]   = useState(todayISO())
  const [tab,         setTab]         = useState('nuevos')   // nuevos | existentes | errores

  // Panel post-import (bulk-edit)
  const [bulkCourses,     setBulkCourses]     = useState(new Set())
  const [bulkPayment,     setBulkPayment]     = useState('none')   // 'pagado' | 'pendiente' | 'none'
  const [bulkAccess,      setBulkAccess]      = useState('none')   // 'on' | 'off' | 'none'
  const [bulkAccessFecha, setBulkAccessFecha] = useState(todayISO())
  const [bulkApplying,    setBulkApplying]    = useState(false)
  const [enriching,       setEnriching]       = useState(false)
  const [enrichStats,     setEnrichStats]     = useState(null)

  const fileRef = useRef()

  const enrichWithTSE = async (rows) => {
    const conCedula = rows.filter(r => r.cedula)
    if (!conCedula.length) return { rows, found: 0, corrected: 0 }

    // Consultar Hacienda en paralelo (hasta 6 a la vez). Cada tarea
    // devuelve su resultado y luego se agrega, evitando mutar contadores
    // compartidos durante la concurrencia.
    const tseResults = await mapWithConcurrency(conCedula, 6, async (row) => {
      const ced = normalizeCedula(row.cedula)
      try {
        const res = await fetch(
          `${HACIENDA_API}?identificacion=${ced}`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (res.ok) {
          const data = await res.json()
          const nombre = (data.nombre || '').trim().toUpperCase()
          if (nombre) return { row, nombre }
        }
      } catch { /* API no disponible, dejamos el nombre del CSV */ }
      return { row, nombre: null }
    })

    let found = 0, corrected = 0
    const enriched = [...rows]
    for (const { row, nombre } of tseResults) {
      if (!nombre) continue
      found++
      if (nombre !== row.name.trim().toUpperCase()) corrected++
      const idx = enriched.indexOf(row)
      if (idx !== -1) enriched[idx] = { ...row, name: nombre }
    }
    return { rows: enriched, found, corrected }
  }

  const processFile = (file) => {
    if (!file) return
    setDone(false); setMatchRes(null); setParseRes(null); setSelected(new Set())
    setRowFechas({}); setEnrichStats(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target.result
      setCsvText(text)
      const parsed = parseCsv(text)

      // Consultar TSE para enriquecer nombres con cédula
      let rows = parsed.rows
      if (parsed.rows.some(r => r.cedula)) {
        setEnriching(true)
        try {
          const result = await enrichWithTSE(parsed.rows)
          rows = result.rows
          setEnrichStats({ found: result.found, corrected: result.corrected, total: parsed.rows.filter(r => r.cedula).length })
        } catch { /* silencioso */ }
        finally { setEnriching(false) }
      }

      setParseRes({ ...parsed, rows })
      const m = matchExisting(rows, participants)
      setMatchRes(m)
      setTab('nuevos')
      setSelected(new Set(m.nuevos.map((_, i) => i)))
      const fechas = {}
      m.nuevos.forEach((_, i) => { fechas[i] = todayISO() })
      setRowFechas(fechas)
    }
    reader.readAsText(file, 'utf-8')
  }

  const reset = () => {
    setCsvText(''); setParseRes(null); setMatchRes(null)
    setSelected(new Set()); setDone(false)
    setImportedIds([])
    setBulkCourses(new Set()); setBulkPayment('none'); setBulkAccess('none')
    setBulkAccessFecha(todayISO())
    setRowFechas({}); setBulkFecha(todayISO())
    setTab('nuevos')
    if (fileRef.current) fileRef.current.value = ''
  }

  const setRowFecha = (i, val) => setRowFechas(prev => ({ ...prev, [i]: val }))
  const applyBulkFechaAll = () => {
    if (!matchRes) return
    const next = {}
    matchRes.nuevos.forEach((_, i) => { next[i] = bulkFecha })
    setRowFechas(next)
  }

  const toggleBulkCourse = (cid) => {
    setBulkCourses(prev => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid); else next.add(cid)
      return next
    })
  }

  const applyBulk = async () => {
    if (!importedIds.length) return
    const patch = {}
    if (bulkPayment !== 'none') patch.payment = bulkPayment
    if (bulkAccess === 'on')    Object.assign(patch, { access: true,  fecha: bulkAccessFecha || todayISO() })
    if (bulkAccess === 'off')   patch.access = false
    const addCourses = [...bulkCourses]

    if (!Object.keys(patch).length && !addCourses.length) {
      reset()
      return
    }
    setBulkApplying(true)
    try {
      const result = await onBulkUpdate?.(importedIds, patch, addCourses)
      if (!result?.error) reset()
    } finally {
      setBulkApplying(false)
    }
  }

  const skipBulk = () => reset()

  const toggle = (i) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }
  const toggleAll = () => {
    if (!matchRes) return
    setSelected(prev =>
      prev.size === matchRes.nuevos.length
        ? new Set()
        : new Set(matchRes.nuevos.map((_, i) => i))
    )
  }

  const confirm = async () => {
    if (!matchRes || !selected.size) return
    const toImport = [...selected].map(i => ({
      ...matchRes.nuevos[i],
      fecha: rowFechas[i] || todayISO(),
    }))
    const ids = await onImport(toImport)
    if (ids?.error) return
    setImportedIds(Array.isArray(ids) ? ids : [])
    setDone(true)
    setMatchRes(null)
    setParseRes(null)
    setSelected(new Set())
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="h1">Importar CSV</h2>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 3 }}>
            Subí el CSV de matrícula. El sistema detecta automáticamente quién ya está y quién es nuevo.
          </p>
        </div>
      </div>

      {!matchRes && !done && (
        <>
          <div className={`drop-area${drag ? ' drag' : ''}`}
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]) }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize: 36, color: 'var(--gray)', display: 'block', marginBottom: 10 }}/>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6 }}>
              Arrastrá el archivo CSV aquí o hacé clic para seleccionar
            </div>
            <div className="text-sm text-muted">
              Columnas esperadas: Cédula, Nombre y apellidos, Teléfono, Correo
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => processFile(e.target.files[0])}/>
        </>
      )}

      {done && (
        <>
          <div style={{
            marginTop: 16, padding: 14, background: '#E4F0E8',
            border: '1px solid #3D7A5A', borderRadius: 8, fontSize: 13,
          }}>
            <i className="ti ti-check"/> Importación completada — {importedIds.length} participante{importedIds.length !== 1 ? 's' : ''} agregado{importedIds.length !== 1 ? 's' : ''}.
          </div>

          {importedIds.length > 0 && onBulkUpdate && (
            <div style={{
              marginTop: 16,
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
            }}>
              <h3 className="h3" style={{ marginBottom: 4 }}>Aplicar atributos en lote</h3>
              <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                Configurá los valores para los {importedIds.length} participantes que acabás de importar.
                Lo que dejes en "Sin cambio" no se modifica.
              </p>

              {/* Cursos */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>
                  Inscribir en cursos
                </div>
                {courses.length === 0 && (
                  <div className="text-sm text-muted">No hay cursos cargados todavía.</div>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 8,
                }}>
                  {courses.map(c => (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: bulkCourses.has(c.id) ? '#FEF8F2' : 'transparent',
                      fontSize: 12,
                    }}>
                      <input type="checkbox"
                        checked={bulkCourses.has(c.id)}
                        onChange={() => toggleBulkCourse(c.id)}/>
                      <span style={{ flex: 1, minWidth: 0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.short || c.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pago */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>
                  Estado de pago
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                  <Radio name="pay" value="pagado"    checked={bulkPayment === 'pagado'}    onChange={setBulkPayment} label="Pagado"/>
                  <Radio name="pay" value="pendiente" checked={bulkPayment === 'pendiente'} onChange={setBulkPayment} label="Pendiente"/>
                  <Radio name="pay" value="none"      checked={bulkPayment === 'none'}      onChange={setBulkPayment} label="Sin cambio"/>
                </div>
              </div>

              {/* Acceso */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>
                  Acceso al contenido
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                  <Radio name="acc" value="on"   checked={bulkAccess === 'on'}   onChange={setBulkAccess} label="Activar (45 días)"/>
                  <Radio name="acc" value="off"  checked={bulkAccess === 'off'}  onChange={setBulkAccess} label="Sin acceso"/>
                  <Radio name="acc" value="none" checked={bulkAccess === 'none'} onChange={setBulkAccess} label="Sin cambio"/>
                </div>
                {bulkAccess === 'on' && (
                  <div style={{ marginTop: 10, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <label className="text-sm text-muted" htmlFor="bulk-fecha">
                      Fecha de inicio de acceso
                    </label>
                    <input id="bulk-fecha" className="finput" type="date"
                      value={bulkAccessFecha}
                      onChange={e => setBulkAccessFecha(e.target.value)}
                      style={{ maxWidth:180 }}/>
                    <span className="text-xs text-muted">
                      Se contarán 45 días desde esta fecha.
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-orange"
                  disabled={bulkApplying}
                  onClick={applyBulk}>
                  {bulkApplying
                    ? <><i className="ti ti-loader-2 spinner"/> Aplicando…</>
                    : <><i className="ti ti-check"/> Aplicar a los {importedIds.length}</>}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={bulkApplying}
                  onClick={skipBulk}>
                  Saltar este paso
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {enriching && (
        <div style={{ margin:'16px 0', padding:'12px 16px', borderRadius:10,
          background:'#eff6ff', border:'1px solid #bfdbfe', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>
          <span style={{ fontSize:13, color:'#1d4ed8' }}>Consultando el Registro Civil para corregir nombres...</span>
        </div>
      )}

      {enrichStats && (
        <div style={{ margin:'0 0 12px', padding:'10px 14px', borderRadius:10,
          background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:13, color:'#15803d' }}>
          <i className="ti ti-id-badge"/> Registro Civil: {enrichStats.found}/{enrichStats.total} encontrados
          {enrichStats.corrected > 0
            ? <> · <strong>{enrichStats.corrected} nombre{enrichStats.corrected !== 1 ? 's' : ''} corregido{enrichStats.corrected !== 1 ? 's' : ''}</strong></>
            : <> · Todos los nombres coinciden</>}
        </div>
      )}

      {matchRes && (
        <div style={{ marginTop: 20 }}>
          {/* Pestañas de resultados */}
          <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--border)', marginBottom:16, flexWrap:'wrap' }}>
            <TabBtn id="nuevos"     active={tab==='nuevos'}     onClick={setTab} label="Nuevos"     count={matchRes.nuevos.length}/>
            <TabBtn id="existentes" active={tab==='existentes'} onClick={setTab} label="Ya existen" count={matchRes.existentes.length} accent="var(--gray)"/>
            {parseRes.errors.length > 0 && (
              <TabBtn id="errores"  active={tab==='errores'}    onClick={setTab} label="Errores"    count={parseRes.errors.length} accent="#A32D2D"/>
            )}
          </div>

          {tab === 'nuevos' && matchRes.nuevos.length === 0 && (
            <div className="card" style={{ padding:32, textAlign:'center', color:'var(--gray)', fontSize:13 }}>
              No hay participantes nuevos en este CSV — todos ya existen.
            </div>
          )}

          {tab === 'nuevos' && matchRes.nuevos.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap:'wrap', gap:8 }}>
                <h3 className="h3">Nuevos participantes ({matchRes.nuevos.length})</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                    {selected.size === matchRes.nuevos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                  <button className="btn btn-orange btn-sm"
                    disabled={!selected.size}
                    onClick={confirm}>
                    <i className="ti ti-check"/> Confirmar e importar ({selected.size})
                  </button>
                </div>
              </div>
              {/* Aplicar fecha de ingreso en lote */}
              <div style={{
                display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
                padding:'10px 14px', background:'var(--cream-2)',
                border:'1px solid var(--border)', borderTopLeftRadius:8, borderTopRightRadius:8,
                borderBottom:'none', fontSize:12,
              }}>
                <i className="ti ti-calendar" style={{ color:'var(--orange)' }}/>
                <span className="font-medium">Fecha de ingreso</span>
                <span className="text-muted">— editable por fila o aplicar a todos:</span>
                <input className="finput" type="date"
                  value={bulkFecha}
                  onChange={e => setBulkFecha(e.target.value)}
                  style={{ maxWidth:160, padding:'5px 8px' }}/>
                <button className="btn btn-ghost btn-sm"
                  type="button" onClick={applyBulkFechaAll}>
                  <i className="ti ti-arrow-down"/> Aplicar a todos
                </button>
              </div>
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderTop:'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                {matchRes.nuevos.map((r, i) => (
                  <RowItem key={i}
                    selected={selected.has(i)}
                    onToggle={() => toggle(i)}
                    row={r}
                    fecha={rowFechas[i] || todayISO()}
                    onFechaChange={(v) => setRowFecha(i, v)}/>
                ))}
              </div>
            </>
          )}

          {tab === 'existentes' && (
            matchRes.existentes.length > 0 ? (
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {matchRes.existentes.map((m, i) => (
                  <div key={i} style={{ padding: '10px 14px', borderBottom: i < matchRes.existentes.length - 1 ? '1px solid var(--cream-2)' : 'none', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{m.db.name}</span>
                    <span className="text-muted"> · {m.db.email || m.db.cedula}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ padding:32, textAlign:'center', color:'var(--gray)', fontSize:13 }}>
                Ningún participante del CSV existe todavía en la base.
              </div>
            )
          )}

          {tab === 'errores' && parseRes.errors.length > 0 && (
            <div style={{ background: '#FCEBEB', border: '1px solid #A32D2D33', borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
              {parseRes.errors.map(e => (
                <div key={e.line}>línea {e.line}: {e.raw}</div>
              ))}
            </div>
          )}

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={reset}>
            <i className="ti ti-x"/> Cancelar y subir otro CSV
          </button>
        </div>
      )}
    </div>
  )
}

function TabBtn({ id, active, onClick, label, count, accent = 'var(--orange)' }) {
  return (
    <button onClick={() => onClick(id)}
      aria-current={active ? 'true' : undefined}
      style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'10px 16px',
        background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13,
        fontWeight: active ? 600 : 400, color: active ? accent : 'var(--gray)',
        borderBottom: `2px solid ${active ? accent : 'transparent'}`, marginBottom:-1,
      }}>
      {label}
      <span style={{ fontSize:11, fontWeight:700, padding:'1px 8px', borderRadius:20,
        background: active ? accent : 'var(--cream-3)',
        color: active ? '#fff' : 'var(--gray)' }}>{count}</span>
    </button>
  )
}

function RowItem({ selected, onToggle, row, fecha, onFechaChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap:'wrap',
      padding: '10px 14px', borderBottom: '1px solid var(--cream-2)',
      background: selected ? '#FEF8F2' : 'transparent',
    }}>
      <label style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0, cursor:'pointer' }}>
        <input type="checkbox" checked={selected} onChange={onToggle}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {row.name || <span className="text-muted">(sin nombre)</span>}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            {row.cedula && <>Céd. {row.cedula} · </>}
            {row.email || <em>sin correo</em>}
            {row.phone && <> · {row.phone}</>}
          </div>
        </div>
      </label>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <span className="text-xs text-muted" style={{ whiteSpace:'nowrap' }}>Ingreso:</span>
        <input
          type="date"
          className="finput"
          value={fecha || ''}
          onChange={e => onFechaChange?.(e.target.value)}
          disabled={!selected}
          style={{ maxWidth:150, padding:'5px 8px', fontSize:12,
            opacity: selected ? 1 : .5 }}/>
      </div>
    </div>
  )
}

function Radio({ name, value, checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <input type="radio" name={name} value={value} checked={checked}
        onChange={() => onChange(value)}/>
      {label}
    </label>
  )
}
