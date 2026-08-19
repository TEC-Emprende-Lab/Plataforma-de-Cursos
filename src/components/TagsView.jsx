// ============================================================
//  TagsView.jsx — React JSX
//  Gestor completo de etiquetas: crear, editar, eliminar,
//  estadísticas de uso y alerta de participantes sin etiquetar.
// ============================================================

import { useState } from 'react'
import { getTagColor } from '../data/tags.js'
import { TagPill }     from './TagPill.jsx'
import { ColorPicker } from './ColorPicker.jsx'
import { ConfirmDialog } from './UI.jsx'

export default function TagsView({ tags, participants, onAdd, onEdit, onDelete }) {
  const [newName,   setNewName]   = useState('')
  const [newColor,  setNewColor]  = useState('orange')
  const [editId,    setEditId]    = useState(null)
  const [editName,  setEditName]  = useState('')
  const [editColor, setEditColor] = useState('orange')
  const [confirmTarget, setConfirmTarget] = useState(null)   // etiqueta a eliminar
  const [creating, setCreating] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const startEdit = t => { setEditId(t.id); setEditName(t.name); setEditColor(t.color) }
  const saveEdit = async () => {
    if (savingEdit) return
    setSavingEdit(true)
    try {
      const result = await onEdit(editId, editName, editColor)
      if (!result?.error) setEditId(null)
    } finally {
      setSavingEdit(false)
    }
  }
  const createTag = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const result = await onAdd(newName.trim(), newColor)
      if (!result?.error) setNewName('')
    } finally {
      setCreating(false)
    }
  }

  const tagStats = [...tags]
    .map(t => ({ ...t, count: participants.filter(p => (p.tags||[]).includes(t.id)).length }))
    .sort((a,b) => b.count - a.count)

  const sinEtiqueta = participants.filter(p => !p.tags || p.tags.length === 0)

  return (
    <div>
      {confirmTarget && (
        <ConfirmDialog
          title="Eliminar etiqueta"
          message={`¿Seguro que querés eliminar la etiqueta "${confirmTarget.name}"? Se quitará de todos los participantes que la tengan.`}
          confirmLabel="Eliminar"
          onConfirm={() => onDelete(confirmTarget.id)}
          onClose={() => setConfirmTarget(null)}
        />
      )}
      <div className="page-header">
        <div>
          <h2 className="h1">Etiquetas</h2>
          <p className="text-muted" style={{ fontSize:13, marginTop:3 }}>
            Clasificá participantes con etiquetas libres y colores personalizados
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-num">{tags.length}</div>
          <div className="stat-label">Etiquetas activas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color:'var(--orange)' }}>
            {participants.filter(p => p.tags?.length > 0).length}
          </div>
          <div className="stat-label">Participantes etiquetados</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color:'var(--gray)' }}>{sinEtiqueta.length}</div>
          <div className="stat-label">Sin etiquetas</div>
        </div>
      </div>

      {/* Crear nueva etiqueta */}
      <div className="card card-padded" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:500, fontSize:13, marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-tag" style={{ fontSize:14, color:'var(--orange)' }}/> Nueva etiqueta
        </div>
        <div className="filters-row" style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:180 }}>
            <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Nombre</label>
            <input className="finput" value={newName} onChange={e => setNewName(e.target.value)}
              disabled={creating}
              placeholder="ej. Becado, VIP, Empresa..."
              onKeyDown={e => { if (e.key === 'Enter') createTag() }}/>
          </div>
          <div>
            <label className="text-sm text-muted" style={{ display:'block', marginBottom:4 }}>Color</label>
            <ColorPicker selected={newColor} onChange={setNewColor}/>
          </div>
          <button className="btn btn-orange" onClick={createTag} disabled={creating}>
            <i className={`ti ti-${creating ? 'loader-2' : 'plus'}`}/> {creating ? 'Creando…' : 'Crear etiqueta'}
          </button>
        </div>
        {newName && (
          <div style={{ marginTop:10 }}>
            <span className="text-sm text-muted" style={{ marginRight:8 }}>Vista previa:</span>
            <TagPill tag={{ id:'prev', name:newName, color:newColor }}/>
          </div>
        )}
      </div>

      {/* Etiquetas existentes — grilla de tarjetas */}
      <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 2px 12px' }}>
        <h3 className="h3" style={{ margin:0 }}>Etiquetas existentes</h3>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--gray)',
          background:'var(--cream-2)', borderRadius:20, padding:'2px 10px' }}>{tags.length} total</span>
      </div>

      {tags.length === 0 ? (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--gray)', fontSize:13, marginBottom:16 }}>
          No hay etiquetas. Creá la primera arriba.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',
          gap:12, marginBottom:16 }}>
          {tagStats.map(t => {
            const pct = Math.round(t.count / Math.max(participants.length, 1) * 100)
            const c   = getTagColor(t.color)
            return (
              <div key={t.id} className="card" style={{ padding:14, borderLeft:`3px solid ${c.dot}` }}>
                {editId === t.id ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="finput" autoFocus/>
                    <ColorPicker selected={editColor} onChange={setEditColor}/>
                    <TagPill tag={{ id:'ep', name:editName, color:editColor }}/>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-orange btn-sm" onClick={saveEdit} disabled={savingEdit}>
                        <i className={`ti ti-${savingEdit ? 'loader-2' : 'check'}`}/> {savingEdit ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)} disabled={savingEdit}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                      <TagPill tag={t}/>
                      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                        <button className="btn-icon" onClick={() => startEdit(t)} title="Editar etiqueta"
                          aria-label={`Editar etiqueta ${t.name}`}>
                          <i className="ti ti-edit"/>
                        </button>
                        <button className="btn-icon danger" onClick={() => setConfirmTarget(t)}
                          title="Eliminar etiqueta" aria-label={`Eliminar etiqueta ${t.name}`}>
                          <i className="ti ti-trash"/>
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize:22, fontWeight:700, color:'var(--black)', lineHeight:1 }}>{t.count}</div>
                    <div className="text-xs text-muted" style={{ marginBottom:8 }}>
                      participante{t.count !== 1 ? 's' : ''} asociado{t.count !== 1 ? 's' : ''} ({pct}%)
                    </div>
                    <div className="pbar-wrap">
                      <div style={{ width:`${pct}%`, height:5, borderRadius:20,
                        background:c.dot, transition:'width .4s' }}/>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Participantes sin etiquetas */}
      {sinEtiqueta.length > 0 && (
        <div className="alert alert-orange">
          <div className="alert-title">
            <i className="ti ti-alert-triangle"/> {sinEtiqueta.length} participante{sinEtiqueta.length !== 1 ? 's' : ''} sin etiquetas
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {sinEtiqueta.map(p => (
              <span key={p.id} style={{ fontSize:11, padding:'3px 10px', borderRadius:20,
                background:'var(--cream-3)', color:'var(--gray)' }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
