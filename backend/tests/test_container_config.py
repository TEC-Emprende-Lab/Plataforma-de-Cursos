import runpy
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_dockerfile_runs_non_root_with_local_fonts_and_gunicorn():
    dockerfile = (BACKEND_DIR / "Dockerfile").read_text(encoding="utf-8")
    lowered = dockerfile.lower()

    assert "from python:3.11.15-slim-bookworm" in lowered
    assert "user app" in lowered
    assert "copy fonts/ /usr/local/share/fonts/custom/" in lowered
    assert "copy --chown=app:app . ./" not in lowered
    assert "wget" not in lowered
    assert "raw.githubusercontent.com" not in lowered
    assert 'cmd ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]' in lowered
    assert 'cmd ["python", "app.py"]' not in lowered


def test_docker_context_excludes_local_and_test_artifacts():
    ignored = (BACKEND_DIR / ".dockerignore").read_text(encoding="utf-8").splitlines()

    assert "__pycache__/" in ignored
    assert ".venv/" in ignored
    assert ".env" in ignored
    assert "tests/" in ignored


def test_runtime_security_dependencies_remain_exactly_declared():
    requirements = (BACKEND_DIR / "requirements.txt").read_text(encoding="utf-8")

    for requirement in (
        "Flask-Limiter==4.1.1",
        "redis==8.1.0",
        "gunicorn==26.0.0",
        "defusedxml==0.7.1",
        "tinycss2==1.5.1",
        "PyJWT[crypto]==2.13.0",
    ):
        assert requirement in requirements.splitlines()


def test_gunicorn_configuration_reads_bounded_environment(monkeypatch):
    monkeypatch.setenv("PORT", "8080")
    monkeypatch.setenv("GUNICORN_WORKERS", "3")
    monkeypatch.setenv("GUNICORN_THREADS", "4")
    monkeypatch.setenv("GUNICORN_TIMEOUT", "240")
    monkeypatch.setenv("GUNICORN_MAX_REQUESTS", "0")

    config = runpy.run_path(str(BACKEND_DIR / "gunicorn.conf.py"))

    assert config["bind"] == "0.0.0.0:8080"
    assert config["workers"] == 3
    assert config["threads"] == 4
    assert config["worker_class"] == "gthread"
    assert config["timeout"] == 240
    assert config["max_requests"] == 0
