"""Errores de negocio con mensaje y código públicos estables."""

from __future__ import annotations


class ServiceError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status: int = 400,
        code: str | None = None,
        extra: dict | None = None,
    ):
        super().__init__(message)
        self.public_message = message
        self.status = status
        self.code = code
        self.extra = extra or {}
