# UNS Kit Command Matrix

## TypeScript CLI (`@uns-kit/cli`)

Create:
```bash
pnpm --package=@uns-kit/cli dlx uns-kit create <project_name>
```

Configure commands:
- `uns-kit configure [path] [features...]`
- `uns-kit configure-templates [path] [templates...]`
- `uns-kit configure-devops [path]`
- `uns-kit configure-vscode [path]`
- `uns-kit configure-codegen [path]`
- `uns-kit configure-api [path]`
- `uns-kit configure-cron [path]`
- `uns-kit configure-temporal [path]`
- `uns-kit configure-python [path]`
- `uns-kit configure-uns-reference [path]`

Feature aliases for `uns-kit configure`:
- `devops`, `vscode`, `codegen`, `api`, `cron`, `temporal`, `python`, `uns-reference`

Safe defaults:
- Minimal: `vscode`
- Standard: `vscode codegen uns-reference`
- Optional on request: `api`, `cron`, `python`, `devops`, `temporal`

## Python CLI (`uns-kit-py`)

Create:
```bash
uns-kit-py create <project_name>
```

Configure commands:
- `uns-kit-py configure-vscode [path]`
- `uns-kit-py configure-workspace [path]`
- `uns-kit-py configure-devops [path]`

Notes:
- Run Python configure commands individually (no multi-feature aggregator command).
- `configure-devops` prompts for Azure inputs and can ask for PAT.

## Post-bootstrap sanity checks

TypeScript:
```bash
pnpm install
pnpm run build
```

Python:
```bash
poetry install
poetry run python main.py
```
