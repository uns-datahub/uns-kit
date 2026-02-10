<INSTRUCTIONS>
## Repo-specific workflow notes (uns-kit)
- Do not run any pull-request / deploy workflows from Codex for this repo unless explicitly asked.
- Default deliverable for PR-related work here is a clear, ready-to-use git commit message (and the code changes), not opening a PR.
- Hosting: `uns-kit` is on GitHub. Other UNS projects may still live on Azure DevOps, so avoid assuming Azure DevOps PR tooling applies here.
- Workflow scripts:
  - OK to run: `pnpm run ts:version:patch` and `pnpm run ts:build` (non-interactive).
  - Do not run by default: `pnpm run ts:publish` requires interactive/manual handling; user will publish by hand unless explicitly requested otherwise.
- Commits:
  - It’s OK to commit directly to `master` (no PR needed); prioritize good commit messages.
</INSTRUCTIONS>
