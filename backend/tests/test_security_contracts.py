import io
import zipfile
from types import SimpleNamespace

from auth import AuthRequiredError
from auth import AuthIdentity


SIMPLE_SVG = b"""<svg xmlns="http://www.w3.org/2000/svg">
<text id="recipient_name">Nombre</text>
</svg>"""


def _svg_form(**extra):
    return {
        "file": (io.BytesIO(SIMPLE_SVG), "certificate.svg"),
        **extra,
    }


def test_post_routes_require_a_session_when_auth_is_enabled(
    client, backend_module, monkeypatch
):
    verifier = SimpleNamespace(
        verify_authorization=lambda _header: (_ for _ in ()).throw(AuthRequiredError())
    )
    monkeypatch.setattr(backend_module, "AUTH_VERIFIER", verifier)

    response = client.post("/api/analyze")

    assert response.status_code == 401
    assert response.get_json() == {
        "error": "Se requiere una sesión válida.",
        "code": "auth_required",
    }


def test_options_preflight_does_not_require_a_session(client, backend_module, monkeypatch):
    def fail_if_called(_header):
        raise AssertionError("preflight must not verify a token")

    monkeypatch.setattr(
        backend_module.AUTH_VERIFIER, "verify_authorization", fail_if_called
    )

    response = client.options(
        "/api/generate",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "Authorization" in response.headers["Access-Control-Allow-Headers"]


def test_cors_is_exact_and_security_headers_are_present(client):
    allowed = client.get(
        "/api/health", headers={"Origin": "http://localhost:5173"}
    )
    rejected = client.get(
        "/api/health", headers={"Origin": "https://attacker.example"}
    )

    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "Access-Control-Allow-Origin" not in rejected.headers
    assert allowed.headers["X-Content-Type-Options"] == "nosniff"
    assert allowed.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in allowed.headers["Content-Security-Policy"]
    assert len(allowed.headers["X-Request-ID"]) == 32


def test_global_request_size_limit_returns_stable_json(
    client, backend_module, monkeypatch
):
    monkeypatch.setitem(backend_module.app.config, "MAX_CONTENT_LENGTH", 100)

    response = client.post(
        "/api/analyze",
        data={"file": (io.BytesIO(SIMPLE_SVG * 10), "large.svg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 413
    assert response.get_json()["code"] == "request_too_large"


def test_generation_rejects_unknown_formats(client):
    response = client.post(
        "/api/generate",
        data=_svg_form(format="exe"),
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json()["code"] == "invalid_format"


def test_template_upload_validates_before_trusted_storage(
    client, backend_module, monkeypatch
):
    stored = []
    store = SimpleNamespace(
        create=lambda svg, filename, metadata: stored.append((svg, filename, metadata))
        or {"id": "saved-template", **metadata, "storage_path": "templates/safe.svg"}
    )
    monkeypatch.setattr(backend_module, "TEMPLATE_STORE", store)

    malicious = client.post(
        "/api/templates/upload",
        data={"file": (io.BytesIO(b"<svg><script>x</script></svg>"), "bad.svg")},
        content_type="multipart/form-data",
    )
    valid = client.post(
        "/api/templates/upload",
        data={
            "file": (io.BytesIO(SIMPLE_SVG), "safe.svg"),
            "name": "Plantilla segura",
            "tags": '["curso"]',
        },
        content_type="multipart/form-data",
    )

    assert malicious.status_code == 400
    assert malicious.get_json()["code"] == "invalid_svg"
    assert valid.status_code == 201
    assert valid.get_json()["template"]["id"] == "saved-template"
    assert len(stored) == 1
    assert stored[0][0] == SIMPLE_SVG.decode()


def test_template_delete_resolves_id_through_trusted_store(
    client, backend_module, monkeypatch
):
    deleted = []
    monkeypatch.setattr(
        backend_module,
        "TEMPLATE_STORE",
        SimpleNamespace(delete=lambda template_id: deleted.append(template_id)),
    )

    response = client.post(
        "/api/templates/delete",
        json={"id": "d9428888-122b-11e1-b85c-61cd3cbb3210"},
    )

    assert response.status_code == 200
    assert response.get_json() == {"deleted": True}
    assert deleted == ["d9428888-122b-11e1-b85c-61cd3cbb3210"]


def test_batch_rejects_more_than_configured_rows(client, backend_module, monkeypatch):
    monkeypatch.setattr(backend_module, "MAX_BATCH_ROWS", 2)
    response = client.post(
        "/api/generate/batch",
        data=_svg_form(csv_data="Nombre\nAna\nLuis\nEva\n"),
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json()["code"] == "too_many_rows"


def test_batch_rejects_oversized_csv(client, backend_module, monkeypatch):
    monkeypatch.setattr(backend_module, "MAX_CSV_BYTES", 10)
    response = client.post(
        "/api/generate/batch",
        data=_svg_form(csv_data="Nombre\nNombre demasiado largo\n"),
        content_type="multipart/form-data",
    )

    assert response.status_code == 413
    assert response.get_json()["code"] == "csv_too_large"


def test_cedula_lookup_rejects_instead_of_silently_truncating(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "MAX_CEDULAS", 2)
    monkeypatch.setattr(
        backend_module,
        "_lookup_cedula",
        lambda _cedula: (_ for _ in ()).throw(AssertionError("must not call external API")),
    )

    response = client.post(
        "/api/cedulas/lookup", json={"cedulas": ["1", "2", "3"]}
    )

    assert response.status_code == 400
    assert response.get_json()["code"] == "too_many_cedulas"


def test_generation_error_does_not_expose_internal_exception(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "CAIRO_OK", True)
    monkeypatch.setattr(
        backend_module,
        "_svg_to_output",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("SECRET filesystem path")),
    )

    response = client.post(
        "/api/generate",
        data=_svg_form(format="pdf"),
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    assert response.get_json()["code"] == "generation_failed"
    assert "SECRET" not in response.get_data(as_text=True)


def test_batch_error_file_does_not_expose_fields_or_exception(
    client, backend_module, monkeypatch
):
    monkeypatch.setattr(backend_module, "CAIRO_OK", True)
    monkeypatch.setattr(
        backend_module,
        "_svg_to_output",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("SECRET renderer")),
    )
    response = client.post(
        "/api/generate/batch",
        data=_svg_form(csv_data="Nombre,Privado\nAna,dato-personal\n"),
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
        error_text = archive.read(archive.namelist()[0]).decode("utf-8")
    assert error_text == "No se pudo generar este certificado."
    assert "SECRET" not in error_text
    assert "dato-personal" not in error_text


def test_rate_limit_returns_stable_json(client):
    first = client.get("/__test__/rate-limit")
    second = client.get("/__test__/rate-limit")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.get_json()["code"] == "rate_limit_exceeded"


def test_rate_limits_are_isolated_by_authenticated_user(
    client, backend_module, monkeypatch
):
    def identity_for(header):
        if not header:
            raise AuthRequiredError()
        subject = header.removeprefix("Bearer ")
        return AuthIdentity(subject=subject, role="authenticated", claims={})

    monkeypatch.setattr(
        backend_module.AUTH_VERIFIER, "verify_authorization", identity_for
    )

    first_a = client.post(
        "/__test__/rate-limit", headers={"Authorization": "Bearer user-a"}
    )
    limited_a = client.post(
        "/__test__/rate-limit", headers={"Authorization": "Bearer user-a"}
    )
    first_b = client.post(
        "/__test__/rate-limit", headers={"Authorization": "Bearer user-b"}
    )
    anonymous = [client.post("/__test__/rate-limit") for _ in range(2)]

    assert first_a.status_code == 200
    assert limited_a.status_code == 429
    assert first_b.status_code == 200
    assert [response.status_code for response in anonymous] == [401, 401]
