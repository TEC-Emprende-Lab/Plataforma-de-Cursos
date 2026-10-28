import { useState } from 'react'

export const FIELD_REFERENCE = [
  { id:'recipient_name', csv:'nombre / name', desc:'Nombre completo del participante' },
  { id:'issue_date',     csv:'fecha / date',  desc:'Fecha de emisión del certificado' },
  { id:'line_curso',     csv:'—',             desc:'Nombre del curso/taller (se muestra en bold después de "...el")' },
  { id:'line_horas',     csv:'horas',         desc:'Horas del curso (ej: "40" → aparece en "con un total de 40 impartidas")' },
  { id:'line_fechas',    csv:'—',             desc:'Rango de fechas del curso — se completa con los dos calendarios' },
  { id:'course_name_1',  csv:'tipo_curso',    desc:'Prefijo del tipo: "Taller de" / "Curso de" (plantillas antiguas)' },
  { id:'course_name_2',  csv:'nombre_curso',  desc:'Nombre del curso sin prefijo (plantillas antiguas)' },
  { id:'date_issue_1',   csv:'fecha_inicio',  desc:'Fecha de inicio por separado (plantillas antiguas)' },
  { id:'date_issue_2',   csv:'fecha_fin',     desc:'Fecha de fin por separado (plantillas antiguas)' },
]

export function CertFieldsReference() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom:20, overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className="material-symbols-outlined" style={{fontSize:15, color:'var(--orange-text)'}}>table_chart</span>
          <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--gray)' }}>
            Referencia de campos SVG
          </span>
          <span style={{ fontSize:11, color:'var(--gray)', opacity:.7 }}>— IDs y columnas CSV</span>
        </div>
        <span className="material-symbols-outlined" style={{fontSize:16, color:'var(--gray)',
          transition:'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)'}}>
          expand_more
        </span>
      </button>

      {open && (
        <div style={{ borderTop:'1px solid var(--cream-3)', overflowX:'auto' }}>
          <table className="ttable" style={{ minWidth:'unset' }}>
            <thead>
              <tr>
                {['Campo SVG (id=)', 'CSV sugerido', 'Descripción'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELD_REFERENCE.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code style={{ fontFamily:'monospace', fontWeight:700, fontSize:11,
                      color:'var(--orange-text)', background:'var(--alert-warm-bg)',
                      padding:'2px 6px', borderRadius:4 }}>{row.id}</code>
                  </td>
                  <td style={{ fontFamily:'monospace', fontSize:11 }}>{row.csv}</td>
                  <td style={{ fontSize:12 }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
