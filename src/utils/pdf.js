// ============================================================
//  pdf.js — Informe ejecutivo con identidad TEC Emprende Lab.
//  Estructura tipo informe corporativo:
//    - Portada (siempre)
//    - Índice (siempre, auto-generado en segunda pasada)
//    - Resumen ejecutivo (narrativa + 6 KPIs + distribuciones)
//    - Desglose por curso (tabla + barras de ocupación)
//    - Desglose por etiqueta (tabla + barras de frecuencia)
//    - Alertas y atención requerida (3 sub-secciones)
//    - Listado detallado de participantes
//
//  API:
//    exportReportToPDF({ participants, courses, tags, sections })
//  sections (5 toggleables):
//    { summary, courses, tagsBreakdown, alerts, list }
//
//  Implementación en dos pasadas para que el índice tenga los
//  números de página correctos sin contar manualmente.
// ============================================================

import jsPDF       from 'jspdf'
import autoTable   from 'jspdf-autotable'
import {
  daysLeft, isExpired, todayISO, getAccessDays, classifyAccess,
} from './time.js'

// ---------- Paleta (sincronizada con global.css) ----------
const COLOR = {
  cream:    '#FAF6EE',
  cream2:   '#F2EBD9',
  border:   '#D4C8B0',
  orange:   '#D44414',
  orangeL:  '#F4894A',
  orangeD:  '#A84020',
  black:    '#1A1612',
  black2:   '#2E2820',
  gray:     '#6E6553',
  white:    '#FFFFFF',
  green:    '#2A5940',
  red:      '#A32D2D',
}

const MARGIN  = 40
const TOP_Y   = 90    // primer Y útil después del header
const BOTTOM  = 50    // espacio reservado para footer

// ---------- Helpers ----------
function shortName(id, courses) {
  return courses.find(c => c.id === id)?.short || id
}

function fmtDateLong(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(iso))
  } catch { return iso }
}

// Reemplaza el carácter de reemplazo Unicode (U+FFFD) que aparece
// cuando un CSV fue cargado con encoding incorrecto. Helvetica
// WinAnsi no lo conoce y lo renderiza como artefactos extraños.
function safeText(v) {
  if (v == null) return ''
  return String(v).replace(/�/g, '?').normalize('NFC')
}

function fmtDateRange(start, end) {
  if (!start && !end) return '—'
  return `${fmtDateLong(start)} - ${fmtDateLong(end)}`
}

function generatedAt() {
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date())
}

function pct(num, den) {
  if (!den) return '0%'
  return Math.round((num / den) * 100) + '%'
}

