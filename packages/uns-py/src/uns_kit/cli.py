from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import shutil
import importlib.resources
from pathlib import Path
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

import click

from .topic_builder import TopicBuilder


def common_options(func):
    func = click.option("--host", required=True, help="MQTT host (hostname or host:port)")(func)
    func = click.option("--port", type=int, help="MQTT port override")(func)
    func = click.option("--username", help="MQTT username")(func)
    func = click.option("--password", help="MQTT password")(func)
    func = click.option("--tls/--no-tls", default=False, show_default=True, help="Enable TLS")(func)
    func = click.option("--client-id", help="MQTT clientId")(func)
    func = click.option("--package-name", default="uns-kit", show_default=True, help="Package name for infra topics")(func)
    func = click.option("--package-version", default="0.0.1", show_default=True, help="Package version for infra topics")(func)
    func = click.option("--process-name", default="uns-process", show_default=True, help="Process name for infra topics")(func)
    func = click.option("--reconnect-interval", default=1.0, show_default=True, type=float, help="Reconnect backoff start (s)")(func)
    return func


@click.group(help="Lightweight UNS MQTT helper (Python).")
def cli():
    pass


@cli.command("publish", help="Publish a UNS data packet to a topic.")
@common_options
@click.option("--topic", required=True, help="MQTT topic (e.g. raw/data/)")
@click.option("--value", required=False, help="Value to send (stringified if not JSON).")
@click.option("--uom", default=None, help="Unit of measure.")
@click.option("--json", "json_value", default=None, help="JSON string to use as value.")
@click.option("--qos", type=int, default=0, show_default=True)
@click.option("--retain/--no-retain", default=False, show_default=True)
def publish_cmd(**opts):
    asyncio.run(_run_publish(**opts))


async def _run_publish(
    host: str,
    port: Optional[int],
    username: Optional[str],
    password: Optional[str],
    tls: bool,
    client_id: Optional[str],
    package_name: str,
    package_version: str,
    process_name: str,
    reconnect_interval: float,
    topic: str,
    value: Optional[str],
    uom: Optional[str],
    json_value: Optional[str],
    qos: int,
    retain: bool,
):
    # Local import so non-MQTT commands (create/configure/pull-request) don't
    # import MQTT client libraries.
    from .client import UnsMqttClient
    from .packet import UnsPacket

    tb = TopicBuilder(package_name, package_version, process_name)
    client = UnsMqttClient(
        host=host.split(":")[0],
        port=int(host.split(":")[1]) if ":" in host and port is None else port,
        username=username,
        password=password,
        tls=tls,
        client_id=client_id,
        topic_builder=tb,
        reconnect_interval=reconnect_interval,
    )
    await client.connect()

    payload_obj = json.loads(json_value) if json_value is not None else value
    packet = UnsPacket.data(value=payload_obj, uom=uom)
    await client.publish_packet(topic, packet, qos=qos, retain=retain)
    await client.close()


@cli.command("subscribe", help="Subscribe to one or more topics (resilient).")
@common_options
@click.option("--topic", "topic_filter", required=True, help="Topic filter (e.g. uns-infra/#)")
def subscribe_cmd(**opts):
    asyncio.run(_run_subscribe(**opts))


async def _run_subscribe(
    host: str,
    port: Optional[int],
    username: Optional[str],
    password: Optional[str],
    tls: bool,
    client_id: Optional[str],
    package_name: str,
    package_version: str,
    process_name: str,
    reconnect_interval: float,
    topic_filter: str,
):
    # Local import so non-MQTT commands (create/configure/pull-request) don't
    # import MQTT client libraries.
    from .client import UnsMqttClient

    tb = TopicBuilder(package_name, package_version, process_name)
    client = UnsMqttClient(
        host=host.split(":")[0],
        port=int(host.split(":")[1]) if ":" in host and port is None else port,
        username=username,
        password=password,
        tls=tls,
        client_id=client_id,
        topic_builder=tb,
        reconnect_interval=reconnect_interval,
    )
    await client.connect()

    async for msg in client.resilient_messages(topic_filter):
        try:
            print(f"{msg.topic} {msg.payload.decode()}")
        except Exception:
            print(f"{msg.topic} <binary {len(msg.payload)} bytes>")


