from pathlib import Path

import pytest

try:
    from svg_security import PUBLIC_ERROR, SvgLimits, SvgValidationError, validate_svg
except ModuleNotFoundError:  # Permite ejecutar pytest desde la raíz del repositorio.
    from backend.svg_security import (
        PUBLIC_ERROR,
        SvgLimits,
        SvgValidationError,
        validate_svg,
    )


SAFE_SVG = """<svg xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="gradient"><stop offset="0" stop-color="#fff" /></linearGradient>
    <filter id="shadow"><feDropShadow dx="1" dy="1" stdDeviation="2" /></filter>
    <path id="signature" d="M0 0 L10 10" />
    <style>
      @font-face { font-family: 'Safe'; src: url('data:font/truetype;base64,QUJDRA==') format('truetype'); }
      .name { fill: url(#gradient); font-family: 'Safe'; }
    </style>
  </defs>
  <rect width="100" height="100" fill="url(#gradient)" filter="url(#shadow)" />
  <use href="#signature" />
  <image xlink:href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10" />
  <text id="recipient_name" class="name"><tspan>Ana</tspan></text>
</svg>"""

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"


def test_preserves_safe_certificate_features_without_rewriting():
    assert validate_svg(SAFE_SVG.encode("utf-8")) == SAFE_SVG


@pytest.mark.parametrize(
    "filename",
    ["firma_yorleny.svg", "template_classic.svg", "template_modern.svg"],
)
def test_accepts_the_bundled_svg_templates(filename):
    template = TEMPLATES_DIR / filename
    original = template.read_bytes()
    assert validate_svg(original).encode("utf-8") == original


@pytest.mark.parametrize(
    ("payload", "code"),
    [
        ("<div />", "root"),
        ("<svg><script>alert(1)</script></svg>", "element"),
        ("<svg><foreignObject><p>HTML</p></foreignObject></svg>", "element"),
        ('<svg onload="alert(1)" />', "event-handler"),
        ('<svg><image href="https://attacker.example/x.png" /></svg>', "resource-url"),
        ('<svg><image href="file:///etc/passwd" /></svg>', "resource-url"),
        ('<svg><image href="data:image/svg+xml;base64,PHN2Zz4=" /></svg>', "resource-url"),
        ('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>', "resource-url"),
        ('<svg><rect style="fill:url(https://attacker.example/x)" /></svg>', "css-url"),
        ('<svg><style>@import "https://attacker.example/x";</style></svg>', "css-at-rule"),
        ('<svg><style>rect{fill:url(file:///etc/passwd)}</style></svg>', "css-url"),
        ('<svg><style>rect{fill:url(data:image/svg+xml;base64,PHN2Zz4=)}</style></svg>', "css-url"),
        ('<svg><rect style="width:expression(alert(1))" /></svg>', "css-function"),
        ("<?xml-stylesheet href='https://attacker.example/x.css'?><svg />", "processing-instruction"),
        ("<!DOCTYPE svg><svg />", "xml"),
        ("<!DOCTYPE svg [<!ENTITY x 'boom'>]><svg><text>&x;</text></svg>", "xml"),
    ],
)
def test_rejects_active_or_external_content(payload, code):
    with pytest.raises(SvgValidationError) as caught:
        validate_svg(payload)

    assert caught.value.code == code
    assert str(caught.value) == PUBLIC_ERROR


@pytest.mark.parametrize(
    "payload",
    [
        r'<svg><rect style="fill:u\72l(https://attacker.example/x)" /></svg>',
        '<svg><style>rect{fill:url/**/(https://attacker.example/x)}</style></svg>',
        '<svg><style>@im/**/port url(https://attacker.example/x.css)</style></svg>',
        '<svg><style>rect{fill:u/**/rl(https://attacker.example/x)}</style></svg>',
        '<svg><style>rect{background-image:image-set("https://attacker.example/x" 1x)}</style></svg>',
        "<svg><rect style=\"background-image:cross-fade('//attacker.example/x', #fff)\" /></svg>",
    ],
)
def test_css_obfuscation_cannot_hide_an_external_url(payload):

    with pytest.raises(SvgValidationError) as caught:
        validate_svg(payload)

    assert caught.value.code in {"css-obfuscation", "css-resource"}


@pytest.mark.parametrize(
    "payload",
    [
        b"\xff\xfe<svg />",
        "",
        "<svg><text></svg>",
        '<svg xmlns="urn:not-svg" />',
        '<svg><rect unknown-attribute="x" /></svg>',
    ],
)
def test_rejects_invalid_documents(payload):
    with pytest.raises(SvgValidationError):
        validate_svg(payload)


def test_enforces_configurable_size_structure_and_attribute_limits():
    with pytest.raises(SvgValidationError) as bytes_error:
        validate_svg("<svg />", limits=SvgLimits(max_bytes=3))
    assert bytes_error.value.code == "bytes"

    nested = "<svg><g><rect /></g></svg>"
    with pytest.raises(SvgValidationError) as depth_error:
        validate_svg(nested, limits=SvgLimits(max_depth=2))
    assert depth_error.value.code == "depth"

    with pytest.raises(SvgValidationError) as element_error:
        validate_svg(nested, limits=SvgLimits(max_elements=2))
    assert element_error.value.code == "elements"

    attributed = '<svg><rect x="1" y="2" width="3" /></svg>'
    with pytest.raises(SvgValidationError) as attribute_error:
        validate_svg(
            attributed,
            limits=SvgLimits(max_attributes_per_element=2),
        )
    assert attribute_error.value.code == "attributes-per-element"


def test_environment_configuration_uses_positive_values(monkeypatch):
    monkeypatch.setenv("MAX_SVG_BYTES", "1234")
    monkeypatch.setenv("MAX_SVG_ELEMENTS", "321")
    monkeypatch.setenv("MAX_SVG_DEPTH", "12")
    monkeypatch.setenv("MAX_SVG_ATTRIBUTES_PER_ELEMENT", "17")
    monkeypatch.setenv("MAX_SVG_TOTAL_ATTRIBUTES", "456")

    assert SvgLimits.from_env() == SvgLimits(
        max_bytes=1234,
        max_elements=321,
        max_depth=12,
        max_attributes_per_element=17,
        max_total_attributes=456,
    )
