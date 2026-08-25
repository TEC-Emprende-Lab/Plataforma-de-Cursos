// ============================================================
//  ExportView.jsx — React JSX
// ============================================================
import { useState } from 'react'
import { daysLeft, getAccessDays } from '../utils/time.js'
import { exportToExcel, exportToCSV } from '../utils/export.js'
import { exportReportToPDF }           from '../utils/pdf.js'

const SECTION_LABELS = [
  { key: 'summary',        label: 'Resumen ejecutivo'                },
  { key: 'courses',        label: 'Cursos y talleres'                },
  { key: 'tagsBreakdown',  label: 'Etiquetas'                        },
  { key: 'alerts',         label: 'Alertas y atención requerida'     },
  { key: 'list',           label: 'Listado detallado de participantes' },
]

export default function ExportView({ participants, courses, tags = [] }) {
  const shortName = id => courses.find(c => c.id === id)?.short || id

  const [sections, setSections] = useState({
    summary: true, courses: true, tagsBreakdown: true, alerts: true, list: true,
  })
  const toggle = (k) => setSections(s => ({ ...s, [k]: !s[k] }))
  const anyChecked = Object.values(sections).some(Boolean)
  const [format, setFormat] = useState('excel')   // excel | csv | pdf

  const FORMATS = [
    { id:'excel', icon:'table_view',      label:'Excel', hint:'.xlsx · análisis', color:'var(--green)' },
    { id:'csv',   icon:'data_object',     label:'CSV',   hint:'universal',         color:'var(--orange-text)' },
    { id:'pdf',   icon:'picture_as_pdf',  label:'PDF',   hint:'informe ejecutivo', color:'var(--orange-d)' },
  ]

  const doExport = () => {
    if (format === 'excel') return exportToExcel(participants, courses)
    if (format === 'csv')   return exportToCSV(participants, courses)
    if (format === 'pdf' && anyChecked) return exportReportToPDF({ participants, courses, tags, sections })
  }
  const exportDisabled = format === 'pdf' && !anyChecked

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="h1">Exportar datos</h2>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 3 }}>
            Generá reportes en el formato que necesités para el seguimiento institucional
          </p>
        </div>
      </div>

      <div className="export-grid" style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20, alignItems:'start' }}>

        {/* Izquierda: selección + formato + acción */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Selección de datos (informe PDF) */}
          <div className="card card-padded">
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Selección de datos</div>
            <p className="text-xs text-muted" style={{ marginBottom:12 }}>
              Secciones a incluir en el <strong>informe PDF</strong>. Excel y CSV exportan la lista completa.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {SECTION_LABELS.map(({ key, label }) => (
                <label key={key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13,
                  cursor: format === 'pdf' ? 'pointer' : 'default',
                  opacity: format === 'pdf' ? 1 : .5 }}>
                  <input type="checkbox" checked={sections[key]} onChange={() => toggle(key)}
                    disabled={format !== 'pdf'}/>
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Formato de salida */}
          <div className="card card-padded">
            <div style={{ fontWeight:600, fontSize:13, marginBottom:12 }}>Formato de salida</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {FORMATS.map(f => {
                const on = format === f.id
                return (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    aria-pressed={on}
                    style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                      padding:'14px 8px', borderRadius:'var(--radius-md)', cursor:'pointer',
                      fontFamily:'inherit', transition:'all .15s',
                      border:`2px solid ${on ? 'var(--orange)' : 'var(--border)'}`,
                      background: on ? 'var(--alert-warm-bg)' : 'var(--white)' }}>
                    <span className="material-symbols-outlined" aria-hidden="true"
                      style={{ fontSize:26, color:f.color }}>{f.icon}</span>
                    <span style={{ fontSize:13, fontWeight:600, color: on ? 'var(--orange-d)' : 'var(--black)' }}>{f.label}</span>
                    <span style={{ fontSize:10, color:'var(--gray)' }}>{f.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button className="btn btn-orange" disabled={exportDisabled}
            style={{ justifyContent:'center', padding:'12px 0', fontSize:14,
              ...(exportDisabled ? { opacity:.5, cursor:'not-allowed' } : {}) }}
            onClick={doExport}>
            <i className="ti ti-download"/>
            {format === 'pdf' ? ' Generar informe PDF' : ` Descargar ${format === 'excel' ? 'Excel' : 'CSV'} (${participants.length})`}
          </button>
        </div>

        {/* Derecha: vista previa */}
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px', borderBottom:'1px solid var(--cream-3)' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>Vista previa</span>
            <span className="text-xs text-muted">
              Mostrando {Math.min(participants.length, 8)} de {participants.length}
            </span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="ttable tpreview" style={{ minWidth:520 }}>
              {/* Anchos fijos por columna: evita que el correo o los cursos
                  compriman al resto cuando el contenido es largo. */}
              <colgroup>
                <col style={{ width:'24%' }}/>
                <col style={{ width:'30%' }}/>
                <col style={{ width:'24%' }}/>
                <col style={{ width:'10%' }}/>
                <col style={{ width:'12%' }}/>
              </colgroup>
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Cursos</th><th>Acceso</th><th>Días restantes</th></tr>
              </thead>
              <tbody>
                {participants.slice(0, 8).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td className="text-sm text-muted">{p.email}</td>
                    <td className="text-xs text-muted">{p.courses.map(shortName).join(', ')}</td>
                    <td><span className={`badge badge-${p.access ? 'black' : 'gray'}`}>{p.access ? 'Sí' : 'No'}</span></td>
                    <td style={{ fontSize: 13 }}>{p.access ? daysLeft(p.fecha, getAccessDays(p, courses)) + 'd' : '—'}</td>
                  </tr>
                ))}
                {participants.length > 8 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray)', fontSize: 12 }}>
                    … y {participants.length - 8} más
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