@cli.command("create", help="Create a new UNS Python app (default template).")
@click.argument("dest")
def create(dest: str):
    template_root = importlib.resources.files("uns_kit").joinpath("templates/default")
    dest_path = os.path.abspath(dest)
    project_name = Path(dest_path).name
    initial_app_version = "0.1.0"
    if os.path.exists(dest_path):
        raise click.ClickException(f"Destination already exists: {dest_path}")
    shutil.copytree(template_root, dest_path)
    pyproject_path = Path(dest_path) / "pyproject.toml"
    if pyproject_path.exists():
        try:
            initial_app_version = _read_poetry_version(pyproject_path)
        except Exception:
            pass
    # Personalize config.json with project identity (TS-style nested config).
    config_path = Path(dest_path) / "config.json"
    _write_config_file(config_path, project_name, initial_app_version)
    # Personalize pyproject.toml so pip/poetry builds succeed with a project-specific name/module.
    if pyproject_path.exists():
        try:
            _personalize_pyproject(pyproject_path, project_name)
        except Exception:
            pass
    # Personalize package.json for PM2 metadata (optional; controller also writes this for python RTT nodes).
    pkg_path = Path(dest_path) / "package.json"
    if pkg_path.exists():
        try:
            pkg_data = json.loads(pkg_path.read_text())
            pkg_data["name"] = project_name
            pkg_data["version"] = initial_app_version
            pkg_path.write_text(json.dumps(pkg_data, indent=2))
        except Exception:
            pass
    initialized_git = _init_git_repository(Path(dest_path))
    click.echo(f"Created UNS Python app at {dest_path}")
    click.echo("Next steps:")
    click.echo(f"  1) cd {dest_path}")
    click.echo("  2) poetry install")
    click.echo("  3) poetry run python main.py")
    click.echo("  4) Edit config.json with your MQTT host/credentials")
    if initialized_git:
        click.echo("  5) git status  # verify the new repository")


@cli.command("configure-devops", help="Add Azure DevOps settings and pipeline to a project.")
@click.argument("dest", required=False, default=".")
@click.option("--overwrite/--no-overwrite", default=False, show_default=True, help="Overwrite existing azure-pipelines.yml")
def configure_devops(dest: str, overwrite: bool):
    dest_path = Path(dest).resolve()
    config_path = dest_path / "config.json"
    _ensure_git_repo(dest_path)
    if not config_path.exists():
        click.echo(f"config.json not found at {config_path}, generating default.")
        _write_config_file(config_path)

    config = json.loads(config_path.read_text())
    org, project = _prompt_devops(config)
    config.setdefault("devops", {})
    config["devops"]["provider"] = "azure-devops"
    config["devops"]["organization"] = org
    config["devops"]["project"] = project
    config_path.write_text(json.dumps(config, indent=2))
    click.echo(f"Updated devops settings in {config_path}")

    if not _git_has_remote(dest_path, "origin"):
        token = (os.environ.get("AZURE_PAT") or "").strip()
        if not token:
            token = click.prompt(
                f"Azure DevOps PAT (create one at https://dev.azure.com/{org}/_usersSettings/tokens)",
                hide_input=True,
                type=str,
            ).strip()
        if len(token) < 10:
            raise click.ClickException("AZURE_PAT token looks too short.")

        repo_name = dest_path.name
        repo = _azure_ensure_repo(org, project, repo_name, token)
        remote_url = repo.get("remoteUrl") or f"https://{org}@dev.azure.com/{org}/{project}/_git/{repo_name}"
        _git(dest_path, ["remote", "add", "origin", remote_url])
        click.echo(f"Added git remote origin -> {remote_url}")

    # Mirror TS behavior: add package.json scripts (if package.json exists).
    pkg_path = dest_path / "package.json"
    if pkg_path.exists():
        try:
            pkg = json.loads(pkg_path.read_text())
            scripts = pkg.setdefault("scripts", {})
            if isinstance(scripts, dict):
                scripts.setdefault("configure-devops", "poetry run uns-kit-py configure-devops")
                scripts.setdefault("configure-vscode", "poetry run uns-kit-py configure-vscode")
                scripts.setdefault("write-config", "poetry run uns-kit-py write-config")
                scripts.setdefault("pull-request", "poetry run uns-kit-py pull-request")
            pkg_path.write_text(json.dumps(pkg, indent=2))
            click.echo(f"Updated scripts in {pkg_path}")
        except Exception:
            pass

    pipeline_template = importlib.resources.files("uns_kit").joinpath("templates/azure-pipelines.yml")
    pipeline_target = dest_path / "azure-pipelines.yml"
    if pipeline_target.exists() and not overwrite:
        click.echo("azure-pipelines.yml already exists (skipped). Use --overwrite to replace.")
    else:
        shutil.copyfile(pipeline_template, pipeline_target)
        click.echo(f"Wrote {pipeline_target}")

    click.echo("DevOps configuration complete. Next steps:")
    click.echo("  1) Commit config.json and azure-pipelines.yml")
    click.echo("  2) Set AZURE_PAT in your CI or local env for pipeline access")


