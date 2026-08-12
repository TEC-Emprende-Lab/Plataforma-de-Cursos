"""Trusted Supabase persistence for validated certificate templates."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from urllib import error, parse, request


PUBLIC_STORAGE_ERROR = "No se pudo guardar la plantilla."
_SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")


class TemplateStorageError(RuntimeError):
    public_message = PUBLIC_STORAGE_ERROR
    code = "template_storage_failed"


class SupabaseTemplateStore:
    def __init__(self, supabase_url: str, service_role_key: str, *, opener=None):
        self.base_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self._opener = opener or request.urlopen

    def _call(self, path: str, *, method: str, body: bytes | None = None, headers=None):
        req = request.Request(
            f"{self.base_url}{path}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.service_role_key}",
                "apikey": self.service_role_key,
                **(headers or {}),
            },
        )
        try:
            with self._opener(req, timeout=10) as response:
                payload = response.read()
        except (error.HTTPError, error.URLError, TimeoutError, OSError) as exc:
            raise TemplateStorageError() from exc
        if not payload:
            return None
        try:
            return json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise TemplateStorageError() from exc

    def create(self, svg_text: str, filename: str, metadata: dict) -> dict:
        clean_name = _SAFE_FILENAME.sub("_", Path(filename).name)[:100] or "template.svg"
        storage_path = f"templates/{uuid.uuid4().hex}_{clean_name}"
        object_path = parse.quote(storage_path, safe="/")
        self._call(
            f"/storage/v1/object/certificate-templates/{object_path}",
            method="POST",
            body=svg_text.encode("utf-8"),
            headers={"Content-Type": "image/svg+xml", "x-upsert": "false"},
        )

        record = {**metadata, "storage_path": storage_path, "is_builtin": False}
        try:
            rows = self._call(
                "/rest/v1/svg_templates?select=*",
                method="POST",
                body=json.dumps(record, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
            )
        except TemplateStorageError:
            try:
                self._call(
                    f"/storage/v1/object/certificate-templates/{object_path}",
                    method="DELETE",
                )
            except TemplateStorageError:
                pass
            raise
        if not isinstance(rows, list) or len(rows) != 1:
            try:
                self._call(
                    f"/storage/v1/object/certificate-templates/{object_path}",
                    method="DELETE",
                )
            except TemplateStorageError:
                pass
            raise TemplateStorageError()
        return rows[0]

    def delete(self, template_id: str) -> None:
        try:
            normalized_id = str(uuid.UUID(template_id))
        except (ValueError, TypeError, AttributeError) as exc:
            raise TemplateStorageError() from exc

        rows = self._call(
            f"/rest/v1/svg_templates?id=eq.{normalized_id}&select=storage_path",
            method="GET",
        )
        if not isinstance(rows, list) or len(rows) != 1:
            raise TemplateStorageError()
        storage_path = rows[0].get("storage_path")
        if storage_path:
            object_path = parse.quote(storage_path, safe="/")
            self._call(
                f"/storage/v1/object/certificate-templates/{object_path}",
                method="DELETE",
            )
        self._call(
            f"/rest/v1/svg_templates?id=eq.{normalized_id}",
            method="DELETE",
            headers={"Prefer": "return=minimal"},
        )


__all__ = ["PUBLIC_STORAGE_ERROR", "SupabaseTemplateStore", "TemplateStorageError"]
