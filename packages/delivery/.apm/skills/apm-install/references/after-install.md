# After install

## What to commit

| Path | Action |
|:--|:--|
| `apm.yml`, `apm.lock.yaml` | commit |
| `.github/skills/`, `.claude/skills/`, `.opencode/skills/` | commit (instant context on clone) |
| `apm_modules/` | add to `.gitignore` |

## Runner (optional)

The skills work by hand. To chain them automatically install the runner once per machine and check it:

```bash
npm i -g dromos
dromos --version
```

Per repository dromos reads `.dromos/config.json` (commit it; without it the defaults apply). Example for a TypeScript project:

```json
{
  "harness": "claude",
  "models": { "claude": { "planner": "opus", "implementer": "sonnet", "reviewer": "sonnet" } },
  "test": { "related": "pnpm vitest related --run", "full": "pnpm test" },
  "parallel": 3
}
```

`test.related` is optional (without it the runner runs `test.full`). All keys, `skills` per role and `allow` extensions: [dromos README](https://github.com/GravionLabs/dromos#readme). Usage: [the runner](https://github.com/GravionLabs/apm-hub/blob/release/next/docs/runner.md).

## Upgrading from 2.x

3.0.0 removes the agents and the orchestration skills. After `apm update -g` the v2.5.4 files can remain and reference `github-issue` files 3.x no longer ships: the agents `orchestrator`, `pbi-runner`, `implementer`, `issue-reader`, `explorer`, `planner`, `pr-writer`, `review-lead`, `reviewer` and the skills `orchestrator`, `review-fanout`, `queue`, `handoff`, `orch-pipeline`, `orch`, `verify-project`. Two options:

- Keep the old pipeline: pin `agents`, `github` and `delivery` together at `#v2.5.4` (for example `GravionLabs/apm-hub/packages/agents#v2.5.4`), then `apm install -g`.
- Remove it: delete the `packages/agents` entry (`apm uninstall -g GravionLabs/apm-hub/packages/agents`), then `apm update -g`.

What apm cleans itself (checked with apm 0.35.0 on a scratch project): it removes every file it recorded in `apm.lock.yaml` for a package that left `apm.yml` ("Cleaned 11 files from packages no longer in apm.yml") and for a skill a package no longer ships ("Cleaned 25 stale deployed files"). Recorded paths of `agents` are `~/.claude/agents/<name>.md` (Claude Code) and `~/.copilot/agents/<name>.agent.md` (Copilot CLI), plus `.config/opencode/agents/` and `.codex/agents/`; the skills sit in `~/.claude/skills/` and `~/.agents/skills/`. What remains: an `agents` entry in `apm.yml` that no longer resolves in 3.x (remove or pin it), and files apm never recorded (no lock file, copied by hand): delete those paths yourself.