def _prompt_devops(config: dict) -> Tuple[str, str]:
    default_org = (config.get("devops") or {}).get("organization") or os.environ.get("AZURE_ORG") or ""
    default_proj = (config.get("devops") or {}).get("project") or os.environ.get("AZURE_PROJECT") or ""
    org = click.prompt("Azure DevOps organization", default=default_org or None, type=str)
    project = click.prompt("Azure DevOps project", default=default_proj or None, type=str)
    return org.strip(), project.strip()


def _write_config_file(path: Path, project_name: Optional[str] = None, package_version: str = "0.1.0") -> None:
    project_name = project_name or path.resolve().parent.name
    sanitized = TopicBuilder.sanitize_topic_part(project_name)
    data = {
        "infra": {
            "host": "localhost",
            "port": 1883,
            "username": "",
            "password": "",
            "tls": False,
            "clientId": sanitized,
            "mqttSubToTopics": [],
            "keepalive": 60,
            "clean": True,
        },
        "uns": {
            "packageName": project_name,
            "packageVersion": package_version,
            "processName": sanitized,
        },
    }
    path.write_text(json.dumps(data, indent=2))


@cli.command("configure-vscode", help="Add VS Code settings for Python development.")
@click.argument("dest", required=False, default=".")
@click.option("--overwrite/--no-overwrite", default=False, show_default=True, help="Overwrite existing .vscode files")
def configure_vscode(dest: str, overwrite: bool):
    dest_path = Path(dest).resolve()
    vscode_dir = dest_path / ".vscode"
    vscode_dir.mkdir(parents=True, exist_ok=True)

    template_root = importlib.resources.files("uns_kit").joinpath("templates/vscode")
    for filename in ("settings.json", "launch.json", "extensions.json"):
        src = template_root / filename
        dst = vscode_dir / filename
        if dst.exists() and not overwrite:
            click.echo(f"{dst} already exists (skipped). Use --overwrite to replace.")
            continue
        shutil.copyfile(src, dst)
        click.echo(f"Wrote {dst}")

    # Also write a workspace file (mirrors TS behavior).
    _write_workspace_file(dest_path, overwrite)
    click.echo("VS Code configuration complete.")


