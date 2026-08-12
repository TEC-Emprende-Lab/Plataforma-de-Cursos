import io
import json
from urllib import error

import pytest

from template_storage import SupabaseTemplateStore, TemplateStorageError


class FakeResponse:
    def __init__(self, payload=None):
        self.payload = b"" if payload is None else json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.payload


def test_create_uploads_svg_then_inserts_metadata_without_exposing_key():
    calls = []

    def opener(req, timeout):
        calls.append((req, timeout))
        if req.full_url.endswith("?select=*"):
            body = json.loads(req.data)
            return FakeResponse([{"id": "saved", **body}])
        return FakeResponse()

    store = SupabaseTemplateStore("https://project.supabase.co", "service-secret", opener=opener)
    row = store.create("<svg />", "../unsafe name.svg", {"name": "Plantilla"})

    assert row["id"] == "saved"
    assert row["storage_path"].startswith("templates/")
    assert "unsafe_name.svg" in row["storage_path"]
    assert calls[0][0].get_method() == "POST"
    assert calls[0][0].data == b"<svg />"
    assert calls[0][0].get_header("Authorization") == "Bearer service-secret"


def test_create_rolls_back_object_when_metadata_insert_fails():
    methods = []

    def opener(req, timeout):
        assert timeout == 10
        methods.append(req.get_method())
        if "/rest/v1/" in req.full_url:
            raise error.URLError("db unavailable")
        return FakeResponse()

    store = SupabaseTemplateStore("https://project.supabase.co", "secret", opener=opener)
    with pytest.raises(TemplateStorageError):
        store.create("<svg />", "template.svg", {"name": "Plantilla"})

    assert methods == ["POST", "POST", "DELETE"]


def test_create_rolls_back_object_when_metadata_response_is_unexpected():
    methods = []

    def opener(req, timeout):
        assert timeout == 10
        methods.append(req.get_method())
        if "/rest/v1/" in req.full_url:
            return FakeResponse([])
        return FakeResponse()

    store = SupabaseTemplateStore("https://project.supabase.co", "secret", opener=opener)
    with pytest.raises(TemplateStorageError):
        store.create("<svg />", "template.svg", {"name": "Plantilla"})

    assert methods == ["POST", "POST", "DELETE"]


def test_delete_resolves_trusted_storage_path_before_removing():
    calls = []

    def opener(req, timeout):
        assert timeout == 10
        calls.append((req.get_method(), req.full_url))
        if req.get_method() == "GET":
            return FakeResponse([{"storage_path": "templates/safe.svg"}])
        return FakeResponse()

    store = SupabaseTemplateStore("https://project.supabase.co", "secret", opener=opener)
    store.delete("d9428888-122b-11e1-b85c-61cd3cbb3210")

    assert [method for method, _url in calls] == ["GET", "DELETE", "DELETE"]
    assert calls[1][1].endswith("/certificate-templates/templates/safe.svg")


def test_delete_rejects_non_uuid_without_network():
    store = SupabaseTemplateStore(
        "https://project.supabase.co",
        "secret",
        opener=lambda *_args: (_ for _ in ()).throw(AssertionError("network")),
    )
    with pytest.raises(TemplateStorageError):
        store.delete("../../other-object")
