import { useState, useEffect, useCallback } from 'react'
import { useTemplates } from '../../hooks/useTemplates.js'
import { CERT_API } from '../../config.js'
import { svgPreviewMarkup } from '../../utils/svg.js'
import { previewCertificate, generateCertificate } from '../../api/certificates.js'
import { ExtraFieldInput, useDebounce, TODAY_ES, fmtDateEs } from './shared.jsx'
import { TemplateCarousel } from './TemplateCarousel.jsx'
import { CertDropZone, CertFormatToggle, Stepper, SectionHeader, CertAlert } from './ui.jsx'

const BUILT_IN_TEMPLATES = []

export function CertIndividual({ participants, courses = [], galleryTplPick, onGalleryConsumed }) {
  const { templates, loadSvgContent } = useTemplates()
  const [templateName,    setTemplateName]    = useState(null)
  const [svgFile,         setSvgFile]         = useState(null)
  const [nameId,          setNameId]          = useState('recipient_name')
  const [dateId,          setDateId]          = useState('issue_date')
  const [recipient,       setRecipient]       = useState('')
  const [date,            setDate]            = useState(TODAY_ES)
  const [fmt,             setFmt]             = useState('pdf')
  const [detectedIds,     setDetectedIds]     = useState([])
  const [extraFieldValues,setExtraFieldValues]= useState({})
  const [loading,         setLoading]         = useState(false)
  const [alert,           setAlert]           = useState(null)
  const [previewSvg,      setPreviewSvg]      = useState(null)
  const [previewLoading,  setPreviewLoading]  = useState(false)
  const [errors,          setErrors]          = useState({})
  const [step,            setStep]            = useState(1)
  const [filterCourse,    setFilterCourse]    = useState('')

  const extraIds = detectedIds.filter(({id}) => id !== nameId && id !== dateId)
  const eligibleParticipants = participants.filter(p =>
    p.status === 'activo' &&
    (!filterCourse || (p.courses || []).includes(filterCourse)))

  const hasTemplate = !!(templateName || svgFile)
  const dataValid   = recipient.trim().length >= 2 && date.trim().length >= 4

  const buildFields = (rcp, dt, nId, dId, extra) => {
    const fields = {}
    if (rcp && nId) fields[nId] = rcp
    if (dt  && dId) fields[dId] = dt
    Object.entries(extra || {}).forEach(([k, v]) => { if (v) fields[k] = v })
    return fields
  }

  useEffect(() => {
    if (!galleryTplPick) return
    if (galleryTplPick._file) {
      setSvgFile(galleryTplPick._file)
      setTemplateName(null)
    } else {
      setTemplateName(galleryTplPick.file)
      setSvgFile(null)
    }
    if (galleryTplPick.ids?.name) setNameId(galleryTplPick.ids.name)
    if (galleryTplPick.ids?.date) setDateId(galleryTplPick.ids.date)
    if (onGalleryConsumed) onGalleryConsumed()
  }, [galleryTplPick])

  const doPreview = useCallback(async (tpl, file, rcp, dt, nId, dId, extra) => {
    if (!tpl && !file) return
    const fields = buildFields(rcp, dt, nId, dId, extra)
    setPreviewLoading(true)
    try {
      const svg = await previewCertificate({
        file: file || undefined,
        templateName: file ? undefined : tpl,
        fields: Object.keys(fields).length ? fields : undefined,
        nameFieldId: nId || undefined,
        dateFieldId: dId || undefined
      })
      setPreviewSvg(svg)
    } catch(_) {}
    finally { setPreviewLoading(false) }
  }, [])

  const debouncedPreview = useDebounce(doPreview, 380)
  useEffect(() => { debouncedPreview(templateName, svgFile, recipient, date, nameId, dateId, extraFieldValues) },
    [templateName, svgFile, recipient, date, nameId, dateId, extraFieldValues])

  const parseIds = async (file) => {
    const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml')
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

  const selectTemplate = async (val) => {
    if (!val) { setTemplateName(null); setSvgFile(null); return }
    const builtin = BUILT_IN_TEMPLATES.find(t => t.file === val)
    if (builtin) {
      setTemplateName(val); setSvgFile(null)
      try {
        const r = await fetch(`${CERT_API}/api/templates/${val}`)
        if (r.ok) {
          const txt = await r.text()
          parseIds(new File([new Blob([txt], {type:'image/svg+xml'})], val))
        }
      } catch(_) {}
      return
    }
    const tpl = templates.find(t => t.id === val)
    if (tpl) {
      const svgText = await loadSvgContent(tpl)
      if (svgText) {
        const file = new File([svgText], tpl.file_name, { type: 'image/svg+xml' })
        setSvgFile(file); setTemplateName(null)
        parseIds(file)
        if (tpl.name_id) setNameId(tpl.name_id)
        if (tpl.date_id) setDateId(tpl.date_id)
      }
    }
  }

  const validate = () => {
    const e = {}
    if (!recipient.trim() || recipient.trim().length < 2) e.recipient = 'Nombre demasiado corto'
    if (!date.trim() || date.trim().length < 4) e.date = 'Ingresa una fecha válida'
    setErrors(e); return Object.keys(e).length === 0
  }

  const generate = async () => {
    if (!validate()) return
    if (!templateName && !svgFile) { setAlert({type:'error',msg:'Seleccioná una plantilla primero.'}); return }
    setLoading(true); setAlert(null)
    const fields = buildFields(recipient.trim(), date.trim(), nameId.trim(), dateId.trim(), extraFieldValues)
    try {
      const blob = await generateCertificate({
        file: svgFile || undefined,
        templateName: svgFile ? undefined : templateName,
        fields: Object.keys(fields).length ? fields : undefined,
        nameFieldId: nameId.trim(),
        dateFieldId: dateId.trim(),
        outputFormat: fmt
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `certificado_${recipient.trim().replace(/\s+/g,'_')}.${fmt}`
      a.click(); URL.revokeObjectURL(a.href)
      setAlert({type:'success',msg:`¡Certificado generado para ${recipient.trim()}!`})
    } catch(e) { setAlert({type:'error',msg:`Error: ${e.message}`}) }
    finally { setLoading(false) }
  }

  const idPillStyle = (active) => ({
    padding:'3px 10px', borderRadius:20, fontSize:11, fontFamily:'monospace', cursor:'pointer',
    border:`1px solid ${active ? 'var(--black)' : 'var(--border)'}`,
    background: active ? 'var(--black)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--gray)',
    transition:'all .15s',
  })

  return (
    <div style={{ display:'flex', gap:20 }}>
      <div style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column', gap:14 }}>
        <Stepper steps={['Plantilla', 'Datos', 'Generar']} current={step} onStep={setStep} />
        {step === 1 && (<>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="layers" label="Plantilla" />
          <div style={{ marginBottom:12 }}>
            <TemplateCarousel
              templates={templates}
              selectedValue={svgFile ? '' : (templateName || '')}
              svgFile={svgFile}
              onSelect={selectTemplate}
              certApi={CERT_API}
              loadSvgContent={loadSvgContent}
            />
          </div>
          {participants.length > 0 && (
            <div style={{ marginBottom:12 }}>
              {courses.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>
                    Filtrar por curso / taller
                  </label>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                    className="finput" style={{ background:'var(--cream-2)' }}>
                    <option value="">Todos los cursos</option>
                    {(courses.some(c => c.certEnabled)
                      ? courses.filter(c => c.active && c.certEnabled)
                      : courses.filter(c => c.active)
                    ).map(c => <option key={c.id} value={c.id}>{c.short || c.name}</option>)}
                  </select>
                </div>
              )}
              <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>
                Participante {filterCourse && `(${eligibleParticipants.length})`}
              </label>
              <select onChange={e => { const p = participants.find(x => x.id === e.target.value); if (p) setRecipient(p.name) }}
                className="finput" style={{ background:'var(--cream-2)' }}>
                <option value="">— Elegir de la lista —</option>
                {eligibleParticipants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          {courses.length > 0 && detectedIds.some(({id}) => /line_fechas|date_issue_[12]/.test(id)) && (
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>
                Curso/Taller (auto-llenar fechas)
              </label>
              <select onChange={e => {
                const c = courses.find(x => x.id === e.target.value)
                if (c && c.start && c.end) {
                  const sf = fmtDateEs(c.start), ef = fmtDateEs(c.end)
                  setExtraFieldValues(prev => ({
                    ...prev,
                    line_fechas: sf && ef ? `Del ${sf} al ${ef}` : '',
                    date_issue_1: c.start,
                    date_issue_2: c.end,
                  }))
                }
              }} className="finput" style={{ background:'var(--cream-2)' }}>
                <option value="">— Elegir para auto-llenar —</option>
                {courses.filter(c => c.active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <CertDropZone accept=".svg" title="SVG propio (opcional)" subtitle="Arrastrá o hacé clic"
            icon="upload_file" file={svgFile}
            onFile={f => { setSvgFile(f); if (f) { setTemplateName(null); parseIds(f) } else setDetectedIds([]) }} />
        </div>
        <button onClick={() => setStep(2)} disabled={!hasTemplate}
          className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
          Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
        </button>
        </>)}
        {step === 2 && (<>
        {detectedIds.length > 0 && (
          <div className="card" style={{ padding:16 }}>
            <SectionHeader icon="tag" label="IDs detectados" />
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:6 }}>Campo → Nombre del participante</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
              {detectedIds.map(({id, text}) => (
                <button key={id} onClick={() => setNameId(id)} title={text} style={idPillStyle(nameId === id)}>
                  {id}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:6 }}>Campo → Fecha de otorgación</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {detectedIds.map(({id, text}) => (
                <button key={id} onClick={() => setDateId(id)} title={text} style={idPillStyle(dateId === id)}>
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="badge" label="Datos del certificado" />
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>Nombre del participante</label>
            <input value={recipient}
              onChange={e => { setRecipient(e.target.value); setErrors(p => ({...p, recipient:''})) }}
              placeholder="Ej: María González Rojas"
              className="finput"
              style={{ background:'var(--cream-2)', borderColor: errors.recipient ? 'var(--orange-d)' : 'var(--border)' }} />
            {errors.recipient && <p style={{ fontSize:11, color:'var(--orange-d)', marginTop:4 }}>{errors.recipient}</p>}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:5 }}>Fecha de otorgación</label>
            <input value={date}
              onChange={e => { setDate(e.target.value); setErrors(p => ({...p, date:''})) }}
              placeholder="22 de mayo de 2026"
              className="finput"
              style={{ background:'var(--cream-2)', borderColor: errors.date ? 'var(--orange-d)' : 'var(--border)' }} />
            {errors.date && <p style={{ fontSize:11, color:'var(--orange-d)', marginTop:4 }}>{errors.date}</p>}
          </div>
          {extraIds.length > 0 && (
            <div style={{ paddingTop:10, borderTop:'1px solid var(--cream-3)', display:'flex', flexDirection:'column', gap:10 }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--gray)' }}>
                Campos adicionales
              </p>
              {extraIds.map(({id}) => (
                <div key={id}>
                  <label style={{ display:'block', fontSize:11, color:'var(--gray)', marginBottom:4, fontFamily:'monospace' }}>{id}</label>
                  <ExtraFieldInput id={id} courses={courses}
                    value={extraFieldValues[id] ?? ''}
                    onChange={v => setExtraFieldValues(prev => ({...prev, [id]: v}))} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setStep(1)}
            className="btn btn-ghost" style={{ flex:'0 0 auto', justifyContent:'center', padding:'11px 16px', fontSize:14 }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
          </button>
          <button onClick={() => { if (validate()) setStep(3) }} disabled={!dataValid}
            className="btn btn-orange" style={{ flex:1, justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            Siguiente <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
          </button>
        </div>
        </>)}
        {step === 3 && (<>
        <div className="card" style={{ padding:16 }}>
          <SectionHeader icon="download" label="Generar certificado" />
          <div style={{ background:'var(--cream-2)', borderRadius:'var(--radius-md)', padding:12, marginBottom:12 }}>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:2 }}>Participante</p>
            <p style={{ fontSize:14, fontWeight:600, color:'var(--black)', marginBottom:8 }}>{recipient.trim() || '—'}</p>
            <p style={{ fontSize:11, color:'var(--gray)', marginBottom:2 }}>Fecha de otorgación</p>
            <p style={{ fontSize:13, color:'var(--black)' }}>{date.trim() || '—'}</p>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--gray)', marginBottom:6 }}>Formato de salida</label>
            <CertFormatToggle value={fmt} onChange={setFmt} />
          </div>
          <button onClick={generate} disabled={loading || !hasTemplate}
            className="btn btn-orange" style={{ width:'100%', justifyContent:'center', padding:'11px 0', fontSize:14 }}>
            {loading
              ? <><span className="material-symbols-outlined spinner" style={{fontSize:16}}>refresh</span>Procesando…</>
              : <><span className="material-symbols-outlined" style={{fontSize:16}}>download</span>Generar y descargar</>}
          </button>
          <CertAlert type={alert?.type} msg={alert?.msg} onDismiss={() => setAlert(null)} />
        </div>
        <button onClick={() => setStep(2)}
          className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'10px 0', fontSize:14 }}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_back</span> Atrás
        </button>
        </>)}
      </div>
      <div className="card" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderBottom:'1px solid var(--cream-3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="material-symbols-outlined" style={{ fontSize:15, color:'var(--orange-text)' }}>preview</span>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--black)' }}>Vista previa en tiempo real</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {previewLoading
              ? <><span className="material-symbols-outlined spinner" style={{fontSize:13, color:'var(--orange-text)'}}>refresh</span>
                  <span style={{ fontSize:11, color:'var(--gray)' }}>Actualizando…</span></>
              : <><span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />
                  <span style={{ fontSize:11, color:'var(--gray)' }}>Actualizado</span></>}
          </div>
        </div>
        <div style={{ flex:1, background:'var(--cream-2)', padding:24,
          display:'flex', alignItems:'flex-start', justifyContent:'center', overflow:'auto' }}>
          {previewSvg
            ? <div style={{ background:'var(--white)', borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,.12)',
                width:'100%', maxWidth:700, transition:'opacity .2s', opacity: previewLoading ? .5 : 1 }}
                dangerouslySetInnerHTML={{ __html: svgPreviewMarkup(previewSvg, { style:'display:block;width:100%;height:auto' }) }} />
            : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                height:200, color:'var(--border)', gap:12 }}>
                <span className="material-symbols-outlined" style={{fontSize:48}}>workspace_premium</span>
                <p style={{ fontSize:13, color:'var(--gray)' }}>Seleccioná una plantilla para ver la vista previa</p>
              </div>}
        </div>
      </div>
    </div>
  )
}
