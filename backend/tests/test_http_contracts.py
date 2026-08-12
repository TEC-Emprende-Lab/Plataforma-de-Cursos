import io
import zipfile


SIMPLE_SVG = b"""<svg xmlns="http://www.w3.org/2000/svg">
<text id="recipient_name" x="10" y="20">Nombre</text>
<text id="issue_date" x="10" y="40">Fecha</text>
</svg>"""


def test_health_reports_service_capabilities(client, backend_module, monkeypatch):
    monkeypatch.setattr(backend_module, "CAIRO_OK", False)
    monkeypatch.setattr(backend_module, "AI_OK", False)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok", "cairo": False, "ai": False}


def test_templates_contract_lists_and_serves_bundled_svg(client):
    listing = client.get("/api/templates")

    assert listing.status_code == 200
    assert set(listing.get_json()["templates"]) == {
        "firma_yorleny.svg",
        "template_classic.svg",
        "template_modern.svg",
    }

    template = client.get("/api/templates/template_classic.svg")
    assert template.status_code == 200
    assert template.mimetype == "image/svg+xml"
    assert b"<svg" in template.data

    missing = client.get("/api/templates/does-not-exist.svg")
    assert missing.status_code == 404
    assert missing.get_json() == {"error": "not found"}


def test_analyze_accepts_an_uploaded_svg_and_returns_detected_fields(client):
    response = client.post(
        "/api/analyze",
        data={"file": (io.BytesIO(SIMPLE_SVG), "certificate.svg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    elements = response.get_json()["elements"]
    assert [element["id"] for element in elements] == ["recipient_name", "issue_date"]


def test_svg_routes_reject_active_content_before_transforming_or_rendering(
    client, backend_module, monkeypatch
):
    malicious = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'
    render_called = False

    def forbidden_render(*_args, **_kwargs):
        nonlocal render_called
        render_called = True
        raise AssertionError("unsafe SVG reached the renderer")

    monkeypatch.setattr(backend_module, "_svg_to_output", forbidden_render)

    for route in ("/api/analyze", "/api/preview", "/api/generate"):
        response = client.post(
            route,
            data={"file": (io.BytesIO(malicious), "malicious.svg")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400
        assert response.get_json() == {
            "error": "SVG inválido o no permitido",
            "code": "invalid_svg",
        }

    batch = client.post(
        "/api/generate/batch",
        data={
            "file": (io.BytesIO(malicious), "malicious.svg"),
            "csv_file": (io.BytesIO(b"Nombre\nAna\n"), "people.csv"),
        },
        content_type="multipart/form-data",
    )
    assert batch.status_code == 400
    assert batch.get_json()["code"] == "invalid_svg"
    assert render_called is False


def test_preview_fills_uploaded_svg_without_external_rendering(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "_embed_fonts", lambda svg: svg)

    response = client.post(
        "/api/preview",
        data={
            "file": (io.BytesIO(SIMPLE_SVG), "certificate.svg"),
            "recipient_name": "Ana Solís",
            "issue_date": "2026-08-12",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.mimetype == "image/svg+xml"
    assert "ANA SOLÍS" in response.get_data(as_text=True)
    assert "2026-08-12" in response.get_data(as_text=True)


def test_generate_falls_back_to_downloadable_svg_without_cairo(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "CAIRO_OK", False)

    response = client.post(
        "/api/generate",
        data={
            "file": (io.BytesIO(SIMPLE_SVG), "certificate.svg"),
            "recipient_name": "Ana Solís",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.mimetype == "image/svg+xml"
    assert response.headers["Content-Disposition"] == 'attachment; filename=certificado.svg'
    assert "ANA SOLÍS" in response.get_data(as_text=True)


def test_batch_generates_one_svg_per_csv_row_and_count_headers(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "CAIRO_OK", False)
    csv_data = "Nombre,Fecha\nAna Solís,2026-08-12\nLuis Mora,2026-08-13\n"

    response = client.post(
        "/api/generate/batch",
        data={
            "file": (io.BytesIO(SIMPLE_SVG), "certificate.svg"),
            "csv_file": (io.BytesIO(csv_data.encode("utf-8")), "people.csv"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.mimetype == "application/zip"
    assert response.headers["X-Generated-Count"] == "2"
    assert response.headers["X-Error-Count"] == "0"
    assert response.headers["X-Total-Count"] == "2"

    with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
        assert archive.namelist() == ["001_Ana Solís.svg", "002_Luis Mora.svg"]
        assert "ANA SOLÍS" in archive.read("001_Ana Solís.svg").decode("utf-8")


def test_error_contracts_are_json_and_do_not_call_external_services(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "AI_OK", False)
    monkeypatch.setattr(backend_module, "AI_CLIENT", None)

    analyze_response = client.post("/api/analyze")
    assert analyze_response.status_code == 400
    assert analyze_response.get_json() == {"error": "no SVG proporcionado"}

    ai_response = client.post("/api/ai/mapeo", json={"svg_elements": [{"id": "name"}]})
    assert ai_response.status_code == 503
    assert "IA no disponible" in ai_response.get_json()["error"]


def test_cedula_lookup_contract_uses_a_local_double(client, backend_module, monkeypatch):
    names = {"101010101": "ANA SOLÍS"}
    monkeypatch.setattr(backend_module, "_lookup_cedula", names.get)

    invalid = client.post("/api/cedulas/lookup", json={"cedulas": "101010101"})
    assert invalid.status_code == 400

    response = client.post(
        "/api/cedulas/lookup", json={"cedulas": ["101010101", "202020202"]}
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "results": [
            {"cedula": "101010101", "nombre": "ANA SOLÍS", "ok": True},
            {"cedula": "202020202", "nombre": None, "ok": False},
        ]
    }
