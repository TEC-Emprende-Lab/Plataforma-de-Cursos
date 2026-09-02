import pytest

from services import certificates as certificate_service
from services.errors import ServiceError


def test_analyze_requires_svg_text():
    with pytest.raises(ServiceError) as caught:
        certificate_service.analyze(None)
    assert caught.value.public_message == "no SVG proporcionado"
    assert caught.value.status == 400


def test_generate_rejects_unknown_format():
    with pytest.raises(ServiceError) as caught:
        certificate_service.generate("<svg></svg>", {}, "exe", "req-1")
    assert caught.value.code == "invalid_format"
    assert caught.value.status == 400


def test_preview_requires_svg_text():
    with pytest.raises(ServiceError) as caught:
        certificate_service.preview(None, {})
    assert caught.value.public_message == "no SVG proporcionado"


def test_generate_batch_rejects_too_many_rows():
    with pytest.raises(ServiceError) as caught:
        certificate_service.generate_batch(
            svg_text="<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            csv_text="Nombre\nAna\nLuis\nEva\n",
            fmt="pdf",
            name_id="recipient_name",
            date_id="issue_date",
            global_date="",
            extra_fields={},
            request_id="req-1",
            max_rows=2,
        )
    assert caught.value.code == "too_many_rows"
