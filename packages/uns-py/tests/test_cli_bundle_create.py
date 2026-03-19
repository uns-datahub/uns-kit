from __future__ import annotations

import json
from pathlib import Path

from click.testing import CliRunner

from uns_kit.cli import cli


def test_create_from_valid_python_bundle(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    bundle_path = _write_bundle(
        tmp_path / "service.bundle.json",
        scaffold={"stack": "python", "template": "default", "features": ["vscode", "devops"]},
    )

    runner = CliRunner()
    result = runner.invoke(cli, ["create", "--bundle", str(bundle_path)])

    assert result.exit_code == 0, result.output
    target = tmp_path / "uns-example-service"
    assert (target / "service.bundle.json").exists()
    assert (target / "SERVICE_SPEC.md").exists()
    assert (target / "AGENTS.md").exists()
    assert (target / ".vscode" / "settings.json").exists()
    assert (target / "azure-pipelines.yml").exists()

    assert (target / "service.bundle.json").read_text() == bundle_path.read_text()
    assert "UNS Example Service" in (target / "SERVICE_SPEC.md").read_text()
    assert "bootstrapped from `service.bundle.json`" in (target / "AGENTS.md").read_text()
    assert "pnpm build" in (target / "AGENTS.md").read_text()

    config = json.loads((target / "config.json").read_text())
    assert config["devops"]["provider"] == "azure-devops"
    assert config["devops"]["organization"] == "sijit"
    assert config["devops"]["project"] == "industry40"


def test_create_rejects_invalid_bundle(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    bundle_path = _write_bundle(tmp_path / "service.bundle.json", schemaVersion=2)

    result = CliRunner().invoke(cli, ["create", "--bundle", str(bundle_path)])

    assert result.exit_code != 0
    assert "schemaVersion must be 1" in result.output


def test_create_rejects_wrong_stack_for_python_cli(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    bundle_path = _write_bundle(
        tmp_path / "service.bundle.json",
        scaffold={"stack": "ts", "template": "default", "features": []},
    )

    result = CliRunner().invoke(cli, ["create", "--bundle", str(bundle_path)])

    assert result.exit_code != 0
    assert 'Bundle scaffold.stack is "ts"' in result.output
    assert "uns-kit create --bundle <path>" in result.output


def test_create_supports_dest_for_bundle(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    bundle_path = _write_bundle(
        tmp_path / "service.bundle.json",
        scaffold={"stack": "python", "template": "default", "features": []},
    )

    target = tmp_path / "custom-target"
    result = CliRunner().invoke(cli, ["create", "--bundle", str(bundle_path), "--dest", str(target)])

    assert result.exit_code == 0, result.output
    assert (target / "service.bundle.json").exists()
    assert (target / "pyproject.toml").exists()


def test_create_requires_allow_existing_for_non_empty_destinations(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    bundle_path = _write_bundle(
        tmp_path / "service.bundle.json",
        scaffold={"stack": "python", "template": "default", "features": []},
    )

    target = tmp_path / "existing-target"
    target.mkdir(parents=True)
    (target / "keep.txt").write_text("keep\n")

    result = CliRunner().invoke(cli, ["create", "--bundle", str(bundle_path), "--dest", str(target)])

    assert result.exit_code != 0
    assert "Destination is not empty" in result.output


def test_create_allows_existing_when_flag_is_passed(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    bundle_path = _write_bundle(
        tmp_path / "service.bundle.json",
        scaffold={"stack": "python", "template": "default", "features": []},
    )

    target = tmp_path / "existing-target"
    target.mkdir(parents=True)
    (target / "keep.txt").write_text("keep\n")

    result = CliRunner().invoke(
        cli,
        ["create", "--bundle", str(bundle_path), "--dest", str(target), "--allow-existing"],
    )

    assert result.exit_code == 0, result.output
    assert (target / "keep.txt").read_text() == "keep\n"
    assert (target / "service.bundle.json").exists()


def test_legacy_create_name_still_works(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)

    result = CliRunner().invoke(cli, ["create", "legacy-app"])

    assert result.exit_code == 0, result.output
    assert (tmp_path / "legacy-app" / "pyproject.toml").exists()
    assert not (tmp_path / "legacy-app" / "service.bundle.json").exists()


def _write_bundle(path: Path, **overrides):
    bundle = {
        "schemaVersion": 1,
        "kind": "uns-service-bundle",
        "metadata": {
            "name": "uns-example-service",
            "displayName": "UNS Example Service",
            "serviceType": "microservice",
            "summary": "Short summary",
            "description": "Longer description",
            "owner": "team-name",
            "tags": ["tag1", "tag2"],
        },
        "scaffold": {
            "stack": "python",
            "template": "default",
            "features": ["vscode"],
        },
        "repository": {
            "provider": "azure-devops",
            "organization": "sijit",
            "project": "industry40",
            "repository": "uns-example-service",
            "defaultBranch": "master",
        },
        "domain": {
            "inputs": [],
            "outputs": [],
        },
        "docs": {
            "serviceSpec": {
                "goals": ["Goal 1"],
                "nonGoals": ["Non-goal 1"],
                "acceptanceCriteria": ["Criterion 1"],
            },
            "agents": {
                "projectContext": ["Context 1"],
                "guardrails": ["Guardrail 1"],
                "firstTasks": ["Task 1"],
                "verification": ["pnpm build"],
            },
        },
        "analytics": None,
        "provenance": {"origin": "manual"},
    }
    bundle.update(overrides)
    path.write_text(json.dumps(bundle, indent=2) + "\n")
    return path