@cli.command("configure-workspace", help="Create a VS Code workspace file for the project.")
@click.argument("dest", required=False, default=".")
@click.option("--overwrite/--no-overwrite", default=False, show_default=True, help="Overwrite existing workspace file")
def configure_workspace(dest: str, overwrite: bool):
    dest_path = Path(dest).resolve()
    _write_workspace_file(dest_path, overwrite)


def _write_workspace_file(dest_path: Path, overwrite: bool) -> None:
    project_name = dest_path.name
    workspace_file = dest_path / f"{project_name}.code-workspace"
    if workspace_file.exists() and not overwrite:
        click.echo(f"{workspace_file} already exists (skipped). Use --overwrite to replace.")
        return
    template = importlib.resources.files("uns_kit").joinpath("templates/workspace/workspace.json")
    shutil.copyfile(template, workspace_file)
    click.echo(f"Wrote {workspace_file}")

@cli.command("pull-request", help="Create an Azure DevOps pull request for a Python project (bumps version, commits, pushes, opens PR).")
@click.argument("dest", required=False, default=".")
@click.option("--target-branch", default=None, help="Override PR target branch (e.g. main). Defaults to Azure repo default branch.")
def pull_request(dest: str, target_branch: Optional[str]):
    dest_path = Path(dest).resolve()

    if not _git_has_remote(dest_path, "origin"):
        raise click.ClickException("Git remote origin is not configured. Run `uns-kit-py configure-devops` first.")

    # Require a git repo and clean tree (mirrors TS behavior).
    _assert_git_clean(dest_path)
    current_branch = _git_output(dest_path, ["rev-parse", "--abbrev-ref", "HEAD"]).strip()
    if not current_branch or current_branch == "HEAD":
        raise click.ClickException("Could not determine current branch. Ensure you are on a branch (not detached HEAD).")
    base_commit = _git_output(dest_path, ["rev-parse", "HEAD"]).strip()
    if not base_commit:
        raise click.ClickException("Could not determine current commit. Ensure the repository has at least one commit.")

    config = _load_json(dest_path / "config.json")
    devops = (config.get("devops") if isinstance(config, dict) else {}) or {}
    org = (devops.get("organization") or "").strip()
    project = (devops.get("project") or "").strip()
    if not org or not project:
        raise click.ClickException("Missing devops.organization/devops.project in config.json. Run `uns-kit-py configure-devops` first.")

    token = (os.environ.get("AZURE_PAT") or "").strip()
    if not token:
        token = click.prompt(
            f"Azure DevOps PAT (create one at https://dev.azure.com/{org}/_usersSettings/tokens)",
            hide_input=True,
            type=str,
        ).strip()
    if len(token) < 10:
        raise click.ClickException("AZURE_PAT token looks too short.")

    repo_name = _infer_repo_name(dest_path)
    repo = _azure_get_repo(org, project, repo_name, token)
    repo_id = str(repo.get("id") or "").strip()
    if not repo_id:
        raise click.ClickException("Azure repository id missing; cannot create PR.")

    repo_default_branch_ref = (repo.get("defaultBranch") or "").strip()
    repo_default_branch_name = repo_default_branch_ref.replace("refs/heads/", "") if repo_default_branch_ref else ""
    if repo_default_branch_name and current_branch == repo_default_branch_name:
        raise click.ClickException(f"Refusing to create PR from default branch ({repo_default_branch_name}). Create a feature branch first.")

    explicit_target = bool(target_branch and target_branch.strip())
    if target_branch:
        target_ref = f"refs/heads/{target_branch.strip()}"
    else:
        target_ref = repo_default_branch_ref or "refs/heads/master"

    branches = _azure_list_refs(org, project, repo_id, token, "heads/")
    # If the default branch is missing on the remote, prefer an existing main/master, otherwise create it.
    if target_ref not in branches:
        if not explicit_target:
            if "refs/heads/main" in branches:
                target_ref = "refs/heads/main"
            elif "refs/heads/master" in branches:
                target_ref = "refs/heads/master"

    if target_ref not in branches:
        # New repo edge-case: Azure may have defaultBranch=master but no master branch exists yet because
        # the first push was a feature branch. Create the target branch at the current HEAD (before bumping
        # version) so the PR has a meaningful diff.
        branch_name = target_ref.replace("refs/heads/", "")
        click.echo(f"Remote target branch {target_ref} does not exist; creating/pushing it...")
        existing = _git_output(dest_path, ["branch", "--list", branch_name]).strip()
        if not existing:
            _git(dest_path, ["branch", branch_name, base_commit])
        _git(dest_path, ["push", "-u", "origin", branch_name], token=token)
        branches = _azure_list_refs(org, project, repo_id, token, "heads/")
        if target_ref not in branches:
            raise click.ClickException(f"Failed to create remote branch {target_ref}.")

    target_branch_name = target_ref.replace("refs/heads/", "")
    if target_branch_name and current_branch == target_branch_name:
        raise click.ClickException(f"Refusing to create PR from target branch ({target_branch_name}). Create a feature branch first.")

    pyproject_path = dest_path / "pyproject.toml"
    current_version = _read_poetry_version(pyproject_path)
    new_version = click.prompt("Version tag for this PR", default=current_version, type=str).strip()
    if not new_version:
        raise click.ClickException("Version is required.")
    _assert_version_tag_unique(org, project, repo_id, token, new_version)

    _write_poetry_version(pyproject_path, new_version)
    _git(dest_path, ["add", "pyproject.toml"])
    _git(dest_path, ["commit", "-m", f"Set new production version: {new_version}"])
    _git(dest_path, ["push", "origin", current_branch], token=token)

    title = click.prompt("Title for the pull request", type=str).strip()
    description = click.prompt("Description for the pull request", default="", type=str)

    pr = _azure_create_pr(
        org=org,
        project=project,
        repo_id=repo_id,
        token=token,
        source_branch=current_branch,
        target_ref=target_ref,
        title=title,
        description=description,
        label=new_version,
    )
    pr_id = pr.get("pullRequestId")
    pr_url = f"https://dev.azure.com/{org}/{project}/_git/{repo_name}/pullrequest/{pr_id}" if pr_id else pr.get("url")
    click.echo(f"Pull request created: {pr_url}")


