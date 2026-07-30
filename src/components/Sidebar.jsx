// ============================================================
//  Sidebar.jsx — React JSX
// ============================================================

import { isExpired, needsExamReminder, getAccessDays } from '../utils/time.js'
import Logo from './Logo.jsx'

export const NAV = [
  { section:'Principal' },
  { id:'dashboard',    icon:'ti-layout-dashboard', label:'Dashboard'          },
  { id:'participants', icon:'ti-users',            label:'Participantes'       },
  { section:'Programas' },
  { id:'courses',      icon:'ti-book',             label:'Cursos y Talleres'   },
  { section:'Accesos' },
  { id:'access',       icon:'ti-key',              label:'Control de Accesos', badge:'exp'    },
  { id:'reminders',    icon:'ti-mail',             label:'Recordatorios',      badge:'remind' },
  { section:'Organización' },
  { id:'tags',         icon:'ti-tags',             label:'Etiquetas'           },
  { section:'Herramientas' },
  { id:'import',       icon:'ti-file-spreadsheet', label:'Importar CSV'        },
  { id:'export',       icon:'ti-download',         label:'Exportar datos'      },
  { section:'Certificados' },
  { id:'certificates', icon:'ti-certificate',      label:'Certificados'        },
  { id:'gallery',      icon:'ti-photo',             label:'Galería SVG'         },
]

export default function Sidebar({ view, setView, participants, courses = [], userEmail, onSignOut, open, onClose, theme, onToggleTheme }) {
  const expCount    = participants.filter(p => isExpired(p.fecha, getAccessDays(p, courses))).length
  const remindCount = participants.filter(p => p.access && needsExamReminder(p.fecha, getAccessDays(p, courses))).length
  const activeBase  = view.startsWith('profile_') ? 'participants' : view
  const isDark      = theme === 'dark'

  const handleNav = (id) => {
    setView(id)
    if (onClose) onClose()
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose}/>}
      <aside className={`sidebar${open ? ' open' : ''}`}
        style={{ width:220, background:'var(--sidebar-bg)', minHeight:'100vh',
          display:'flex', flexDirection:'column', padding:'24px 0',
          flexShrink:0, position:'fixed', top:0, left:0, height:'100vh', overflowY:'auto', zIndex:50 }}>
        <div style={{ padding:'0 20px 28px', display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <Logo height={26} style={{ marginBottom:6, color:'#FFFFFF' }} />
            <div style={{ color:'var(--sidebar-muted)', fontSize:11, marginTop:3 }}>Panel de gestión</div>
          </div>
          {onToggleTheme && (
            <button onClick={onToggleTheme} title={isDark ? 'Modo claro' : 'Modo oscuro'}
              aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
              style={{ background:'transparent', border:'1px solid var(--sidebar-border)', color:'var(--sidebar-text)',
                borderRadius:8, padding:'6px 8px', cursor:'pointer', fontSize:14, lineHeight:1,
                display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`}/>
            </button>
          )}
        </div>
        <nav aria-label="Navegación principal" style={{ padding:'0 10px', flex:1 }}>
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{ padding:'8px 12px 4px', fontSize:10, fontWeight:700,
                letterSpacing:1, color:'var(--sidebar-muted)', textTransform:'uppercase', marginTop: i > 0 ? 4 : 0 }}>
                {item.section}
              </div>
            )
            const isActive = activeBase === item.id
            const badge    = item.badge === 'exp' ? expCount : item.badge === 'remind' ? remindCount : 0
            return (
              <button key={item.id} onClick={() => handleNav(item.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                  borderRadius:8, cursor:'pointer', marginBottom:2, width:'100%',
                  textAlign:'left', border:'none', fontFamily:'inherit',
                  background: isActive ? 'var(--surface-brand-active, var(--orange))' : 'transparent',
                  transition:'all .15s', color: isActive ? 'var(--surface-brand-active-text, #fff)' : 'var(--sidebar-muted)',
                  fontSize:13, fontWeight: isActive ? 600 : 400 }}>
                <i className={`ti ${item.icon}`} style={{ fontSize:15 }} aria-hidden="true"/>
                {item.label}
                {badge > 0 && <span className="notif-dot">{badge}</span>}
              </button>
            )
          })}
        </nav>
        {userEmail && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--sidebar-border)',
            display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, minWidth:0, color:'var(--sidebar-text)', fontSize:12,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={userEmail}>
              {userEmail}
            </div>
            <button onClick={onSignOut} title="Cerrar sesión"
              style={{ background:'transparent', border:'1px solid var(--sidebar-border)', color:'var(--sidebar-muted)',
                borderRadius:6, padding:'4px 8px', fontSize:11, cursor:'pointer' }}>
              Salir
            </button>
          </div>
        )}
        <div style={{ padding:'16px 20px', borderTop:'1px solid var(--sidebar-border)',
          fontSize:11, color:'var(--sidebar-muted)' }}>
          v4.2 · TEC Emprende Lab
        </div>
      </aside>
    </>
  )
}
