// ============================================================
//  App.jsx — React JSX  v4.2
//  Orquesta participantes, cursos, etiquetas y todas las vistas.
//  El guard de sesión se hace afuera (App) y el contenido vive
//  en AuthenticatedApp para no romper Rules of Hooks.
// ============================================================

import { useState, useCallback } from 'react'
import { useParticipants }  from './hooks/useParticipants.js'
import { useTags }          from './hooks/useTags.js'
import { useCourses }       from './hooks/useCourses.js'
import { useAuth }          from './hooks/useAuth.js'
import { useTheme }         from './hooks/useTheme.js'
import Sidebar              from './components/Sidebar.jsx'
import Dashboard            from './components/Dashboard.jsx'
import ParticipantsView     from './components/ParticipantsView.jsx'
import ProfileView          from './components/ProfileView.jsx'
import CoursesView          from './components/CoursesView.jsx'
import AccessView           from './components/AccessView.jsx'
import RemindersView        from './components/RemindersView.jsx'
import TagsView             from './components/TagsView.jsx'
import ImportView           from './components/ImportView.jsx'
import ExportView           from './components/ExportView.jsx'
import CertificatesView     from './components/CertificatesView.jsx'
import GalleryView          from './components/GalleryView.jsx'
import LoginView            from './components/LoginView.jsx'
import { Toast }            from './components/UI.jsx'
import CommandPalette       from './components/CommandPalette.jsx'
import { useGlobalShortcut } from './hooks/useGlobalShortcut.js'

export default function App() {
  const { user, loading, signIn, signOut, isSupabaseConfigured } = useAuth()
  const { theme, toggleTheme } = useTheme()

  if (isSupabaseConfigured && loading) {
    return <div className="login-shell"><div className="poppins-medium text-muted">Cargando…</div></div>
  }
  if (isSupabaseConfigured && !user) {
    return <LoginView onSignIn={signIn}/>
  }
  return <AuthenticatedApp user={user} onSignOut={signOut} theme={theme} toggleTheme={toggleTheme}/>
}

const VIEW_TITLES = {
  dashboard:    'Dashboard',
  participants: 'Participantes',
  courses:      'Cursos y Talleres',
  access:       'Control de Accesos',
  reminders:    'Recordatorios',
  tags:         'Etiquetas',
  import:       'Importar CSV',
  export:       'Exportar datos',
  certificates: 'Certificados',
  gallery:      'Galería SVG',
}