def _load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise click.ClickException(f"Missing {path}.")
    try:
        data = json.loads(path.read_text())
        if not isinstance(data, dict):
            raise ValueError("not a JSON object")
        return data
    except Exception as exc:
        raise click.ClickException(f"Failed to read {path}: {exc}")

def _init_git_repository(target_dir: Path) -> bool:
    """
    Initialize a git repository in target_dir if it's not already inside a work tree.
    Mirrors the TS CLI behavior: don't create nested repos when inside an existing git repo.
    """
    try:
        inside = _git_output(target_dir, ["rev-parse", "--is-inside-work-tree"]).strip()
        if inside == "true":
            return False
    except click.ClickException as exc:
        # If git is available but target_dir is not a repo, rev-parse prints "not a git repository".
        # In that case we proceed with git init. For other errors, fail soft.
        msg = str(exc)
        if "not a git repository" not in msg.lower():
            return False

    try:
        _git_output(target_dir, ["init"])
        click.echo("Initialized empty Git repository.")
        return True
    except click.ClickException:
        return False


def _git_auth_header(token: str) -> str:
    encoded = base64.b64encode(f":{token}".encode("utf-8")).decode("ascii")
    return f"Authorization: Basic {encoded}"


def _git(cwd: Path, args: list[str], *, token: Optional[str] = None) -> None:
    _git_output(cwd, args, token=token)


