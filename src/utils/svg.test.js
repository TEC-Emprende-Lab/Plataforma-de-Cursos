// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { sanitizeSvg, svgPreviewMarkup } from './svg.js'

describe('sanitizeSvg', () => {
  it('elimina scripts, handlers y recursos externos sin perder el contenido visual', () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <script>alert(1)</script>
      <foreignObject><div>HTML</div></foreignObject>
      <image href="https://attacker.example/tracker.png" />
      <a href="javascript:alert(1)"><text id="recipient_name">Ana</text></a>
      <rect width="10" height="10" fill="url(#gradient)" />
    </svg>`

    const clean = sanitizeSvg(dirty)

    expect(clean).not.toMatch(/script|foreignObject|onload|javascript:|attacker\.example/i)
    expect(clean).toContain('id="recipient_name"')
    expect(clean).toContain('fill="url(#gradient)"')
  })

  it('conserva referencias internas e imágenes PNG embebidas', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <use href="#signature" />
      <image href="data:image/png;base64,iVBORw0KGgo=" />
    </svg>`

    const clean = sanitizeSvg(svg)
    expect(clean).toContain('href="#signature"')
    expect(clean).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('rechaza texto que no representa un SVG válido', () => {
    expect(sanitizeSvg('<div>no es svg</div>')).toBe('')
    expect(sanitizeSvg('')).toBe('')
  })

  it.each([
    'file:///etc/passwd',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zy8+',
  ])('elimina recursos embebidos o locales no permitidos: %s', resource => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="${resource}" /></svg>`)
    expect(clean).not.toContain(resource)
  })

  it('elimina CSS con importaciones, archivos o escapes sospechosos', () => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg">
      <style>@import url(https://attacker.example/x.css)</style>
      <rect style="fill:url(file:///etc/passwd)" />
    </svg>`)
    expect(clean).not.toMatch(/@import|attacker|file:/i)
  })

  it('elimina URLs externas en atributos de presentación SVG', () => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg">
      <rect filter="url(https://attacker.example/filter.svg#x)" />
      <rect fill="url(file:///etc/passwd)" />
      <rect stroke="url(#safe-gradient)" />
    </svg>`)

    expect(clean).not.toMatch(/attacker\.example|file:/i)
    expect(clean).toContain('stroke="url(#safe-gradient)"')
  })

  it.each([
    'rect{fill:url/**/(https://attacker.example/a)}',
    '@im/**/port url(https://attacker.example/a.css);',
    'rect{fill:u/**/rl(https://attacker.example/a)}',
    'rect{fill:u\\72l(https://attacker.example/a)}',
  ])('elimina CSS ofuscado que podría ocultar recursos externos: %s', css => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><style>${css}</style></svg>`)
    expect(clean).not.toMatch(/attacker\.example/i)
  })

  it('conserva CSS visual seguro y fuentes embebidas permitidas', () => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg">
      <style>
        @font-face{font-family:X;src:url(data:font/woff2;base64,QUJDRA==)}
        text{fill:red;font-family:X}
      </style>
      <text style="fill:red;font-family:X">A</text>
    </svg>`)

    expect(clean).toContain('@font-face')
    expect(clean).toContain('data:font/woff2;base64,QUJDRA==')
    expect(clean).toContain('style="fill:red;font-family:X"')
  })

  it.each([
    `rect{background-image:image-set("https://attacker.example/a" 1x)}`,
    `rect{background-image:cross-fade("//attacker.example/a", #fff)}`,
  ])('elimina recursos externos ocultos en otras funciones CSS: %s', css => {
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><style>${css}</style></svg>`)
    expect(clean).not.toMatch(/attacker\.example/i)
  })
})

describe('svgPreviewMarkup', () => {
  it('agrega únicamente atributos de presentación controlados', () => {
    const markup = svgPreviewMarkup('<svg xmlns="http://www.w3.org/2000/svg"><text>OK</text></svg>', {
      style: 'display:block;width:100%',
      preserveAspectRatio: 'xMidYMid meet',
    })

    expect(markup).toContain('style="display:block;width:100%"')
    expect(markup).toContain('preserveAspectRatio="xMidYMid meet"')
  })
})
