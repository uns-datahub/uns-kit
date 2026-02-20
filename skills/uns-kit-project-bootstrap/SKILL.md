---
name: uns-kit-project-bootstrap
description: Scaffold and configure new UNS projects with uns-kit CLIs for TypeScript (`@uns-kit/cli`) and Python (`uns-kit-py`). Use when a user asks to initialize/bootstrap a new UNS app, apply CLI configure features/templates, refresh scaffolding with overwrite, or prepare a project so Codex can start implementing business logic.
---

# UNS Kit Project Bootstrap

## Overview

Create new `uns-kit` projects and bring them to a ready-to-code baseline using the official CLI flow:
1) create project, 2) configure project, 3) verify generated structure, 4) hand off to implementation tasks.

Read `references/command-matrix.md` when selecting commands or feature sets.

## Gather Inputs

Collect these inputs before executing commands:
- Stack: `ts` or `python`
- Project name
- Destination directory
- Configure profile: `minimal`, `standard`, or `custom`
- Optional extras: `api`, `cron`, `python` bridge (TS projects), `devops`

If stack is not explicit:
- Infer `ts` when user mentions npm/pnpm/Node.
- Infer `python` when user mentions poetry/pip/Python-only runtime.
- Ask one concise clarifying question only when signals are mixed.

## Bootstrap TypeScript Projects

Execute scaffold:
```bash
pnpm --package=@uns-kit/cli dlx uns-kit create <project_name>
```

Configure from project root (or pass path):
- Minimal:
```bash
uns-kit configure . vscode
```
- Standard:
```bash
uns-kit configure . vscode codegen uns-reference
```
- Add API plugin:
```bash
uns-kit configure . api
```
- Add cron plugin:
```bash
uns-kit configure . cron
```
- Add Python gateway template:
```bash
uns-kit configure . python
```

Only run when explicitly requested:
- `uns-kit configure . devops`
- `uns-kit configure . temporal` (treat as optional/legacy)

Finalize:
```bash
pnpm install
```

## Bootstrap Python Projects

Execute scaffold:
```bash
uns-kit-py create <project_name>
```

From project root:
```bash
poetry install
```

Apply configuration commands individually:
```bash
poetry run uns-kit-py configure-vscode .
poetry run uns-kit-py configure-workspace .
```

Only run when explicitly requested (interactive/Azure-specific):
```bash
poetry run uns-kit-py configure-devops .
```

## Verify Ready State

Verify generated files after bootstrap.

TypeScript expected:
- `package.json`
- `config.json`
- `src/index.ts`
- Optional based on features: `codegen.ts`, `uns-dictionary.json`, `uns-measurements.json`, `python/`

Python expected:
- `pyproject.toml`
- `config.json`
- `main.py`
- `.vscode/` and `<project>.code-workspace` when configured

Run a quick sanity check when available:
- TypeScript: `pnpm run build`
- Python: `poetry run python main.py`

## Handoff To Implementation

After bootstrap verification:
- Summarize exactly which create/configure commands ran.
- List generated optional features.
- Propose the next implementation prompt for Codex (domain entities, topics, transforms, APIs, schedulers).

Do not run publish/deploy/pull-request workflows unless explicitly requested.