def _git_output(cwd: Path, args: list[str], *, token: Optional[str] = None) -> str:
    try:
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = env.get("GIT_TERMINAL_PROMPT", "0")
        cmd: list[str] = ["git"]
        if token:
            cmd.extend(["-c", f"http.extraheader={_git_auth_header(token)}"])
        cmd.extend(args)
        out = subprocess.check_output(cmd, cwd=str(cwd), stderr=subprocess.STDOUT, env=env)
        return out.decode("utf-8", errors="replace")
    except FileNotFoundError:
        raise click.ClickException("Git is not installed or not available on PATH.")
    except subprocess.CalledProcessError as exc:
        message = exc.output.decode("utf-8", errors="replace") if exc.output else str(exc)
        raise click.ClickException(f"Git command failed in {cwd}: {message.strip()}")


def _assert_git_clean(cwd: Path) -> None:
    status = _git_output(cwd, ["status", "--porcelain"]).strip()
    if status:
        raise click.ClickException("Repository needs to be clean. Please commit or stash changes before creating a PR.")


def _infer_repo_name(cwd: Path) -> str:
    # Prefer parsing origin remote; fallback to folder name.
    try:
        remote = _git_output(cwd, ["remote", "get-url", "origin"]).strip()
    except Exception:
        remote = ""

    if remote:
        # https://dev.azure.com/org/project/_git/repo
        m = re.search(r"/_git/([^/]+?)(?:\.git)?$", remote)
        if m:
            return m.group(1)
        # git@ssh.dev.azure.com:v3/org/project/repo
        m = re.search(r":v3/[^/]+/[^/]+/([^/]+?)(?:\.git)?$", remote)
        if m:
            return m.group(1)
        # fallback last path segment
        tail = remote.rstrip("/").split("/")[-1]
        if tail:
            return tail.replace(".git", "")

    return cwd.name


def _read_poetry_version(pyproject_path: Path) -> str:
    text = pyproject_path.read_text()
    in_section = False
    for line in text.splitlines():
        if line.strip() == "[tool.poetry]":
            in_section = True
            continue
        if in_section and line.startswith("[") and line.strip().endswith("]"):
            break
        if in_section:
            m = re.match(r'^version\s*=\s*"([^"]+)"', line.strip())
            if m:
                return m.group(1)
    raise click.ClickException(f"Could not find tool.poetry version in {pyproject_path}")


def _write_poetry_version(pyproject_path: Path, new_version: str) -> None:
    lines = pyproject_path.read_text().splitlines()
    out: list[str] = []
    in_section = False
    changed = False
    for line in lines:
        if line.strip() == "[tool.poetry]":
            in_section = True
            out.append(line)
            continue
        if in_section and line.startswith("[") and line.strip().endswith("]"):
            in_section = False
        if in_section and not changed and re.match(r"^version\s*=", line.strip()):
            out.append(f'version = "{new_version}"')
            changed = True
        else:
            out.append(line)
    if not changed:
        raise click.ClickException(f"Could not update version in {pyproject_path} (tool.poetry section missing?)")
    pyproject_path.write_text("\n".join(out) + "\n")


def _assert_version_tag_unique(org: str, project: str, repo_id: str, token: str, version: str) -> None:
    tags = _azure_list_refs(org, project, repo_id, token, "tags/")
    if f"refs/tags/{version}" in tags:
        raise click.ClickException(f"Version tag {version} already exists on the remote. Choose another version.")


def _azure_list_refs(org: str, project: str, repo_id: str, token: str, ref_filter: str) -> list[str]:
    filter_q = urllib.parse.quote(ref_filter, safe="/")
    url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo_id}/refs?filter={filter_q}&api-version=7.1-preview.1"
    data = _azure_request("GET", url, token)
    value = data.get("value", [])
    refs: list[str] = []
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                name = item.get("name")
                if isinstance(name, str):
                    refs.append(name)
    return refs


