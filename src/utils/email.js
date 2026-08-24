// ============================================================
//  email.js — JavaScript
//  Construcción de correos recordatorio.
//  courses se pasa como parámetro para usar los datos dinámicos.
// ============================================================

import { expiryDate, examDeadlineDate, getAccessDays } from './time.js'

export function buildReminderEmail(participant, courses = []) {
  const names   = participant.courses
    .map(id => courses.find(c => c.id === id)?.name || id)
    .join(', ')
  // La vigencia del correo respeta los días de acceso reales de los cursos
  const days     = getAccessDays(participant, courses)
  const examDate = examDeadlineDate(participant.fecha, days)
  const expDate  = expiryDate(participant.fecha, days)

  return {
    to:      participant.email,
    from:    'tecemprendelab@itcr.ac.cr',
    subject: `Recordatorio: Realizá tu prueba final — ${names}`,
    body: `Estimada/o ${participant.name},

Esperamos que tu proceso de aprendizaje en TEC Emprende Lab esté siendo de mucho provecho.

Te escribimos para recordarte que debés completar la prueba final del curso "${names}" antes del ${examDate}.

⚠️ IMPORTANTE — Revocación de acceso:
Tu acceso a la plataforma TEC Digital estará disponible hasta el ${expDate}.
Pasada esa fecha, el acceso será revocado automáticamente.

Pasos para realizar la prueba:
  1. Ingresá a la plataforma TEC Digital
  2. Buscá el curso "${names}"
  3. Completá la prueba final con una calificación mínima de 70
  4. Al aprobar, recibirás tu certificado digital

📧  tecemprendelab@itcr.ac.cr  |  📞  2550-9270

¡Mucho éxito!
TEC Emprende Lab — ITCR`,
  }
}

export function openEmailClient(participant, courses = []) {
  const { to, subject, body } = buildReminderEmail(participant, courses)
  window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
}

export async function copyEmailToClipboard(participant, courses = []) {
  const { subject, body } = buildReminderEmail(participant, courses)
  await navigator.clipboard.writeText(`Asunto: ${subject}\n\n${body}`)
}
