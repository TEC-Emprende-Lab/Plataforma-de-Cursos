// ============================================================
//  CertificatesView.jsx — Módulo de generación de certificados
//  Requiere backend Flask corriendo en CERT_API (ver abajo)
// ============================================================

import { useState, useEffect } from 'react'

import { CERT_API } from '../config.js'
import { CertIndividual } from './certificates/CertIndividual.jsx'
import { CertBatch } from './certificates/CertBatch.jsx'
import { CertFieldsReference } from './certificates/CertFieldsReference.jsx'

export default function CertificatesView({ participants, courses = [], galleryTplPick, onGalleryConsumed }) {
  const [certTab,     setCertTab]     = useState('individual')
  const [apiOk,       setApiOk]       = useState(null)
  const [aiAvailable, setAiAvailable] = useState(false)

  useEffect(() => {
    fetch(`${CERT_API}/api/health`)
      .then(r => r.ok ? setApiOk(true) : setApiOk(false))
      .catch(() => setApiOk(false))
    fetch(`${CERT_API}/api/ai/status`)
      .then(r => r.ok ? r.json() : {available:false})
      .then(d => setAiAvailable(d.available))
      .catch(() => {})
  }, [])

  const tabs = [
    { id:'individual', icon:'person',      label:'Individual'   },
    { id:'batch',      icon:'upload_file', label:'Lote CSV'     },
  ]

  const apiBadge = apiOk === true
    ? { bg:'var(--green-l)', bc:'var(--green)', tc:'var(--green)', dot:'var(--green)' }
    : apiOk === false
    ? { bg:'var(--row-exp-bg)', bc:'var(--orange-d)', tc:'var(--orange-d)', dot:'var(--orange-d)' }
    : { bg:'var(--cream-2)', bc:'var(--border)', tc:'var(--gray)', dot:'var(--gray)' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, color:'var(--black)',
            display:'flex', alignItems:'center', gap:8 }}>
            <span className="material-symbols-outlined" style={{ color:'var(--orange-text)' }}>workspace_premium</span>
            Generador de Certificados
          </h2>
          <p style={{ fontSize:13, color:'var(--gray)', marginTop:4 }}>Emití certificados digitales para los participantes de los programas</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20,
            fontSize:12, fontWeight:600, border:`1px solid ${apiBadge.bc}`,
            background:apiBadge.bg, color:apiBadge.tc }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:apiBadge.dot, display:'inline-block' }} />
            {apiOk === null ? 'Verificando…' : apiOk ? 'API activa' : 'API no disponible'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20,
            fontSize:12, fontWeight:600,
            border: aiAvailable ? '1px solid var(--blue-text)' : '1px solid var(--border)',
            background: aiAvailable ? 'var(--blue-l)' : 'var(--cream-2)',
            color: aiAvailable ? 'var(--blue-text)' : 'var(--gray)' }}>
            <span className="material-symbols-outlined" style={{fontSize:13}}>{aiAvailable ? 'auto_awesome' : 'key_off'}</span>
            {aiAvailable ? 'Claude activo' : 'IA inactiva'}
          </div>
        </div>
      </div>

      {apiOk === false && (
        <div style={{ marginBottom:20, display:'flex', alignItems:'center', gap:8, padding:'12px 16px',
          background:'var(--row-exp-bg)', border:'1px solid var(--orange-d)', borderRadius:'var(--radius-lg)',
          fontSize:13, color:'var(--orange-d)' }}>
          <span className="material-symbols-outlined" style={{fontSize:16}}>warning</span>
          El servidor Flask no está disponible. Ejecutá
          <code style={{ margin:'0 6px', background:'var(--cream-3)', padding:'2px 6px', borderRadius:4, fontFamily:'monospace' }}>cd backend && python3 app.py</code>
          para iniciarlo.
        </div>
      )}

      <div style={{ display:'flex', gap:4, padding:4, background:'var(--cream-2)',
        borderRadius:'var(--radius-lg)', marginBottom:20, width:'fit-content',
        border:'1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setCertTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
              borderRadius:'var(--radius-md)', fontSize:13, fontWeight:500, cursor:'pointer',
              border:'none', transition:'all .15s', fontFamily:'var(--font-body)',
              background: certTab === t.id ? 'var(--white)' : 'transparent',
              color:      certTab === t.id ? 'var(--black)' : 'var(--gray)',
              boxShadow:  certTab === t.id ? 'var(--shadow-card)' : 'none',
            }}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <CertFieldsReference />

      {certTab === 'individual' && <CertIndividual participants={participants} courses={courses} galleryTplPick={galleryTplPick} onGalleryConsumed={onGalleryConsumed} />}
      {certTab === 'batch'      && <CertBatch participants={participants} courses={courses} />}
    </div>
  )
}
