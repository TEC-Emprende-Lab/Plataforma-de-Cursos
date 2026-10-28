import { CERT_API } from '../config.js'
import { certificateApiFetch } from '../lib/certificateApi.js'

function buildForm(data = {}) {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (v instanceof Blob || v instanceof File) {
      form.append(k, v)
      return
    }
    if (typeof v === 'object') {
      form.append(k, JSON.stringify(v))
      return
    }
    form.append(k, v)
  })
  return form
}

async function parseError(res) {
  try {
    const data = await res.clone().json()
    return data?.error || data?.message || `Error ${res.status}`
  } catch {
    try {
      const text = await res.clone().text()
      return text || `Error ${res.status}`
    } catch {
      return `Error ${res.status}`
    }
  }
}

export async function getTemplates() {
  const res = await certificateApiFetch(`${CERT_API}/api/templates`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getTemplateContent(name) {
  const res = await certificateApiFetch(`${CERT_API}/api/templates/${name}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.text()
}

export async function getHealth() {
  const res = await fetch(`${CERT_API}/api/health`).catch(() => null)
  if (!res?.ok) return false
  return true
}

export async function getAiStatus() {
  const res = await fetch(`${CERT_API}/api/ai/status`).catch(() => null)
  if (!res?.ok) return false
  try {
    const d = await res.json()
    return !!d.available
  } catch {
    return false
  }
}

export async function analyzeSvg({ file, templateName }) {
  const form = buildForm({ file, template_name: templateName })
  const res = await certificateApiFetch(`${CERT_API}/api/analyze`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function previewCertificate({ file, templateName, fields, nameFieldId, dateFieldId }) {
  const form = buildForm({ file, template_name: templateName, fields, name_field_id: nameFieldId, date_field_id: dateFieldId })
  const res = await certificateApiFetch(`${CERT_API}/api/preview`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.text()
}

export async function generateCertificate({ file, templateName, fields, nameFieldId, dateFieldId, outputFormat }) {
  const form = buildForm({ file, template_name: templateName, fields, name_field_id: nameFieldId, date_field_id: dateFieldId, output_format: outputFormat })
  const res = await certificateApiFetch(`${CERT_API}/api/generate`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.blob()
}

export async function generateCertificateBatch({ file, templateName, csvFile, nameFieldId, dateFieldId, outputFormat, globalDate, extraFields }) {
  const form = buildForm({ file, template_name: templateName, csv_file: csvFile, name_field_id: nameFieldId, date_field_id: dateFieldId, output_format: outputFormat, global_date: globalDate, extra_fields: extraFields })
  const res = await certificateApiFetch(`${CERT_API}/api/generate/batch`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return { blob: await res.blob(), headers: res.headers }
}

export async function suggestMapping({ file, templateName }) {
  const form = buildForm({ file, template_name: templateName })
  const res = await certificateApiFetch(`${CERT_API}/api/ai/mapeo`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function lookupCedula({ cedula }) {
  const res = await certificateApiFetch(`${CERT_API}/api/cedulas/lookup`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula }) 
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function uploadTemplate({ file }) {
  const form = buildForm({ file })
  const res = await certificateApiFetch(`${CERT_API}/api/templates/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteTemplate({ filename }) {
  const res = await certificateApiFetch(`${CERT_API}/api/templates/delete`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }) 
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
