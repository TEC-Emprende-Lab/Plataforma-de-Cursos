from xml.etree import ElementTree as ET


def test_detect_elements_reports_text_and_tspan_metadata(backend_module):
    svg = """
    <svg xmlns="http://www.w3.org/2000/svg">
      <text id="recipient_name" x="120" y="80" font-size="24">Persona</text>
      <g><tspan id="issue_date" x="120" y="110">Fecha</tspan></g>
      <rect id="ignored" width="10" height="10" />
    </svg>
    """

    assert backend_module._detect_elements(svg) == [
        {
            "id": "recipient_name",
            "tag": "text",
            "text": "Persona",
            "x": "120",
            "y": "80",
            "font_size": "24",
        },
        {
            "id": "issue_date",
            "tag": "tspan",
            "text": "Fecha",
            "x": "120",
            "y": "110",
            "font_size": "",
        },
    ]


def test_detect_elements_returns_empty_list_for_invalid_xml(backend_module):
    assert backend_module._detect_elements("<svg><text></svg>") == []


def test_fill_svg_replaces_first_tspan_and_escapes_field_text(backend_module):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg">'
        '<text id="custom_field"><tspan>Anterior</tspan><tspan>Conservar</tspan></text>'
        "</svg>"
    )

    filled = backend_module._fill_svg(svg, {"custom_field": "Ana & <QA>"})

    assert "<tspan>Ana &amp; &lt;QA&gt;</tspan>" in filled
    assert "<tspan>Conservar</tspan>" in filled
    assert "Anterior" not in filled


def test_shift_and_font_helpers_only_change_the_requested_text(backend_module):
    svg = (
        '<svg><text id="target" y="20" font-family="Old">'
        '<tspan y="22" font-family="Child" font-size="10">Uno</tspan></text>'
        '<text id="other" y="30">Dos</text></svg>'
    )

    shifted = backend_module._shift_text_y(svg, "target", 2.5)
    styled = backend_module._set_text_font(shifted, "target", "Sen", 32)
    root = ET.fromstring(styled)
    target, other = root.findall("text")
    span = target.find("tspan")

    assert target.attrib == {
        "id": "target",
        "y": "22.5",
        "font-family": "Sen",
        "font-size": "32",
    }
    assert span.attrib == {"y": "24.5"}
    assert span.text == "Uno"
    assert other.attrib == {"id": "other", "y": "30"}
    assert other.text == "Dos"


def test_spanish_date_format_preserves_unknown_input(backend_module):
    assert backend_module._format_date_es("2026-08-12") == "12 de agosto de 2026"
    assert backend_module._format_date_es("12/08/2026") == "12/08/2026"
    assert backend_module._format_date_es("") == ""