// ---------- Cover / portada ----------
function renderCover(doc, pageW, pageH) {
  // Fondo cream
  doc.setFillColor(COLOR.cream)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Banda naranja superior
  doc.setFillColor(COLOR.orange)
  doc.rect(0, 0, pageW, 8, 'F')

  // Logo box (placeholder cuadrado naranja con "T")
  const logoSize = 70
  const logoX = (pageW - logoSize) / 2
  const logoY = 180
  doc.setFillColor(COLOR.orange)
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 10, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(40)
  doc.setTextColor(COLOR.white)
  doc.text('T', logoX + logoSize / 2, logoY + logoSize / 2 + 14, { align: 'center' })

  // Institución
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(COLOR.gray)
  doc.text('TEC EMPRENDE LAB', pageW / 2, logoY + logoSize + 28, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Gestión de cursos virtuales', pageW / 2, logoY + logoSize + 42, { align: 'center' })

  // Línea divisora
  doc.setDrawColor(COLOR.border)
  doc.setLineWidth(0.6)
  doc.line(pageW / 2 - 100, logoY + logoSize + 62, pageW / 2 + 100, logoY + logoSize + 62)

  // Título principal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(COLOR.black)
  doc.text('Informe Ejecutivo', pageW / 2, logoY + logoSize + 110, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(COLOR.orange)
  doc.text('Plataforma de Cursos', pageW / 2, logoY + logoSize + 132, { align: 'center' })

  // Metadata centrada abajo
  const metaY = pageH - 200
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(COLOR.gray)
  doc.text('FECHA DE GENERACIÓN', pageW / 2, metaY, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(COLOR.black)
  doc.text(generatedAt(), pageW / 2, metaY + 16, { align: 'center' })

  // Aviso de confidencialidad
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(COLOR.gray)
  doc.text(
    'Documento de uso interno. Contiene información sensible de participantes inscritos.',
    pageW / 2, pageH - 80, { align: 'center', maxWidth: pageW - 100 }
  )

  // Footer institucional
  doc.setFontSize(8)
  doc.setTextColor(COLOR.gray)
  doc.text('tecemprendelab@itcr.ac.cr  ·  2550-9270', pageW / 2, pageH - 50, { align: 'center' })
}

// ---------- Header (páginas internas) ----------
function drawHeader(doc, pageW, sectionTitle) {
  doc.setFillColor(COLOR.orange)
  doc.rect(0, 0, pageW, 50, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(COLOR.white)
  doc.text('TEC Emprende Lab', MARGIN, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Informe Ejecutivo · Plataforma de Cursos', MARGIN, 38)

  if (sectionTitle) {
    doc.setFontSize(9)
    doc.text(sectionTitle, pageW - MARGIN, 38, { align: 'right' })
  }
}

function drawFooter(doc, pageW, pageH, pageN, totalPages) {
  doc.setDrawColor(COLOR.border)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, pageH - 30, pageW - MARGIN, pageH - 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(COLOR.gray)
  doc.text(`Generado ${generatedAt()}  ·  tecemprendelab@itcr.ac.cr`, MARGIN, pageH - 16)
  doc.text(`Página ${pageN} / ${totalPages}`, pageW - MARGIN, pageH - 16, { align: 'right' })
}

function drawSectionTitle(doc, text, y, subtitle) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(COLOR.black)
  doc.text(text, MARGIN, y)

  doc.setDrawColor(COLOR.orange)
  doc.setLineWidth(2)
  doc.line(MARGIN, y + 6, MARGIN + 50, y + 6)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(COLOR.gray)
    doc.text(subtitle, MARGIN, y + 22, { maxWidth: 480 })
    return y + 38
  }
  return y + 22
}

// ---------- KPI cards ----------
function drawKpiCard(doc, x, y, w, h, value, label, accent = COLOR.orange) {
  doc.setFillColor(COLOR.white)
  doc.setDrawColor(COLOR.border)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 4, 4, 'FD')

  doc.setFillColor(accent)
  doc.rect(x, y, 3, h, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(accent)
  doc.text(String(value), x + 12, y + 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(COLOR.gray)
  doc.text(label, x + 12, y + 46, { maxWidth: w - 20 })
}

function drawKpiGrid(doc, startY, pageW, stats) {
  const gridX = MARGIN
  const gridW = pageW - 2 * MARGIN
  const colW  = (gridW - 20) / 3
  const rowH  = 60

  const items = [
    ['Total Participantes',      stats.total,     COLOR.black],
    ['Activos',                  stats.activos,   COLOR.green],
    ['Con acceso vigente',       stats.conAcceso, COLOR.green],
    ['Por vencer (7 d o menos)', stats.porVencer, COLOR.orange],
    ['Accesos expirados',        stats.expirados, COLOR.red],
    ['Pagos pendientes',         stats.pagosPend, COLOR.orange],
  ]
  items.forEach(([label, value, color], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = gridX + col * (colW + 10)
    const y = startY + row * (rowH + 10)
    drawKpiCard(doc, x, y, colW, rowH, value, label, color)
  })
  return startY + Math.ceil(items.length / 3) * (rowH + 10)
}

// ---------- Bar chart horizontal ----------
function drawHorizontalBars(doc, x, y, w, items, totalRef) {
  // items: [{ label, value }, ...] ya ordenados desc
  // totalRef: para calcular % (capacity o total participantes)
  const rowH    = 18
  const labelW  = 130
  const barX    = x + labelW
  const barMax  = w - labelW - 60   // 60 reservado para el número al final
  const maxVal  = Math.max(...items.map(i => i.value), 1)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  items.forEach((item, i) => {
    const rowY = y + i * rowH

    // Etiqueta a la izquierda
    doc.setTextColor(COLOR.black)
    doc.text(
      item.label.length > 28 ? item.label.slice(0, 26) + '…' : item.label,
      x, rowY + 12
    )

    // Track de fondo
    doc.setFillColor(COLOR.cream)
    doc.roundedRect(barX, rowY + 4, barMax, rowH - 8, 2, 2, 'F')

    // Barra de color
    const barW = (item.value / maxVal) * barMax
    if (barW > 0) {
      doc.setFillColor(COLOR.orange)
      doc.roundedRect(barX, rowY + 4, barW, rowH - 8, 2, 2, 'F')
    }

    // Número y % al final
    doc.setTextColor(COLOR.gray)
    const txt = totalRef
      ? `${item.value} (${pct(item.value, totalRef)})`
      : String(item.value)
    doc.text(txt, x + w, rowY + 12, { align: 'right' })
  })
  return y + items.length * rowH
}

// ---------- Stats ----------
function calcStats(participants, courses = []) {
  return {
    total:      participants.length,
    activos:    participants.filter(p => p.status === 'activo').length,
    inactivos:  participants.filter(p => p.status === 'inactivo').length,
    conAcceso:  participants.filter(p => p.access).length,
    sinAcceso:  participants.filter(p => !p.access).length,
    porVencer:  participants.filter(p => classifyAccess(p, courses) === 'por_vencer').length,
    expirados:  participants.filter(p => classifyAccess(p, courses) === 'expirado').length,
    pagosPend:  participants.filter(p => p.payment === 'pendiente').length,
    pagados:    participants.filter(p => p.payment === 'pagado').length,
  }
}

// ---------- Sección: Resumen ejecutivo ----------
function renderSummary(doc, pageW, pageH, participants, courses, tags) {
  const stats = calcStats(participants, courses)
  const totalCursos = courses.length
  const cursosActivos = courses.filter(c => c.active).length
  const totalTags = tags.length

  let y = TOP_Y

  // Narrativa
  y = drawSectionTitle(
    doc, '1. Resumen ejecutivo', y,
    `Estado consolidado de la plataforma al ${fmtDateLong(todayISO())}.`
  )

  const narrativa = [
    `Al corte actual, la plataforma cuenta con ${stats.total} participantes registrados, `
    + `de los cuales ${stats.activos} se encuentran en estado activo y ${stats.conAcceso} `
    + `tienen acceso vigente al contenido de sus cursos.`,
    `Actualmente hay ${cursosActivos} cursos o talleres activos sobre un total de `
    + `${totalCursos} programados, y se utilizan ${totalTags} etiquetas para clasificación interna.`,
    stats.porVencer + stats.expirados > 0
      ? `Requieren atención: ${stats.porVencer} participantes con acceso por vencer en los próximos 7 días `
        + `y ${stats.expirados} con acceso ya expirado.`
      : 'Ningún participante requiere atención inmediata por vencimiento o expiración de acceso.',
    stats.pagosPend > 0
      ? `Hay ${stats.pagosPend} participantes con pagos pendientes que conviene revisar.`
      : 'Todos los participantes registrados están al día con sus pagos.',
  ]

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(COLOR.black2)
  narrativa.forEach(parr => {
    const lines = doc.splitTextToSize(parr, pageW - 2 * MARGIN)
    doc.text(lines, MARGIN, y)
    y += lines.length * 13 + 6
  })
  y += 6

  // KPIs
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(COLOR.black)
  doc.text('Indicadores principales', MARGIN, y)
  y += 14
  y = drawKpiGrid(doc, y, pageW, stats) + 14

  // Distribuciones
  if (y < pageH - BOTTOM - 110) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR.black)
    doc.text('Distribución por estado y pago', MARGIN, y)
    y += 14
    const dist = [
      { label: 'Estado: Activos',    value: stats.activos   },
      { label: 'Estado: Inactivos',  value: stats.inactivos },
      { label: 'Pago: Pagados',      value: stats.pagados   },
      { label: 'Pago: Pendientes',   value: stats.pagosPend },
    ]
    y = drawHorizontalBars(doc, MARGIN, y, pageW - 2 * MARGIN, dist, stats.total)
  }
}

// ---------- Sección: Cursos ----------
function renderCourses(doc, pageW, courses, participants) {
  let y = TOP_Y
  y = drawSectionTitle(
    doc, '2. Cursos y talleres', y,
    'Desglose por programa con tasa de ocupación e información de matrícula.'
  )

  const rows = courses.map(c => {
    const inscritos = participants.filter(p => p.courses?.includes(c.id)).length
    const cap = c.capacity || 0
    return {
      ...c,
      inscritos,
      pctOcup: cap > 0 ? Math.round((inscritos / cap) * 100) : 0,
      capacityLabel: cap > 0 ? `${inscritos} / ${cap}` : String(inscritos),
    }
  })

  autoTable(doc, {
    startY: y,
    head: [['Programa', 'Tipo', 'Modalidad', 'Plataforma', 'Inscritos', '% Ocup.', 'Fechas', 'Estado']],
    body: rows.map(r => [
      safeText(r.name),
      r.type,
      safeText(r.modalidad) || '—',
      safeText(r.platform) || '—',
      r.capacityLabel,
      r.capacity > 0 ? r.pctOcup + '%' : '—',
      fmtDateRange(r.start, r.end),
      r.active ? 'Activo' : 'Inactivo',
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5,
      textColor: COLOR.black, lineColor: COLOR.border, lineWidth: 0.4 },
    headStyles: { fillColor: COLOR.black, textColor: COLOR.white,
      fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: COLOR.cream },
    columnStyles: {
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center' },
    },
    margin: { left: MARGIN, right: MARGIN },
  })
  y = doc.lastAutoTable.finalY + 20

  // Barras visuales solo si caben
  const activeCourses = rows.filter(r => r.active && r.capacity > 0)
  if (activeCourses.length && y < doc.internal.pageSize.getHeight() - BOTTOM - activeCourses.length * 18 - 60) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR.black)
    doc.text('Ocupación visual (cursos activos)', MARGIN, y)
    y += 14
    const bars = activeCourses
      .map(r => ({ label: r.short || r.name, value: r.inscritos, capacity: r.capacity }))
      .sort((a, b) => b.value - a.value)
    drawHorizontalBars(doc, MARGIN, y, pageW - 2 * MARGIN, bars)
  }
}

// ---------- Sección: Etiquetas ----------
function renderTags(doc, pageW, tags, participants) {
  let y = TOP_Y
  y = drawSectionTitle(
    doc, '3. Etiquetas', y,
    'Clasificación interna de participantes por etiquetas de uso libre.'
  )

  const total = participants.length || 1
  const rows = tags
    .map(t => ({
      name: safeText(t.name),
      n: participants.filter(p => p.tags?.includes(t.id)).length,
    }))
    .sort((a, b) => b.n - a.n)

  autoTable(doc, {
    startY: y,
    head: [['Etiqueta', 'Participantes', '% del total']],
    body: rows.length
      ? rows.map(r => [r.name, String(r.n), pct(r.n, total)])
      : [['—', '0', '0%']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6,
      textColor: COLOR.black, lineColor: COLOR.border, lineWidth: 0.4 },
    headStyles: { fillColor: COLOR.black, textColor: COLOR.white,
      fontStyle: 'bold', fontSize: 10 },
    alternateRowStyles: { fillColor: COLOR.cream },
    columnStyles: {
      1: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'center' },
    },
    margin: { left: MARGIN, right: MARGIN },
  })
  y = doc.lastAutoTable.finalY + 20

  if (rows.length && y < doc.internal.pageSize.getHeight() - BOTTOM - rows.length * 18 - 60) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR.black)
    doc.text('Frecuencia de uso', MARGIN, y)
    y += 14
    drawHorizontalBars(
      doc, MARGIN, y, pageW - 2 * MARGIN,
      rows.map(r => ({ label: r.name, value: r.n })), total
    )
  }
}

