"""Supabase access-token verification for the certificate API.

The module is deliberately independent from Flask so its policy can be tested
without an application context and wired into routes incrementally.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from urllib.parse import urlparse

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError, PyJWTError


PUBLIC_AUTH_REQUIRED = "Se requiere una sesión válida."
PUBLIC_AUTH_INVALID = "La sesión no es válida o expiró."
PUBLIC_AUTH_UNAVAILABLE = "No se pudo validar la sesión."


class AuthError(Exception):
    """Base error with a stable public contract and no credential details."""

    code = "auth_error"
    status_code = 401
    public_message = PUBLIC_AUTH_INVALID

    def __init__(self) -> None:
        super().__init__(self.public_message)


class AuthRequiredError(AuthError):
    code = "auth_required"
    public_message = PUBLIC_AUTH_REQUIRED


class AuthInvalidError(AuthError):
    code = "auth_invalid"


class AuthUnavailableError(AuthError):
    code = "auth_unavailable"
    status_code = 503
    public_message = PUBLIC_AUTH_UNAVAILABLE


class AuthConfigurationError(AuthError):
    code = "auth_configuration_error"
    status_code = 500
    public_message = "La autenticación del servicio no está configurada."


@dataclass(frozen=True)
class AuthConfig:
    """Validated authentication policy derived from server environment."""

    mode: str
    app_env: str
    supabase_url: str | None
    issuer: str | None
    jwks_url: str | None
    audience: str = "authenticated"

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "AuthConfig":
        source = os.environ if environ is None else environ
        mode = source.get("AUTH_MODE", "required").strip().lower()
        app_env = source.get("APP_ENV", "production").strip().lower()

        if mode not in {"required", "disabled"}:
            raise AuthConfigurationError()
        if mode == "disabled":
            if app_env not in {"development", "test"}:
                raise AuthConfigurationError()
            return cls(
                mode=mode,
                app_env=app_env,
                supabase_url=None,
                issuer=None,
                jwks_url=None,
            )

        supabase_url = source.get("SUPABASE_URL", "").strip().rstrip("/")
        parsed = urlparse(supabase_url)
        if (
            not supabase_url
            or parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.query
            or parsed.fragment
        ):
            raise AuthConfigurationError()
        if app_env == "production" and parsed.scheme != "https":
            raise AuthConfigurationError()

        issuer = f"{supabase_url}/auth/v1"
        return cls(
            mode=mode,
            app_env=app_env,
            supabase_url=supabase_url,
            issuer=issuer,
            jwks_url=f"{issuer}/.well-known/jwks.json",
        )


@dataclass(frozen=True)
class AuthIdentity:
    """Verified caller information safe for route authorization decisions."""

    subject: str | None
    role: str
    claims: Mapping[str, Any]
    disabled: bool = False


def extract_bearer_token(authorization: str | None) -> str:
    """Extract one Bearer credential or raise a stable typed error."""

    if authorization is None or not authorization.strip():
        raise AuthRequiredError()
    if "\r" in authorization or "\n" in authorization:
        raise AuthInvalidError()

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise AuthInvalidError()
    return parts[1]


KeyResolver = Callable[[str], Any]
Decoder = Callable[..., Mapping[str, Any]]


class SupabaseJWTVerifier:
    """Verify Supabase ES256 access tokens against the project's public JWKS."""

    def __init__(
        self,
        config: AuthConfig | None = None,
        *,
        key_resolver: KeyResolver | None = None,
        decoder: Decoder | None = None,
    ) -> None:
        self.config = config or AuthConfig.from_env()
        self._decoder = decoder or jwt.decode
        self._jwk_client: PyJWKClient | None = None

        if self.config.mode == "required" and key_resolver is None:
            if not self.config.jwks_url:
                raise AuthConfigurationError()
            self._jwk_client = PyJWKClient(
                self.config.jwks_url,
                cache_keys=True,
                cache_jwk_set=True,
                lifespan=300,
                timeout=5,
            )
            key_resolver = self._resolve_jwks_key
        self._key_resolver = key_resolver

    def _resolve_jwks_key(self, token: str) -> Any:
        if self._jwk_client is None:
            raise AuthConfigurationError()
        return self._jwk_client.get_signing_key_from_jwt(token).key

    def verify_authorization(self, authorization: str | None) -> AuthIdentity:
        if self.config.mode == "disabled":
            return AuthIdentity(
                subject=None,
                role="authenticated",
                claims={},
                disabled=True,
            )

        token = extract_bearer_token(authorization)
        if self._key_resolver is None or self.config.issuer is None:
            raise AuthConfigurationError()

        try:
            key = self._key_resolver(token)
            claims = self._decoder(
                token,
                key,
                algorithms=["ES256"],
                audience=self.config.audience,
                issuer=self.config.issuer,
                options={"require": ["exp", "sub", "role"]},
            )
        except PyJWKClientConnectionError as exc:
            raise AuthUnavailableError() from exc
        except (PyJWKClientError, PyJWTError, TypeError, ValueError) as exc:
            raise AuthInvalidError() from exc

        subject = claims.get("sub")
        role = claims.get("role")
        if not isinstance(subject, str) or not subject.strip():
            raise AuthInvalidError()
        if role != "authenticated":
            raise AuthInvalidError()

        return AuthIdentity(subject=subject, role=role, claims=dict(claims))

