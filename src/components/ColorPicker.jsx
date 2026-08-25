// ============================================================
//  ColorPicker.jsx — React JSX
//  Selector visual de color con puntos clicables.
// ============================================================

import { TAG_COLORS } from '../data/tags.js'

export function ColorPicker({ selected, onChange }) {
  return (
    <div role="radiogroup" aria-label="Color de etiqueta"
      style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'8px 10px', marginTop:4,
      background:'var(--cream-3)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
      {TAG_COLORS.map(c => {
        const isSelected = selected === c.id
        return (
          <button key={c.id} type="button" role="radio" aria-checked={isSelected}
            aria-label={c.label} title={c.label} onClick={() => onChange(c.id)}
            style={{
              appearance:'none', WebkitAppearance:'none',
              width: 22, height: 22, borderRadius:'50%', padding:0,
              background: c.dot, cursor:'pointer',
              border: isSelected ? '2px solid var(--black)' : '2px solid transparent',
              boxShadow: isSelected ? 'inset 0 0 0 2px var(--white)' : 'none',
              outlineOffset: 2, transition:'all .15s',
            }}/>
        )
      })}
    </div>
  )
}
