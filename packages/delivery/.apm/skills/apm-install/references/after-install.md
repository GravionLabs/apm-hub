# After install

## What to commit

| Path | Action |
|:--|:--|
| `apm.yml`, `apm.lock.yaml` | commit |
| `.github/skills/`, `.claude/skills/`, `.opencode/skills/` | commit (instant context on clone) |
| `apm_modules/` | add to `.gitignore` |
| `.agents/config.json` | commit (project config, see [project config](https://github.com/GravionLabs/apm-hub/blob/main/docs/usage/project-config.md)). When `.gitignore` ignores the whole directory, use the lines `.agents/*` and `!.agents/config.json` instead; the installer prints a note when they are missing |

## Delivery

Delivery runs through the `deliver` skill (`/deliver <nr>`, harness-neutral), not through a separate runner.

Before the first `/deliver <nr> --unattended`, propose the shell allowlist of the harness and let the user confirm it (never write it unasked): `.claude/settings.json` (`permissions.allow`) for Claude Code, `opencode.json` (`permission.bash`) for OpenCode, `--allow-tool 'shell(…)'` flags for Copilot CLI. The entries are `git`, `gh`, `herdr pane report-metadata` and the verify commands of the repository's `AGENTS.md` (build, test, format, lint): read them from its `## Commands` section and name them. The templates per harness are in `permissions.md` in the references of the `deliver` skill; without them an unattended run stops at the first prompt. The dromos runner and its `.dromos/config.json` are gone: dromos was archived with decision 004 (bus, attention and gates continue in [GravionLabs/keryx](https://github.com/GravionLabs/keryx)). Delete a leftover `.dromos/` directory; `npm uninstall -g @gravionlabs/dromos` removes the CLI. The per-project settings the skills read live in `.agents/config.json`.

## Upgrading from 2.x

3.0.0 removes the agents and the orchestration skills. After `apm update -g` the v2.5.4 files can remain and reference `github-issue` files 3.x no longer ships: the agents `orchestrator`, `pbi-runner`, `implementer`, `issue-reader`, `explorer`, `planner`, `pr-writer`, `review-lead`, `reviewer` and the skills `orchestrator`, `review-fanout`, `queue`, `handoff`, `orch-pipeline`, `orch`, `verify-project`. Two options:

- Keep the old pipeline: pin `agents`, `github` and `delivery` together at `#v2.5.4` (for example `GravionLabs/apm-hub/packages/agents#v2.5.4`), then `apm install -g`.
- Remove it: delete the `packages/agents` entry (`apm uninstall -g GravionLabs/apm-hub/packages/agents`), then `apm update -g`.

What apm cleans itself (checked with apm 0.35.0 on a scratch project): it removes every file it recorded in `apm.lock.yaml` for a package that left `apm.yml` ("Cleaned 11 files from packages no longer in apm.yml") and for a skill a package no longer ships ("Cleaned 25 stale deployed files"). Recorded paths of `agents` are `~/.claude/agents/<name>.md` (Claude Code) and `~/.copilot/agents/<name>.agent.md` (Copilot CLI), plus `.config/opencode/agents/` and `.codex/agents/`; the skills sit in `~/.claude/skills/` and `~/.agents/skills/`. What remains: an `agents` entry in `apm.yml` that no longer resolves in 3.x (remove or pin it), and files apm never recorded (no lock file, copied by hand): delete those paths yourself.

