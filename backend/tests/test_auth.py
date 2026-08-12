from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

try:
    from auth import (
        AuthConfig,
        AuthConfigurationError,
        AuthInvalidError,
        AuthRequiredError,
        SupabaseJWTVerifier,
        extract_bearer_token,
    )
except ModuleNotFoundError:  # Permite ejecutar pytest desde la raíz.
    from backend.auth import (
        AuthConfig,
        AuthConfigurationError,
        AuthInvalidError,
        AuthRequiredError,
        SupabaseJWTVerifier,
        extract_bearer_token,
    )


ISSUER = "https://project-ref.supabase.co/auth/v1"


@pytest.fixture(scope="module")
def signing_keys():
    private_key = ec.generate_private_key(ec.SECP256R1())
    other_private_key = ec.generate_private_key(ec.SECP256R1())
    return private_key, private_key.public_key(), other_private_key


@pytest.fixture()
def config():
    return AuthConfig.from_env(
        {
            "APP_ENV": "test",
            "SUPABASE_URL": "https://project-ref.supabase.co/",
        }
    )


def make_claims(**overrides):
    now = datetime.now(timezone.utc)
    claims = {
        "iss": ISSUER,
        "aud": "authenticated",
        "exp": now + timedelta(minutes=5),
        "sub": "user-123",
        "role": "authenticated",
    }
    claims.update(overrides)
    return claims


def encode(private_key, **claim_overrides):
    return jwt.encode(make_claims(**claim_overrides), private_key, algorithm="ES256")


def test_required_is_default_and_derives_supabase_urls():
    config = AuthConfig.from_env(
        {"APP_ENV": "production", "SUPABASE_URL": "https://example.supabase.co/"}
    )

    assert config.mode == "required"
    assert config.issuer == "https://example.supabase.co/auth/v1"
    assert config.jwks_url == (
        "https://example.supabase.co/auth/v1/.well-known/jwks.json"
    )


def test_required_mode_fails_closed_without_supabase_url():
    with pytest.raises(AuthConfigurationError):
        AuthConfig.from_env({"APP_ENV": "production"})


@pytest.mark.parametrize("app_env", ["development", "test"])
def test_disabled_mode_is_limited_to_non_production(app_env):
    config = AuthConfig.from_env({"AUTH_MODE": "disabled", "APP_ENV": app_env})
    identity = SupabaseJWTVerifier(config).verify_authorization(None)

    assert identity.disabled is True
    assert identity.subject is None


def test_disabled_mode_fails_closed_in_production():
    with pytest.raises(AuthConfigurationError):
        AuthConfig.from_env({"AUTH_MODE": "disabled", "APP_ENV": "production"})


@pytest.mark.parametrize("header", [None, "", "   "])
def test_missing_authorization_has_a_stable_typed_error(header):
    with pytest.raises(AuthRequiredError) as caught:
        extract_bearer_token(header)

    assert caught.value.code == "auth_required"
    assert "Bearer" not in str(caught.value)


@pytest.mark.parametrize(
    "header",
    ["token", "Basic abc", "Bearer", "Bearer one two", "Bearer abc\r\nInjected: x"],
)
def test_malformed_authorization_has_a_stable_typed_error(header):
    with pytest.raises(AuthInvalidError) as caught:
        extract_bearer_token(header)

    assert caught.value.code == "auth_invalid"
    assert header not in str(caught.value)


def test_valid_es256_token_returns_verified_identity(config, signing_keys):
    private_key, public_key, _ = signing_keys
    token = encode(private_key)
    verifier = SupabaseJWTVerifier(config, key_resolver=lambda _token: public_key)

    identity = verifier.verify_authorization(f"Bearer {token}")

    assert identity.subject == "user-123"
    assert identity.role == "authenticated"
    assert identity.claims["aud"] == "authenticated"
    assert identity.disabled is False


@pytest.mark.parametrize(
    "overrides",
    [
        {"iss": "https://attacker.example/auth/v1"},
        {"aud": "anon"},
        {"exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
        {"sub": ""},
        {"role": "service_role"},
    ],
)
def test_invalid_claims_are_rejected_without_leaking_token(
    config, signing_keys, overrides
):
    private_key, public_key, _ = signing_keys
    token = encode(private_key, **overrides)
    verifier = SupabaseJWTVerifier(config, key_resolver=lambda _token: public_key)

    with pytest.raises(AuthInvalidError) as caught:
        verifier.verify_authorization(f"Bearer {token}")

    assert caught.value.code == "auth_invalid"
    assert token not in str(caught.value)


def test_invalid_signature_is_rejected(config, signing_keys):
    _, public_key, other_private_key = signing_keys
    token = encode(other_private_key)
    verifier = SupabaseJWTVerifier(config, key_resolver=lambda _token: public_key)

    with pytest.raises(AuthInvalidError):
        verifier.verify_authorization(f"Bearer {token}")


@pytest.mark.parametrize("missing_claim", ["exp", "sub", "role"])
def test_required_claims_cannot_be_omitted(config, signing_keys, missing_claim):
    private_key, public_key, _ = signing_keys
    claims = make_claims()
    claims.pop(missing_claim)
    token = jwt.encode(claims, private_key, algorithm="ES256")
    verifier = SupabaseJWTVerifier(config, key_resolver=lambda _token: public_key)

    with pytest.raises(AuthInvalidError):
        verifier.verify_authorization(f"Bearer {token}")


def test_non_es256_algorithm_is_rejected(config):
    local_secret = "local-test-secret-that-is-at-least-32-bytes"
    token = jwt.encode(make_claims(), local_secret, algorithm="HS256")
    verifier = SupabaseJWTVerifier(
        config,
        key_resolver=lambda _token: local_secret,
    )

    with pytest.raises(AuthInvalidError):
        verifier.verify_authorization(f"Bearer {token}")


def test_key_resolution_is_injectable_and_receives_only_the_token(
    config, signing_keys
):
    private_key, public_key, _ = signing_keys
    token = encode(private_key)
    received = []

    def local_resolver(candidate):
        received.append(candidate)
        return public_key

    verifier = SupabaseJWTVerifier(config, key_resolver=local_resolver)
    verifier.verify_authorization(f"bearer {token}")

    assert received == [token]
