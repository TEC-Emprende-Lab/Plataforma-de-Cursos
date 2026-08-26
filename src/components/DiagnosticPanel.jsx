// ============================================================
//  DiagnosticPanel.jsx
//  Muestra el diagnóstico de emprendimiento de un participante
//  consultando la API de la Plataforma de Diagnóstico por cédula.
//  Si el participante no tiene cédula o no existe en esa BD, no
//  renderiza nada (falla silenciosamente).
// ============================================================

import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_DIAGNOSTICO_API_URL

const MODULES = [
  { key: 'estrategia',     label: 'Estrategia' },
  { key: 'ventas',         label: 'Ventas y Canales' },
  { key: 'crecimiento',    label: 'Crecimiento' },
  { key: 'finanzas',       label: 'Finanzas' },
  { key: 'digitalizacion', label: 'Digitalización' },
  { key: 'escalamiento',   label: 'Escalamiento' },
]

function scoreColor(score) {
  if (score <= 20) return 'var(--orange-d)'
  if (score <= 40) return 'var(--orange-text)'
  if (score <= 60) return 'var(--amber)'
  if (score <= 80) return 'var(--green)'
  return 'var(--blue-text)'
}

function ScoreBar({ value, baseline }) {
  return (
    <div style={{ flex: 1, margin: '0 8px' }}>
      <div style={{ height: 7, borderRadius: 4, background: 'var(--cream-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: scoreColor(value), borderRadius: 4, transition: 'width .4s' }} />
      </div>
      {baseline != null && (
        <div style={{ height: 4, borderRadius: 2, background: 'var(--cream-2)', overflow: 'hidden', marginTop: 2 }}>
          <div style={{ height: '100%', width: `${baseline}%`, background: 'var(--border, #CEBF98)', borderRadius: 2 }} />
        </div>
      )}
    </div>
  )
}

export default function DiagnosticPanel({ cedula }) {
  const [data,    setData]    = useState(null)
  const [status,  setStatus]  = useState('idle') // idle | loading | found | not_found | error | no_config

  useEffect(() => {
    if (!cedula) return
    if (!API_URL) { setStatus('no_config'); return }

    setStatus('loading')
    fetch(`${API_URL}/api/entrepreneur?cedula=${encodeURIComponent(cedula)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => { setData(json); setStatus('found') })
      .catch(code => setStatus(code === 404 ? 'not_found' : 'error'))
  }, [cedula])

  if (!cedula || status === 'idle' || status === 'not_found') return null

  if (status === 'no_config') return (
    <div className="card card-padded" style={{ marginBottom: 16, opacity: .6 }}>
      <div className="text-xs text-muted" style={{ fontWeight: 600, letterSpacing: .5 }}>
        DIAGNÓSTICO DE EMPRENDIMIENTO
      </div>
      <p className="text-sm text-muted" style={{ marginTop: 8 }}>
        Configura <code>VITE_DIAGNOSTICO_API_URL</code> para ver el diagnóstico.
      </p>
    </div>
  )

  if (status === 'loading') return (
    <div className="card card-padded" style={{ marginBottom: 16 }}>
      <div className="text-xs text-muted" style={{ fontWeight: 600, letterSpacing: .5, marginBottom: 10 }}>
        DIAGNÓSTICO DE EMPRENDIMIENTO
      </div>
      <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--cream-2)', animation: 'pulse 1.4s ease infinite' }} />
    </div>
  )

  if (status === 'error') return (
    <div className="card card-padded" style={{ marginBottom: 16 }}>
      <div className="text-xs text-muted" style={{ fontWeight: 600, letterSpacing: .5 }}>
        DIAGNÓSTICO DE EMPRENDIMIENTO
      </div>
      <p className="text-sm text-muted" style={{ marginTop: 8 }}>No se pudo conectar con la plataforma de diagnóstico.</p>
    </div>
  )

  const d = data.diagnostico

  return (
    <div className="card card-padded" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="text-xs text-muted" style={{ fontWeight: 600, letterSpacing: .5 }}>
          DIAGNÓSTICO DE EMPRENDIMIENTO
        </div>
        {data.program && (
          <span className="badge badge-gray" style={{ fontSize: 10 }}>{data.program}</span>
        )}
      </div>

      {!d ? (
        <p className="text-sm text-muted" style={{ fontStyle: 'italic' }}>
          Registrado en el sistema de diagnóstico pero aún sin diagnóstico aplicado.
        </p>
      ) : (
        <>
          {/* Score global */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border, #CEBF98)' }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: scoreColor(d.score_global) }}>
                {d.score_global}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor(d.score_global), marginTop: 2 }}>
                {d.maturity}
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 2 }}>
                {d.moment === 'baseline' ? 'Línea base' : 'Medición final'} · {new Date(d.date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {d.delta != null && (
              <div style={{ textAlign: 'center', padding: '6px 10px', background: 'var(--cream-2)', borderRadius: 6, border: '1px solid var(--border, #CEBF98)' }}>
                <div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: .4 }}>Avance</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: d.delta >= 0 ? 'var(--green)' : 'var(--orange-d)' }}>
                  {d.delta >= 0 ? '+' : ''}{d.delta}
                </div>
                <div style={{ fontSize: 9, color: 'var(--gray)' }}>vs línea base ({d.baseline_score})</div>
              </div>
            )}
          </div>

          {/* Módulos */}
          {d.modules && (
            <div style={{ marginBottom: d.recommendation ? 12 : 0 }}>
              {MODULES.map(({ key, label }) => {
                const val = d.modules[key]
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ width: 120, fontSize: 11, color: 'var(--gray)', flexShrink: 0 }}>{label}</span>
                    <ScoreBar value={val} baseline={null} />
                    <span style={{ width: 26, fontSize: 11, fontWeight: 700, color: 'var(--black)', textAlign: 'right', flexShrink: 0 }}>{val}</span>
                  </div>
                )
              })}
              {d.baseline_score != null && (
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 14, height: 5, borderRadius: 2, background: 'var(--orange)' }} />
                    <span style={{ fontSize: 10, color: 'var(--gray)' }}>Medición final</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 14, height: 5, borderRadius: 2, background: 'var(--border, #CEBF98)' }} />
                    <span style={{ fontSize: 10, color: 'var(--gray)' }}>Línea base</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recomendación IA */}
          {d.recommendation && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--cream)', borderRadius: 6, border: '1px solid var(--border, #CEBF98)', borderLeft: '3px solid var(--orange)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--orange-text)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4 }}>
                Recomendación IA
              </div>
              <p style={{ fontSize: 12, color: 'var(--black)', lineHeight: 1.5, margin: 0 }}>{d.recommendation}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
