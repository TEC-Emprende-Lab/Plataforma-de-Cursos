// ============================================================
//  UI.jsx — React JSX
//  Componentes atómicos reutilizables: Badge, AccessBar,
//  StatCard, Toast, Avatar, Modal base.
//  Todos los componentes están documentados con JSDoc.
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { accessPct, daysLeft, isExpired, isWarning, ACCESS_DAYS } from '../utils/time.js'

// Re-export constante para uso externo
export { ACCESS_DAYS }

// ── Badge ─────────────────────────────────────────────────
const BADGE_STYLES = {
  black:   { background: 'var(--black)',    color: 'var(--cream)' },
  orange:  { background: 'var(--orange)',   color: '#fff' },
  gray:    { background: 'var(--cream-3)',  color: 'var(--gray)' },
  red:     { background: 'var(--orange-d)', color: '#fff' },
  green:   { background: '#D1FAE5',         color: '#065F46' },
}

/** Etiqueta de estado con color semántico */
export function Badge({ type = 'gray', children }) {
  const s = BADGE_STYLES[type] || BADGE_STYLES.gray
  return (
    <span className="badge" style={s}>{children}</span>
  )
}

/**
 * Badge que muestra el estado de acceso según tiempo.
 * @param {string}  fecha  - ISO date string
 * @param {boolean} access - Si el participante tiene acceso activo
 * @param {number}  [days] - Días de acceso del curso (por defecto ACCESS_DAYS global)
 */
// Ícono semántico inline para acompañar el color (accesible a daltonismo, WCAG 1.4.1)
function BadgeIcon({ name }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true"
      style={{ fontSize:13, lineHeight:1, verticalAlign:'-2px', marginRight:3 }}>{name}</span>
  )
}

export function TimerBadge({ fecha, access, days = ACCESS_DAYS }) {
  if (!access)                  return <Badge type="gray"><BadgeIcon name="lock"/>Sin acceso</Badge>
  if (isExpired(fecha, days))   return <Badge type="red"><BadgeIcon name="cancel"/>Expirado</Badge>
  if (isWarning(fecha, days))   return <Badge type="amber"><BadgeIcon name="schedule"/>{daysLeft(fecha, days)}d restantes</Badge>
  return <Badge type="black"><BadgeIcon name="check_circle"/>{daysLeft(fecha, days)}d restantes</Badge>
}

// ── AccessBar ─────────────────────────────────────────────
/**
 * Barra de progreso con colores semánticos.
 * @param {string}  fecha   - ISO date string
 * @param {boolean} compact - Oculta etiquetas de texto
 * @param {number}  [days]  - Días de acceso del curso (por defecto ACCESS_DAYS global)
 */
export function AccessBar({ fecha, compact = false, days = ACCESS_DAYS }) {
  const pct   = accessPct(fecha, days)
  const left  = daysLeft(fecha, days)
  const exp   = isExpired(fecha, days)
  const warn  = isWarning(fecha, days)

  const barClass = exp ? 'pbar pbar-exp' : warn ? 'pbar pbar-warn' : 'pbar pbar-green'
  const bgColor  = exp ? '#FBE8E3' : warn ? 'var(--amber-l)' : 'var(--green-l)'
  const txtColor = exp ? 'var(--orange-d)' : warn ? 'var(--amber-d)' : 'var(--green)'
  const label    = exp ? 'Expirado' : warn ? `Expira en ${left}d` : `${left} días restantes`
  const icon     = exp ? 'cancel' : warn ? 'schedule' : 'check_circle'

  return (
    <div>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
          <span style={{ color: txtColor, fontWeight: 500, display:'inline-flex', alignItems:'center', gap:3 }}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize:13, lineHeight:1 }}>{icon}</span>
            {label}</span>
          <span style={{ color: 'var(--gray)' }}>{pct}% de {days}d</span>
        </div>
      )}
      <div className="pbar-wrap" style={{ background: bgColor }}>
        <div className={barClass} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────
/** Tarjeta de métrica con número grande */
export function StatCard({ num, label, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-num" style={accent ? { color: accent } : {}}>{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────
/** Círculo con iniciales del participante */
export function Avatar({ name, variant = 'cream' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`avatar av-${variant}`}>{initials}</div>
  )
}

// ── Toast ─────────────────────────────────────────────────
/** Notificación temporal en la esquina inferior derecha */
export function Toast({ message, onHide }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onHide, 2400)
    return () => clearTimeout(t)
  }, [message, onHide])

  if (!message) return null
  return <div className="toast">{message}</div>
}

// ── Modal base ────────────────────────────────────────────
/** Envuelve contenido en el overlay de modal.
 *  Accesible: role="dialog" + aria-modal, cierre con Esc, atrapa el
 *  foco dentro del diálogo y lo devuelve al elemento que lo abrió. */
export function Modal({ onClose, children, width = 560, label = 'Diálogo' }) {
  const boxRef     = useRef(null)
  const restoreRef = useRef(null)

  useEffect(() => {
    // Recordar el elemento enfocado antes de abrir, para restaurarlo al cerrar
    restoreRef.current = document.activeElement

    // Enfocar el primer elemento interactivo del modal
    const focusables = () => boxRef.current
      ? boxRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
      : []
    const first = focusables()[0]
    if (first) first.focus()
    else if (boxRef.current) boxRef.current.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      // Focus-trap: ciclar dentro del modal
      const items = Array.from(focusables())
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl  = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Devolver el foco al disparador
      if (restoreRef.current && restoreRef.current.focus) restoreRef.current.focus()
    }
  }, [onClose])

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ width }}
        role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────
/** Diálogo de confirmación accesible (reemplaza al confirm() nativo).
 *  Uso: estado con el objetivo a confirmar; al confirmar ejecuta onConfirm. */
export function ConfirmDialog({
  title = 'Confirmar acción',
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
  onConfirm,
  onClose,
}) {
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const result = await onConfirm()
      if (!result?.error) onClose()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal onClose={onClose} width={420} label={title}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:18 }}>
        <span className="material-symbols-outlined" aria-hidden="true"
          style={{ fontSize:24, color: danger ? 'var(--orange-d)' : 'var(--orange)', flexShrink:0 }}>
          {danger ? 'warning' : 'help'}
        </span>
        <div>
          <h3 className="h2" style={{ marginBottom:6 }}>{title}</h3>
          <p className="text-sm text-muted" style={{ lineHeight:1.6 }}>{message}</p>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>{cancelLabel}</button>
        <button className="btn btn-orange" onClick={handleConfirm} disabled={confirming}>
          {danger && <i className="ti ti-trash"/>} {confirming ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
