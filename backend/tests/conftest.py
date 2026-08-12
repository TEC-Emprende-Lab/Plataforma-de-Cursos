import importlib.util
import os
import subprocess
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
APP_PATH = BACKEND_DIR / "app.py"


@pytest.fixture(scope="session")
def backend_module():
    """Load app.py while blocking its optional runtime setup side effects."""
    module_name = "certificate_backend_app_for_tests"
    spec = importlib.util.spec_from_file_location(module_name, APP_PATH)
    module = importlib.util.module_from_spec(spec)

    safe_font_check = SimpleNamespace(stdout="outfit onest", returncode=0)
    fake_cairosvg = ModuleType("cairosvg")

    def forbid_rendering(*_args, **_kwargs):
        raise AssertionError("Cairo rendering must be replaced explicitly in tests")

    fake_cairosvg.svg2png = forbid_rendering
    fake_cairosvg.svg2pdf = forbid_rendering
    clean_environment = {
        "APP_ENV": "test",
        "AUTH_MODE": "disabled",
        "CORS_ALLOWED_ORIGINS": "http://localhost:5173",
        "RATELIMIT_STORAGE_URI": "memory://",
        "RATE_LIMIT_ANALYZE": "1000 per minute",
        "RATE_LIMIT_PREVIEW": "1000 per minute",
        "RATE_LIMIT_GENERATE": "1000 per minute",
        "RATE_LIMIT_BATCH": "1000 per minute",
        "RATE_LIMIT_AI": "1000 per minute",
        "RATE_LIMIT_CEDULAS": "1000 per minute",
        "ANTHROPIC_API_KEY": "",
        "OPENAI_API_KEY": "",
    }

    with (
        patch.dict(os.environ, clean_environment),
        patch.dict(sys.modules, {"cairosvg": fake_cairosvg}),
        patch.object(subprocess, "run", return_value=safe_font_check),
        patch("urllib.request.urlretrieve", side_effect=AssertionError("network access is forbidden in tests")),
        patch("urllib.request.urlopen", side_effect=AssertionError("network access is forbidden in tests")),
        patch("os.makedirs"),
        patch("shutil.copy2"),
    ):
        previous_bytecode_setting = sys.dont_write_bytecode
        sys.dont_write_bytecode = True
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(module_name, None)
            raise
        finally:
            sys.dont_write_bytecode = previous_bytecode_setting

    @module.app.route("/__test__/rate-limit", methods=["GET", "POST"])
    @module.limiter.limit("1 per minute")
    def _test_rate_limit():
        return {"ok": True}

    return module


@pytest.fixture()
def client(backend_module):
    backend_module.app.config.update(TESTING=True)
    with backend_module.app.test_client() as test_client:
        yield test_client
