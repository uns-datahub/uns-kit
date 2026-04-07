from __future__ import annotations

from pathlib import Path

from click.testing import CliRunner

from uns_kit.cli import cli


def test_configure_api_adds_template_and_extra(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    runner = CliRunner()

    create_result = runner.invoke(cli, ["create", "feature-app"])
    assert create_result.exit_code == 0, create_result.output

    result = runner.invoke(cli, ["configure-api", str(tmp_path / "feature-app")])

    assert result.exit_code == 0, result.output
    pyproject_text = (tmp_path / "feature-app" / "pyproject.toml").read_text()
    assert 'uns-kit = { version = "*", extras = ["api"] }' in pyproject_text
    assert (tmp_path / "feature-app" / "src" / "api_example.py").exists()


def test_configure_cron_merges_extras_without_overwriting_existing_ones(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    runner = CliRunner()

    create_result = runner.invoke(cli, ["create", "feature-app"])
    assert create_result.exit_code == 0, create_result.output

    api_result = runner.invoke(cli, ["configure-api", str(tmp_path / "feature-app")])
    assert api_result.exit_code == 0, api_result.output

    cron_result = runner.invoke(cli, ["configure-cron", str(tmp_path / "feature-app")])

    assert cron_result.exit_code == 0, cron_result.output
    pyproject_text = (tmp_path / "feature-app" / "pyproject.toml").read_text()
    assert 'uns-kit = { version = "*", extras = ["api", "cron"] }' in pyproject_text
    assert (tmp_path / "feature-app" / "src" / "cron_example.py").exists()


def test_configure_api_preserves_local_path_dependency_shape(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    runner = CliRunner()

    create_result = runner.invoke(cli, ["create", "feature-app"])
    assert create_result.exit_code == 0, create_result.output

    pyproject_path = tmp_path / "feature-app" / "pyproject.toml"
    pyproject_path.write_text(
        pyproject_path.read_text().replace(
            'uns-kit = "*"',
            'uns-kit = { path = "../packages/uns-py", develop = true }',
        )
    )

    result = runner.invoke(cli, ["configure-api", str(tmp_path / "feature-app")])

    assert result.exit_code == 0, result.output
    pyproject_text = pyproject_path.read_text()
    assert 'uns-kit = { path = "../packages/uns-py", develop = true, extras = ["api"] }' in pyproject_text
