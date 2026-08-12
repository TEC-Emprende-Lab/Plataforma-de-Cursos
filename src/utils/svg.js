import DOMPurify from 'dompurify'

const FORBIDDEN_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video']
const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src'])
const SAFE_EMBEDDED_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,/i
const SAFE_EMBEDDED_FONT = /^data:font\/(?:truetype|opentype|ttf|otf|woff2?);base64,/i
const DANGEROUS_CSS = /(?:javascript\s*:|vbscript\s*:|expression\s*\(|@import|behavior\s*:|-moz-binding|\\|\/\*)/i
const EXTERNAL_CSS_RESOURCE = /(?:(?:https?|file|ftp|javascript|vbscript)\s*:|\/\/|data\s*:)/i
const CSS_URL = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi

function isSafeResource(value) {
  const normalized = value.trim()
  return normalized === '' || normalized.startsWith('#') || SAFE_EMBEDDED_IMAGE.test(normalized)
}

function isSafeCss(value) {
  if (DANGEROUS_CSS.test(value)) return false
  for (const match of value.matchAll(CSS_URL)) {
    const resource = match[2].trim()
    if (!resource.startsWith('#') && !SAFE_EMBEDDED_IMAGE.test(resource) && !SAFE_EMBEDDED_FONT.test(resource)) {
      return false
    }
  }
  // Remove already validated url(...) values; any remaining absolute resource
  // is hidden in another CSS function such as image-set() or cross-fade().
  if (EXTERNAL_CSS_RESOURCE.test(value.replace(CSS_URL, ''))) return false
  return true
}

export function sanitizeSvg(svgText) {
  if (typeof svgText !== 'string' || !svgText.trim()) return ''

  const sanitized = DOMPurify.sanitize(svgText, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
    FORBID_TAGS: FORBIDDEN_TAGS,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })

  const doc = new DOMParser().parseFromString(sanitized, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') return ''

  doc.querySelectorAll('*').forEach(element => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
      } else if (URL_ATTRIBUTES.has(name) && !isSafeResource(attribute.value)) {
        element.removeAttribute(attribute.name)
      } else if (/url\s*\(/i.test(attribute.value) && !isSafeCss(attribute.value)) {
        element.removeAttribute(attribute.name)
      } else if (name === 'style' && !isSafeCss(attribute.value)) {
        element.removeAttribute(attribute.name)
      }
    }
  })

  doc.querySelectorAll('style').forEach(style => {
    if (!isSafeCss(style.textContent || '')) style.remove()
  })

  return new XMLSerializer().serializeToString(doc.documentElement)
}

export function svgPreviewMarkup(svgText, attributes = {}) {
  const sanitized = sanitizeSvg(svgText)
  if (!sanitized) return ''

  const doc = new DOMParser().parseFromString(sanitized, 'image/svg+xml')
  const root = doc.documentElement
  if (attributes.style) root.setAttribute('style', attributes.style)
  if (attributes.preserveAspectRatio) root.setAttribute('preserveAspectRatio', attributes.preserveAspectRatio)
  return new XMLSerializer().serializeToString(root)
}