def _azure_request(method: str, url: str, token: str, data: Optional[dict] = None) -> dict:
    raw = None if data is None else json.dumps(data).encode("utf-8")
    # Azure DevOps PAT auth is HTTP Basic with PAT as the password.
    # Some environments behave better with a non-empty username.
    auth = base64.b64encode(f"pat:{token}".encode("utf-8")).decode("ascii")
    req = urllib.request.Request(url, data=raw, method=method)
    req.add_header("Authorization", f"Basic {auth}")
    req.add_header("Accept", "application/json")
    if raw is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            body_bytes = resp.read()
            body = body_bytes.decode("utf-8", errors="replace")
            if not body:
                return {}
            try:
                return json.loads(body)
            except json.JSONDecodeError:
                content_type = resp.headers.get("Content-Type", "")
                snippet = body[:500]
                raise click.ClickException(
                    "Azure DevOps API returned a non-JSON response "
                    f"(status {getattr(resp, 'status', '?')}, content-type {content_type}). "
                    "This usually means the PAT is invalid/expired or lacks permissions.\n"
                    f"URL: {url}\n"
                    f"Response (first 500 chars): {snippet}",
                )
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
        raise click.ClickException(f"Azure DevOps API error {e.code}: {body}")
    except urllib.error.URLError as e:
        raise click.ClickException(f"Azure DevOps API request failed: {e.reason}")


def _azure_get_repo(org: str, project: str, repo_name: str, token: str) -> dict:
    url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo_name}?api-version=7.1-preview.1"
    return _azure_request("GET", url, token)


def _azure_ensure_repo(org: str, project: str, repo_name: str, token: str) -> dict:
    try:
        return _azure_get_repo(org, project, repo_name, token)
    except click.ClickException:
        # create if not found
        url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories?api-version=7.1-preview.1"
        payload = {"name": repo_name}
        return _azure_request("POST", url, token, payload)


def _azure_create_pr(
    *,
    org: str,
    project: str,
    repo_id: str,
    token: str,
    source_branch: str,
    target_ref: str,
    title: str,
    description: str,
    label: str,
) -> dict:
    if not repo_id:
        raise click.ClickException("Azure repository id missing; cannot create PR.")
    url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo_id}/pullrequests?api-version=7.1-preview.1"
    payload = {
        "sourceRefName": f"refs/heads/{source_branch}",
        "targetRefName": target_ref,
        "title": title,
        "description": description,
        "labels": [{"name": label}],
    }
    return _azure_request("POST", url, token, payload)


def _ensure_git_repo(dest_path: Path) -> None:
    _init_git_repository(dest_path)


def _git_has_remote(dest_path: Path, name: str) -> bool:
    try:
        _git_output(dest_path, ["remote", "get-url", name])
        return True
    except click.ClickException:
        return False


def _to_distribution_name(name: str) -> str:
    # PyPI distribution name: keep it readable and normalized.
    value = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-").lower()
    value = re.sub(r"-{2,}", "-", value)
    return value or "uns-py-app"


def _to_module_name(name: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_]+", "_", name).strip("_").lower()
    value = re.sub(r"_{2,}", "_", value)
    if not value:
        value = "uns_py_app"
    if value[0].isdigit():
        value = f"app_{value}"
    return value


def _personalize_pyproject(pyproject_path: Path, project_name: str) -> None:
    dist_name = _to_distribution_name(project_name)
    module_name = _to_module_name(project_name)

    text = pyproject_path.read_text()
    text = re.sub(r'(?m)^name\s*=\s*"[^"]+"\s*$', f'name = "{dist_name}"', text)
    text = re.sub(
        r'(?m)^packages\s*=\s*\[\s*\{\s*include\s*=\s*"[^"]+"\s*\}\s*\]\s*$',
        f'packages = [{{ include = "{module_name}" }}]',
        text,
    )
    pyproject_path.write_text(text)

    # Rename the placeholder package folder to match the configured include (if present).
    pkg_dir = pyproject_path.parent / "uns_py_app"
    target_dir = pyproject_path.parent / module_name
    if pkg_dir.exists() and module_name != "uns_py_app" and not target_dir.exists():
        pkg_dir.rename(target_dir)


def main():
    cli()


if __name__ == "__main__":
    main()