// ---------- Sección: Alertas y atención requerida ----------
function renderAlerts(doc, pageW, participants, courses) {
  let y = TOP_Y
  y = drawSectionTitle(
    doc, '4. Alertas y atención requerida', y,
    'Participantes que requieren seguimiento inmediato por parte del equipo.'
  )

  const porVencer = participants.filter(p => classifyAccess(p, courses) === 'por_vencer')
  const expirados = participants.filter(p => classifyAccess(p, courses) === 'expirado')
  const pagosPend = participants.filter(p => p.payment === 'pendiente')

  const renderSub = (title, list, daysCol) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(COLOR.black)
    doc.text(`${title} (${list.length})`, MARGIN, y)
    y += 12

    if (!list.length) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(COLOR.gray)
      doc.text('Sin casos por atender en esta categoría.', MARGIN, y)
      y += 22
      return
    }

    const head = daysCol
      ? [['Nombre', 'Correo', 'Teléfono', 'Cursos', 'Días']]
      : [['Nombre', 'Correo', 'Teléfono', 'Cursos', 'Pago']]

    const body = list.map(p => {
      const cursos = (p.courses || []).map(id => safeText(shortName(id, courses))).join(', ') || '—'
      const days = getAccessDays(p, courses)
      const lastCol = daysCol
        ? (isExpired(p.fecha, days) ? 'Expirado' : `${daysLeft(p.fecha, days)} d`)
        : (p.payment === 'pagado' ? 'Pagado' : 'Pendiente')
      return [safeText(p.name), safeText(p.email) || '—', safeText(p.phone) || '—', cursos, lastCol]
    })

    autoTable(doc, {
      startY: y,
      head, body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4,
        textColor: COLOR.black, lineColor: COLOR.border, lineWidth: 0.4 },
      headStyles: { fillColor: COLOR.black2, textColor: COLOR.white,
        fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: COLOR.cream },
      columnStyles: { 4: { halign: 'center', fontStyle: 'bold' } },
      margin: { left: MARGIN, right: MARGIN },
    })
    y = doc.lastAutoTable.finalY + 16
  }

  renderSub('Accesos por vencer en 7 días', porVencer, true)
  renderSub('Accesos expirados',            expirados, true)
  renderSub('Pagos pendientes',             pagosPend, false)
}

