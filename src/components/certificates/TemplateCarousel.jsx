import { useState, useEffect } from 'react'
import { svgPreviewMarkup } from '../../utils/svg.js'

const BUILT_IN_TEMPLATES = []

export function TemplateCarousel({ templates, selectedValue, svgFile, onSelect, certApi, loadSvgContent }) {
  const [idx, setIdx] = useState(0)
  const [thumbs, setThumbs] = useState({})
  const VISIBLE = 2

  const options = [
    ...BUILT_IN_TEMPLATES.map(t => ({ id: t.file, label: t.name, isBuiltin: true })),
    ...templates.filter(t => !t.is_builtin).map(t => ({ id: t.id, label: t.name, isBuiltin: false, tpl: t })),
  ]

  const total   = options.length
  const maxIdx  = Math.max(0, total - VISIBLE)
  const visible = options.slice(idx, idx + VISIBLE)

  useEffect(() => {
    options.forEach(async opt => {
      if (thumbs[opt.id]) return
      try {
        let txt = null
        if (opt.isBuiltin) {
          const r = await fetch(`${certApi}/api/templates/${opt.id}`)
          if (r.ok) txt = await r.text()
        } else if (opt.tpl && loadSvgContent) {
          txt = await loadSvgContent(opt.tpl)
        }
        if (txt) setThumbs(prev => ({ ...prev, [opt.id]: txt }))
      } catch(_) {}
    })
  }, [certApi, templates.length])

  useEffect(() => { if (idx > maxIdx) setIdx(maxIdx) }, [maxIdx])

  const activeId = svgFile ? '__file__' : (selectedValue || '')

  const arrowStyle = (disabled) => ({
    background:'none', border:'1px solid var(--border)', borderRadius:8,
    width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
    flexShrink:0, color:'var(--gray)', transition:'opacity .2s',
  })

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>

        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} style={arrowStyle(idx === 0)}>
          <span className="material-symbols-outlined" style={{fontSize:18}}>chevron_left</span>
        </button>

        <div style={{ flex:1, minWidth:0, display:'grid', gridTemplateColumns:`repeat(${VISIBLE}, 1fr)`, gap:8 }}>
          {visible.map(opt => {
            const isSelected = opt.id === activeId
            const svgRaw = thumbs[opt.id] || ''
            return (
              <button key={opt.id} onClick={() => onSelect(opt.id)}
                style={{
                  border: `2px solid ${isSelected ? 'var(--orange)' : 'var(--border)'}`,
                  borderRadius: 10, padding: 6, background: isSelected ? 'var(--alert-warm-bg)' : 'var(--cream-2)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all .18s', minWidth:0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <div style={{ width:'100%', aspectRatio:'4/3', borderRadius:6, overflow:'hidden',
                  background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {svgRaw
                    ? <div style={{ width:'100%', height:'100%' }}
                        dangerouslySetInnerHTML={{ __html: svgPreviewMarkup(svgRaw, {
                          preserveAspectRatio:'xMidYMid meet', style:'width:100%;height:100%;display:block',
                        }) }} />
                    : <span className="material-symbols-outlined" style={{ fontSize:28, color:'var(--gray)', opacity:.5 }}>
                        workspace_premium
                      </span>
                  }
                </div>
                <span style={{ fontSize:11, fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--orange-text)' : 'var(--gray)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
                  {opt.label}
                </span>
                {isSelected && (
                  <span className="material-symbols-outlined" style={{ fontSize:14, color:'var(--orange-text)' }}>check_circle</span>
                )}
              </button>
            )
          })}
          {visible.length < VISIBLE && Array(VISIBLE - visible.length).fill(0).map((_, i) => (
            <div key={`empty-${i}`} style={{ border:'2px dashed var(--border)', borderRadius:10,
              aspectRatio:'4/3', background:'transparent', opacity:.3 }} />
          ))}
        </div>

        <button onClick={() => setIdx(i => Math.min(maxIdx, i + 1))} disabled={idx >= maxIdx} style={arrowStyle(idx >= maxIdx)}>
          <span className="material-symbols-outlined" style={{fontSize:18}}>chevron_right</span>
        </button>
      </div>

      {total > VISIBLE && (
        <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:8 }}>
          {Array(total).fill(0).map((_, i) => (
            <div key={i} onClick={() => setIdx(Math.min(maxIdx, Math.max(0, i - Math.floor(VISIBLE/2))))}
              style={{ width: i >= idx && i < idx + VISIBLE ? 16 : 6, height:6, borderRadius:3,
                background: i >= idx && i < idx + VISIBLE ? 'var(--action)' : 'var(--border)',
                transition:'all .2s', cursor:'pointer' }} />
          ))}
        </div>
      )}
    </div>
  )
}
