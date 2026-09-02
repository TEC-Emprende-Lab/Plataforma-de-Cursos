from unittest.mock import patch

from runtime_fonts import ensure_runtime_fonts


def test_ensure_runtime_fonts_skips_fontconfig_in_test_env():
    with (
        patch("runtime_fonts._install_fonts") as check_fonts,
        patch("runtime_fonts._install_repo_fonts") as install_repo,
    ):
        ensure_runtime_fonts(app_env="test")

    check_fonts.assert_not_called()
    install_repo.assert_not_called()


def test_ensure_runtime_fonts_runs_installers_outside_test_env():
    with (
        patch("runtime_fonts._install_fonts") as check_fonts,
        patch("runtime_fonts._install_repo_fonts") as install_repo,
    ):
        ensure_runtime_fonts(app_env="production")

    check_fonts.assert_called_once_with()
    install_repo.assert_called_once_with()