// ---------- Sección: Listado completo ----------
function renderList(doc, pageW, participants, courses) {
  let y = TOP_Y
  y = drawSectionTitle(
    doc, '5. Listado detallado de participantes', y,
    `Inventario completo (${participants.length} registros) con datos de contacto e inscripciones.`
  )

    const rows = participants.map(p => {
      const cursos = (p.courses || []).map(id => safeText(shortName(id, courses))).join(', ') || '—'
      const days = getAccessDays(p, courses)
      // Misma precedencia que classifyAccess/TimerBadge: la vigencia manda.
      const dias = isExpired(p.fecha, days) ? 'Expirado'
        : !p.access ? 'Sin acceso'
        : `${daysLeft(p.fecha, days)} d`
    return [
      safeText(p.name),
      safeText(p.cedula) || '—',
      safeText(p.email)  || '—',
      safeText(p.phone)  || '—',
      cursos,
      dias,
      p.payment === 'pagado' ? 'Pagado' : 'Pendiente',
      p.status  === 'activo' ? 'Activo' : 'Inactivo',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Nombre', 'Cédula', 'Correo', 'Teléfono', 'Cursos', 'Días rest.', 'Pago', 'Estado']],
    body: rows.length ? rows : [['Sin participantes', '', '', '', '', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4,
      textColor: COLOR.black, lineColor: COLOR.border, lineWidth: 0.4,
      overflow: 'linebreak' },
    headStyles: { fillColor: COLOR.black, textColor: COLOR.white,
      fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: COLOR.cream },
    columnStyles: {
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center' },
      7: { halign: 'center' },
    },
    margin: { left: MARGIN, right: MARGIN, top: TOP_Y, bottom: BOTTOM + 10 },
  })
}

// ---------- Índice (TOC) ----------
function renderTOC(doc, pageW, pageH, tocEntries) {
  let y = TOP_Y
  y = drawSectionTitle(doc, 'Índice', y, 'Contenido del informe.')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(COLOR.black)

  const dotted = (label, num) => {
    // título a la izquierda, página a la derecha, puntos en el medio
    const txt = label
    doc.text(txt, MARGIN, y)
    doc.text(String(num), pageW - MARGIN, y, { align: 'right' })
    // línea punteada de relleno
    doc.setLineDashPattern([1, 2], 0)
    doc.setDrawColor(COLOR.border)
    doc.setLineWidth(0.4)
    const txtW = doc.getTextWidth(txt)
    const numW = doc.getTextWidth(String(num))
    doc.line(MARGIN + txtW + 6, y - 2, pageW - MARGIN - numW - 6, y - 2)
    doc.setLineDashPattern([], 0)
    y += 22
  }

  tocEntries.forEach(({ title, page }) => dotted(title, page))
}

// ---------- API pública ----------
export function exportReportToPDF({ participants, courses, tags, sections }) {
  const doc   = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Lista de secciones activas en orden
  const order = [
    { key: 'summary',       title: '1. Resumen ejecutivo'         },
    { key: 'courses',       title: '2. Cursos y talleres'         },
    { key: 'tagsBreakdown', title: '3. Etiquetas'                 },
    { key: 'alerts',        title: '4. Alertas y atención'        },
    { key: 'list',          title: '5. Listado de participantes'  },
  ].filter(s => sections[s.key])

  // ---------- PORTADA ----------
  renderCover(doc, pageW, pageH)

  // ---------- ÍNDICE (placeholder, se rellena al final) ----------
  doc.addPage()
  const tocPageNum = doc.internal.getNumberOfPages()
  // Lo dibujamos vacío ahora; reescribimos al final cuando sabemos los page nums.

  // ---------- SECCIONES ----------
  const tocEntries = []
  order.forEach(({ key, title }) => {
    doc.addPage()
    tocEntries.push({ title, page: doc.internal.getNumberOfPages() })
    switch (key) {
      case 'summary':       renderSummary(doc, pageW, pageH, participants, courses, tags); break
      case 'courses':       renderCourses(doc, pageW, courses, participants);              break
      case 'tagsBreakdown': renderTags(doc, pageW, tags, participants);                    break
      case 'alerts':        renderAlerts(doc, pageW, participants, courses);               break
      case 'list':          renderList(doc, pageW, participants, courses);                 break
    }
  })

  // ---------- Volver al índice y dibujarlo ----------
  doc.setPage(tocPageNum)
  renderTOC(doc, pageW, pageH, tocEntries)

  // ---------- Header + footer en todas las páginas internas ----------
  const totalPages = doc.internal.getNumberOfPages()
  // Mapa de páginas a títulos de sección para el header
  const pageToSection = new Map()
  pageToSection.set(tocPageNum, 'Índice')
  tocEntries.forEach(e => pageToSection.set(e.page, e.title))

  for (let i = 2; i <= totalPages; i++) {  // skip portada (i=1)
    doc.setPage(i)
    // Si la página fue creada al ejecutar autoTable con paginación, buscar la sección
    // más cercana hacia atrás
    let sectionTitle = pageToSection.get(i)
    if (!sectionTitle) {
      for (let j = i - 1; j >= 2; j--) {
        if (pageToSection.has(j)) { sectionTitle = pageToSection.get(j); break }
      }
    }
    drawHeader(doc, pageW, sectionTitle || '')
    drawFooter(doc, pageW, pageH, i, totalPages)
  }

  doc.save(`informe-tec-emprende-lab-${todayISO()}.pdf`)
}