function AuthenticatedApp({ user, onSignOut, theme, toggleTheme }) {
  const [view,           setView]           = useState('dashboard')
  const [toastMsg,       setToast]          = useState('')
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [galleryTplPick, setGalleryTplPick] = useState(null)
  const [paletteOpen,    setPaletteOpen]    = useState(false)
  const toast = useCallback(msg => setToast(msg), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openPalette  = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useGlobalShortcut({ key:'k', meta:true, ctrl:true }, openPalette)
  const currentTitle = view.startsWith('profile_') ? 'Perfil' : (VIEW_TITLES[view] || 'TEC Emprende Lab')

  // ── Estado global ─────────────────────────────────────────
  const {
    participants, setParticipants,
    addParticipant, updateParticipant, deleteParticipant,
    toggleAccess, renewAccess, importParticipants, bulkUpdate,
  } = useParticipants()

  const { tags, addTag, editTag, deleteTag }         = useTags()
  const { courses, addCourse, updateCourse, deleteCourse, toggleActive } = useCourses()

  // ── Actualizar etiquetas de participante ──────────────────
  const updateParticipantTags = useCallback((pid, newTags) => {
    const p = participants.find(x => x.id === pid)
    if (p) updateParticipant(pid, { ...p, tags: newTags })
    toast('Etiquetas actualizadas ✓')
  }, [participants, updateParticipant])

  // ── Wrappers participantes ────────────────────────────────
  const handleAdd    = f      => { addParticipant(f);             toast('Participante agregado ✓')    }
  const handleUpdate = (id,f) => { updateParticipant(id,f);       toast('Participante actualizado ✓') }
  const handleDelete = id     => { deleteParticipant(id);         toast('Participante eliminado')     }
  const handleToggle = id     => {
    const p = participants.find(x => x.id === id)
    toggleAccess(id)
    toast(p?.access ? 'Acceso revocado' : 'Acceso activado ✓')
  }
  const handleRenew  = id     => { renewAccess(id);               toast('Acceso renovado ✓')         }
  const handleImport = async list => {
    const ids = await importParticipants(list)
    toast(`${list.length} participante${list.length!==1?'s':''} importado${list.length!==1?'s':''} ✓`)
    return ids
  }
  const handleBulkUpdate = async (ids, patch, addCourses) => {
    await bulkUpdate(ids, patch, addCourses)
    toast(`${ids.length} participante${ids.length!==1?'s':''} actualizado${ids.length!==1?'s':''} ✓`)
  }

  // ── Wrappers cursos ───────────────────────────────────────
  const handleAddCourse    = async (form)   => {
    const result = await addCourse(form)
    if (result?.error) toast('No se pudo crear: ' + (result.error.message || result.error.code || 'error desconocido'))
    else if (result === null) toast('Error al crear el programa — revisá la consola')
    else toast('Programa creado ✓')
  }
  const handleUpdateCourse = async (id, f) => {
    const result = await updateCourse(id, f)
    if (result?.error) toast('No se pudo actualizar: ' + (result.error.message || result.error.code || 'error desconocido'))
    else if (result === null) toast('Error al actualizar — revisá la consola')
    else toast('Programa actualizado ✓')
  }
  const handleDeleteCourse = id      => {
    const c = courses.find(x => x.id === id)
    if (!confirm(`¿Eliminar "${c?.name}"? Se quitará de todos los participantes.`)) return
    deleteCourse(id, setParticipants)
    toast('Programa eliminado')
  }
  const handleToggleActive = id      => { toggleActive(id);             toast('Estado actualizado ✓')       }

  // ── Wrappers etiquetas ────────────────────────────────────
  const handleAddTag    = (n,c) => { addTag(n,c);          toast(`Etiqueta "${n}" creada ✓`)    }
  const handleEditTag   = (id,n,c) => { editTag(id,n,c);   toast('Etiqueta actualizada ✓')      }
  const handleDeleteTag = id    => {
    const t = tags.find(x => x.id === id)
    if (!confirm(`¿Eliminar la etiqueta "${t?.name}"?`)) return
    deleteTag(id, setParticipants)
    toast('Etiqueta eliminada')
  }

  // ── Router ────────────────────────────────────────────────
  const shared = { participants, courses, tags, setView }

  const renderView = () => {
    if (view === 'dashboard')
      return <Dashboard {...shared}/>

    if (view === 'participants')
      return <ParticipantsView {...shared}
        onAdd={handleAdd} onUpdate={handleUpdate}
        onDelete={handleDelete} onToggleAccess={handleToggle}/>

    if (view.startsWith('profile_'))
      return <ProfileView id={view.replace('profile_','')} {...shared}
        onToggleAccess={handleToggle} onRenew={handleRenew}
        onUpdateTags={updateParticipantTags}/>

    if (view === 'courses')
      return <CoursesView {...shared}
        onAdd={handleAddCourse} onUpdate={handleUpdateCourse}
        onDelete={handleDeleteCourse} onToggleActive={handleToggleActive}/>

    if (view === 'access')
      return <AccessView {...shared}
        onToggleAccess={handleToggle} onRenew={handleRenew}/>

    if (view === 'reminders')
      return <RemindersView {...shared}/>

    if (view === 'tags')
      return <TagsView tags={tags} participants={participants}
        onAdd={handleAddTag} onEdit={handleEditTag} onDelete={handleDeleteTag}/>

    if (view === 'import')
      return <ImportView participants={participants} courses={courses}
        onImport={handleImport} onBulkUpdate={handleBulkUpdate}/>

    if (view === 'export')
      return <ExportView participants={participants} courses={courses} tags={tags}/>

    if (view === 'certificates')
      return <CertificatesView participants={participants} courses={courses}
        galleryTplPick={galleryTplPick}
        onGalleryConsumed={() => setGalleryTplPick(null)} />

    if (view === 'gallery')
      return <GalleryView onUseCertificate={tpl => { setGalleryTplPick(tpl); setView('certificates') }} />

    return <Dashboard {...shared}/>
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <Sidebar view={view} setView={setView} participants={participants} courses={courses}
        userEmail={user?.email} onSignOut={onSignOut}
        open={sidebarOpen} onClose={closeSidebar}
        theme={theme} onToggleTheme={toggleTheme}/>
      <div className="main-wrapper" style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
            <i className="ti ti-menu-2"/>
          </button>
          <div className="mt-brand">
            <div className="mt-logo">T</div>
            <div className="mt-title">{currentTitle}</div>
          </div>
        </div>
        <main id="main-content" className="main-content">{renderView()}</main>
      </div>
      <Toast message={toastMsg} onHide={() => setToast('')}/>
      <CommandPalette open={paletteOpen} onClose={closePalette}
        participants={participants} courses={courses} tags={tags}
        setView={setView}/>
    </div>
  )
}
