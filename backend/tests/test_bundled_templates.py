from pathlib import Path

from services.svg import bundled_template_path, list_bundled_svg_names


def test_list_bundled_svg_names_includes_known_templates():
    names = set(list_bundled_svg_names())
    assert names == {
        "firma_yorleny.svg",
        "template_classic.svg",
        "template_modern.svg",
    }


def test_bundled_template_path_rejects_missing_and_path_escape():
    templates = Path(__file__).resolve().parents[1] / "templates"
    assert bundled_template_path("does-not-exist.svg") is None
    escaped = bundled_template_path("../app.py")
    assert escaped is None or escaped.parent == templates
