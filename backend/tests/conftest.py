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

    return module


@pytest.fixture()
def client(backend_module):
    backend_module.app.config.update(TESTING=True)
    with backend_module.app.test_client() as test_client:
        yield test_client
