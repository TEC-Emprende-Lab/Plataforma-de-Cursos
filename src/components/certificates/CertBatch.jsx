import { useState, useEffect } from 'react'
import { useTemplates } from '../../hooks/useTemplates.js'
import { CERT_API } from '../../config.js'
import { generateCertificateBatch } from '../../api/certificates.js'
import { ExtraFieldInput, TODAY_ES, fmtDateEs, TIPO_PREFIX } from './shared.jsx'
import { TemplateCarousel } from './TemplateCarousel.jsx'
import { CertDropZone, CertFormatToggle, Stepper, SectionHeader, CertAlert, ConfettiBurst } from './ui.jsx'

const BUILT_IN_TEMPLATES = []

export function CertBatch({ participants = [], courses = [] }) {
  const { templates, loadSvgContent } = useTemplates()
  const [templateName,   setTemplateName]   = useState(null)
  const [svgFile,        setSvgFile]        = useState(null)
  const [csvFile,        setCsvFile]        = useState(null)
  const [csvMeta,        setCsvMeta]        = useState(null)
  const [nameId,         setNameId]         = useState('recipient_name')
  const [dateId,         setDateId]         = useState('issue_date')
  const [fmt,            setFmt]            = useState('pdf')
  const [loading,        setLoading]        = useState(false)
  const [progress,       setProgress]       = useState(0)
  const [alert,          setAlert]          = useState(null)
  const [result,         setResult]         = useState(null)
  const [confetti,       setConfetti]       = useState(0)
  const [filterCourses,  setFilterCourses]  = useState([])
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterPayment,  setFilterPayment]  = useState('')
  const [certDate,       setCertDate]       = useState(TODAY_ES)
  const [globalDate,     setGlobalDate]     = useState('')
  const [detectedIds,    setDetectedIds]    = useState([])
  const [extraFieldValues, setExtraFieldValues] = useState({})
  const [step,           setStep]           = useState(1)

  const extraIds = detectedIds.filter(({id}) => id !== nameId && id !== dateId)
  const hasTemplate = !!(templateName || svgFile)

  const parseIdsSvg = async (svgTextOrFile) => {
    const text = typeof svgTextOrFile === 'string' ? svgTextOrFile : await svgTextOrFile.text()
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const ids = Array.from(doc.querySelectorAll('text[id]')).map(el => ({
      id: el.getAttribute('id'), text: el.textContent.trim().slice(0, 30),
    }))
    setDetectedIds(ids)
    setExtraFieldValues(prev => {
      const next = {}
      ids.forEach(({id}) => { next[id] = prev[id] ?? '' })
      return next
    })
  }

  const filteredParticipants = participants.filter(p => {
    const matchCourse  = filterCourses.length === 0 ||
                         (p.courses || []).some(cid => filterCourses.includes(cid))
    const matchStatus  = !filterStatus  || p.status  === filterStatus
    const matchPayment = !filterPayment || p.payment === filterPayment
    return matchCourse && matchStatus && matchPayment
  })

  const toggleCourse = (cid) => setFilterCourses(prev =>
    prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid])

  const applyFilters = () => {
    if (!filteredParticipants.length) return
    const lines = ['nombre,fecha', ...filteredParticipants.map(p => `"${p.name}","${certDate}"`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    handleCsvFile(new File([blob], 'participantes_filtrados.csv', { type: 'text/csv' }))
  }

  useEffect(() => {
    if (filterCourses.length !== 1) return
    const course = courses.find(c => c.id === filterCourses[0])
    if (!course) return
    setExtraFieldValues(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(id => {
        if (/line_curso|tipo_curso/i.test(id)) {
          const _prefix = TIPO_PREFIX[course.type] || 'Curso de'
          next[id] = course.name.startsWith(_prefix) ? course.name : `${_prefix} ${course.name}`
        }
        if (/line_fechas|fecha_rango|date_range/i.test(id)) {
          const s = fmtDateEs(course.start), e = fmtDateEs(course.end)
          if (s || e) next[id] = s && e ? `Del ${s} al ${e}` : s || e
        }
        if (/date_issue_1|fecha_inicio/i.test(id) && course.start)
          next[id] = fmtDateEs(course.start)
        if (/date_issue_2|fecha_fin/i.test(id) && course.end)
          next[id] = fmtDateEs(course.end)
      })
      return next
    })
  }, [filterCourses, courses])

  const handleCsvFile = async (file) => {
    if (!file) { setCsvFile(null); setCsvMeta(null); return }
    setCsvFile(file)
    const lines = (await file.text()).trim().split('\n').filter(l => l.trim())
    setCsvMeta({ rows: lines.length - 1, header: lines[0] })
  }

  const downloadSample = () => {
    const csv = `nombre,fecha\nMaría González Rojas,${TODAY_ES}\nCarlos Méndez Alvarado,${TODAY_ES}\nLaura Jiménez Vega,${TODAY_ES}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
    a.download = 'ejemplo_participantes.csv'; a.click()
  }

  const generate = async () => {
    if (!templateName && !svgFile) { setAlert({type:'error',msg:'Seleccioná una plantilla SVG primero.'}); return }
    if (!csvFile) { setAlert({type:'error',msg:'Cargá un archivo CSV con los participantes.'}); return }
    setLoading(true); setAlert(null); setResult(null); setProgress(10)
    const extraFields = {}
    extraIds.forEach(({id}) => { if (extraFieldValues[id]?.trim()) extraFields[id] = extraFieldValues[id].trim() })
    try {
      setProgress(30)
      const { blob, headers } = await generateCertificateBatch({
        file: svgFile || undefined,
        templateName: svgFile ? undefined : templateName,
        csvFile,
        nameFieldId: nameId.trim(),
        dateFieldId: dateId.trim(),
        outputFormat: fmt,
        globalDate: globalDate.trim() || undefined,
        extraFields: Object.keys(extraFields).length ? extraFields : undefined
      })
      setProgress(85)
      const generated = headers.get('X-Generated-Count') || '?'
      const errCount  = headers.get('X-Error-Count') || '0'
      const total     = headers.get('X-Total-Count') || '?'
      if (blob.size < 100) { setAlert({type:'error',msg:'El archivo descargado parece estar vacío. Revisá la consola del servidor.'}); return }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'certificados_lote.zip'
      a.click()
      URL.revokeObjectURL(a.href)
      setProgress(100)
      setResult({generated, errors: errCount, total})
      const errNote = Number(errCount) > 0 ? ` (${errCount} con errores — incluidos en el ZIP como .txt)` : ''
      setAlert({type:'success',msg:`✓ ${generated} de ${total} certificados generados y descargados${errNote}.`})
      if (Number(generated) > 0) setConfetti(c => c + 1)
    } catch(e) {
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setAlert({type:'error',msg:'No se puede conectar con el servidor. Verificá que esté activo.'})
      } else {
        setAlert({type:'error',msg:`Error inesperado: ${e.message}`})
      }
    }
    finally { setLoading(false); setTimeout(() => setProgress(0), 2000) }
  }

  const fInp = { background:'var(--cream-2)', color:'var(--black)', fontSize:12 }

  return (
    <div style={{ maxWidth:760, margin:'0 auto' }}>
      <ConfettiBurst trigger={confetti} />
      <Stepper steps={['Plantilla', 'Participantes', 'Generar']} current={step} onStep={setStep} />
      {step === 1 && (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="layers" label="Plantilla SVG" />
          <div style={{ marginBottom:10 }}>
            <TemplateCarousel
              templates={templates}
              selectedValue={svgFile ? '' : (templateName || '')}
              svgFile={svgFile}
              onSelect={async val => {
                if (!val) { setTemplateName(null); setSvgFile(null); setDetectedIds([]); return }
                const builtin = BUILT_IN_TEMPLATES.find(t => t.file === val)
                if (builtin) {
                  setTemplateName(val); setSvgFile(null)
                  try { const r = await fetch(`${CERT_API}/api/templates/${val}`); if (r.ok) parseIdsSvg(await r.text()) } catch(_) {}
                  return
                }
                const tpl = templates.find(t => t.id === val)
                if (tpl) {
                  const svgText = await loadSvgContent(tpl)
                  if (svgText) { const f = new File([svgText], tpl.file_name, { type:'image/svg+xml' }); setSvgFile(f); setTemplateName(null); parseIdsSvg(svgText) }
                }
              }}
              certApi={CERT_API}
              loadSvgContent={loadSvgContent}
            />
          </div>
          <CertDropZone accept=".svg" title="O subir SVG propio" subtitle="Opcional"
            icon="upload_file" file={svgFile} onFile={f => {
              setSvgFile(f); if (f) { setTemplateName(null); parseIdsSvg(f) } else setDetectedIds([])
            }} />
        </div>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="alt_route" label="Mapeo de campos" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>ID → Nombre</label>
              <input value={nameId} onChange={e => setNameId(e.target.value)}
                className="finput" style={{ background:'var(--cream-2)', fontFamily:'monospace', fontSize:11 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>ID → Fecha</label>
              <input value={dateId} onChange={e => setDateId(e.target.value)}
                className="finput" style={{ background:'var(--cream-2)', fontFamily:'monospace', fontSize:11 }} />
            </div>
          </div>
        </div>
        <button onClick={() => setStep(2)} disabled={!hasTemplate}
          className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
          Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
        </button>
      </div>
      )}
      {step === 2 && (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {participants.length > 0 && (
          <div className="card" style={{ padding:16 }}>
            <SectionHeader icon="filter_list" label="Filtrar participantes" />
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <label style={{ fontSize:11, color:'var(--gray)' }}>
                  Cursos / talleres {filterCourses.length > 0 && `(${filterCourses.length} seleccionado${filterCourses.length !== 1 ? 's' : ''})`}
                </label>
                {filterCourses.length > 0 && (
                  <button onClick={() => setFilterCourses([])}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:11,
                      color:'var(--orange-text)', fontWeight:600 }}>
                    Limpiar
                  </button>
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(courses.some(c => c.certEnabled)
                  ? courses.filter(c => c.active && c.certEnabled)
                  : courses.filter(c => c.active)
                ).map(c => {
                  const on = filterCourses.includes(c.id)
                  return (
                    <button key={c.id} onClick={() => toggleCourse(c.id)} title={c.name}
                      style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        padding:'4px 10px', borderRadius:999, cursor:'pointer',
                        fontSize:12, fontWeight: on ? 600 : 400,
                        border:`1px solid ${on ? 'var(--orange)' : 'var(--border)'}`,
                        background: on ? 'var(--alert-warm-bg)' : 'var(--cream-2)',
                        color: on ? 'var(--orange-d)' : 'var(--gray)',
                        transition:'all .15s',
                      }}>
                      {on && <span className="material-symbols-outlined" style={{fontSize:13}}>check</span>}
                      {c.short || c.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>Estado</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="finput" style={fInp}>
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>Pago</label>
                <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
                  className="finput" style={fInp}>
                  <option value="">Todos</option>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>Fecha del certificado</label>
              <input value={certDate} onChange={e => setCertDate(e.target.value)}
                className="finput" style={fInp} placeholder="22 de mayo de 2026" />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:6 }}>
              <span style={{ fontSize:12, fontWeight:600, color: filteredParticipants.length ? 'var(--black)' : 'var(--gray)' }}>
                {filteredParticipants.length} participante{filteredParticipants.length !== 1 ? 's' : ''} coinciden
              </span>
              <button onClick={applyFilters} disabled={!filteredParticipants.length}
                className="btn btn-orange btn-sm">
                <span className="material-symbols-outlined" style={{fontSize:14}}>group</span>
                Usar estos {filteredParticipants.length}
              </button>
            </div>
          </div>
        )}
        <CertDropZone accept=".csv" title="Arrastrá tu archivo CSV aquí"
          subtitle="Columnas requeridas: nombre, fecha — límite 200 registros"
          icon="upload_file" file={csvFile} onFile={handleCsvFile} />
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="table_view" label="Requisitos del CSV" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[{col:'nombre',ej:'Juan Pérez'},{col:'fecha',ej:TODAY_ES}].map(c => (
              <div key={c.col} style={{ background:'var(--cream-2)', borderRadius:'var(--radius-md)',
                padding:'10px 12px', border:'1px solid var(--border)' }}>
                <p style={{ fontSize:10, color:'var(--gray)', marginBottom:2 }}>Columna requerida</p>
                <p style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'var(--black)' }}>{c.col}</p>
                <p style={{ fontSize:10, color:'var(--gray)', fontStyle:'italic', marginTop:2 }}>Ej: {c.ej}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize:11, color:'var(--gray)', marginBottom:8 }}>
            También acepta: <code>name</code>, <code>participante</code>, <code>date</code>, <code>issue_date</code>
          </p>
          <button onClick={downloadSample} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
            fontWeight:500, color:'var(--orange-text)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <span className="material-symbols-outlined" style={{fontSize:14}}>download</span> Descargar CSV de ejemplo
          </button>
        </div>
        {csvMeta && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="card" style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:11, color:'var(--gray)' }}>Filas detectadas</p>
              <p style={{ fontSize:28, fontWeight:700, color:'var(--black)', marginTop:2 }}>{csvMeta.rows}</p>
            </div>
            <div className="card" style={{ padding:'14px 16px', overflow:'hidden' }}>
              <p style={{ fontSize:11, color:'var(--gray)' }}>Encabezado CSV</p>
              <p style={{ fontSize:11, fontFamily:'monospace', color:'var(--black)', marginTop:4,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{csvMeta.header}</p>
            </div>
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setStep(1)}
            className="btn btn-ghost" style={{ flex:'0 0 auto', justifyContent:'center', padding:'11px 16px', fontSize:14 }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
          </button>
          <button onClick={() => setStep(3)} disabled={!csvFile}
            className="btn btn-orange" style={{ flex:1, justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
          </button>
        </div>
      </div>
      )}
      {step === 3 && (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="tune" label="Configuración de salida" />
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4 }}>
              Fecha global <span style={{ fontWeight:400 }}>(sobreescribe la del CSV)</span>
            </label>
            <input value={globalDate} onChange={e => setGlobalDate(e.target.value)}
              placeholder={`Ej: ${TODAY_ES}`}
              className="finput" style={{ background:'var(--cream-2)', fontSize:11 }} />
          </div>
          {extraIds.length > 0 && (
            <div style={{ paddingTop:10, borderTop:'1px solid var(--cream-3)', display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--gray)' }}>
                Campos adicionales
              </p>
              {extraIds.map(({id}) => (
                <div key={id}>
                  <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:3, fontFamily:'monospace' }}>{id}</label>
                  <ExtraFieldInput id={id} size="xs" courses={courses}
                    value={extraFieldValues[id] ?? ''}
                    onChange={v => setExtraFieldValues(prev => ({...prev, [id]: v}))} />
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:10 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:6 }}>Formato</label>
            <CertFormatToggle value={fmt} onChange={setFmt} />
          </div>
        </div>
        <div style={{ background:'var(--alert-warm-bg)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-lg)', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:38, height:38, background:'var(--action)', borderRadius:'var(--radius-md)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span className="material-symbols-outlined" style={{fontSize:18, color:'var(--action-fg)'}}>folder_zip</span>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--black)' }}>
                {csvMeta ? `${csvMeta.rows} registros listos` : 'Sin CSV cargado'}
              </p>
              <p style={{ fontSize:11, color:'var(--gray)' }}>
                {(templateName||svgFile) ? '✓ Plantilla seleccionada' : 'Falta seleccionar plantilla'}
              </p>
            </div>
          </div>
          {progress > 0 && (
            <div style={{ height:4, borderRadius:20, background:'var(--cream-3)', overflow:'hidden', marginBottom:12 }}>
              <div style={{ height:'100%', background:'var(--action)', borderRadius:20, transition:'width .5s', width:`${progress}%` }} />
            </div>
          )}
          <button onClick={generate} disabled={loading || (!templateName && !svgFile) || !csvFile}
            className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            {loading
              ? <><span className="material-symbols-outlined spinner" style={{fontSize:16}}>refresh</span>Procesando…</>
              : <><span className="material-symbols-outlined" style={{fontSize:16}}>folder_zip</span>Generar ZIP</>}
          </button>
        </div>
        {result && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:'var(--radius-lg)',
              padding:'12px 16px', textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--green)' }}>Generados</p>
              <p style={{ fontSize:24, fontWeight:700, color:'var(--green)' }}>{result.generated}</p>
            </div>
            <div style={{ background: Number(result.errors) > 0 ? 'var(--row-exp-bg)' : 'var(--cream-2)',
              border:`1px solid ${Number(result.errors) > 0 ? 'var(--orange-d)' : 'var(--border)'}`,
              borderRadius:'var(--radius-lg)', padding:'12px 16px', textAlign:'center' }}>
              <p style={{ fontSize:11, color: Number(result.errors) > 0 ? 'var(--orange-d)' : 'var(--gray)' }}>Errores</p>
              <p style={{ fontSize:24, fontWeight:700, color: Number(result.errors) > 0 ? 'var(--orange-d)' : 'var(--black)' }}>{result.errors}</p>
            </div>
          </div>
        )}
        <CertAlert type={alert?.type} msg={alert?.msg} onDismiss={() => setAlert(null)} />
        <button onClick={() => setStep(2)}
          className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'10px 0', fontSize:14 }}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
        </button>
      </div>
      )}
    </div>
  )
}
