from __future__ import annotations

from uns_kit.cli import CLI_PROG_NAME, main, render_cli_help
from uns_kit.version import __version__


def test_render_cli_help_includes_version_and_bundle_create() -> None:
    help_text = render_cli_help()

    assert f"{CLI_PROG_NAME} v{__version__}" in help_text
    assert "create --bundle <path>" in help_text
    assert "help                    Show this message" in help_text


def test_main_prints_top_level_help(capsys) -> None:
    main([])

    output = capsys.readouterr().out
    assert f"{CLI_PROG_NAME} v{__version__}" in output
    assert "Usage: uns-kit-py <command> [options]" in output
    assert "create --bundle <path>" in output


def test_main_prints_version(capsys) -> None:
    main(["--version"])

    output = capsys.readouterr().out.strip()
    assert output == f"{CLI_PROG_NAME} v{__version__}"
