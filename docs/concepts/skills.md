# Skills

A **skill** is a directory with a `SKILL.md` file and optional companion files (`scripts/`, `references/`, `templates/`, `assets/`). It packages a procedure, a convention or a tool contract so an AI coding agent can load it on demand. Skills follow the open [Agent Skills specification](https://agentskills.io/specification) and are the main artifact apm-hub ships; the separate `agents` package adds a few agents that skills cannot replace.

## How a skill is loaded

Agents load skills progressively:

| Stage | What loads | When |
| :-- | :-- | :-- |
| Discovery | `name` and `description` of every installed skill | Session start |
| Activation | The full `SKILL.md` body | The description matches the task, or the user names the skill |
| Execution | Files under `references/`, `scripts/`, `templates/` | Only when the skill says to read or run them |

This is why the `description` is trigger-oriented (what the skill does **and** when to use it) and why `SKILL.md` stays short: everything in it costs tokens on every activation.

You can always name a skill explicitly:

```text
Use the dotnet-create-solution skill to scaffold the project.
```

## Where skills live

Skills are authored once under `packages/<domain>/.apm/skills/<name>/` and deployed by `apm install` to each platform's directory:

| Platform | Project path |
| :-- | :-- |
| GitHub Copilot | `.github/skills/<name>/` |
| Claude Code | `.claude/skills/<name>/` |
| OpenCode | `.opencode/skills/<name>/` |

Commit the deployed directories in your project so a fresh clone has the skills immediately. `apm_modules/` is install state and belongs in `.gitignore`.

## Structure of a SKILL.md

```markdown
---
name: ts-test
description: >
  TypeScript/Node.js test rules using Vitest. Covers runner config, file naming,
  mocking, coverage and test-writing methodology. Use when writing or running
  tests in a TypeScript project.
---

One-line purpose. Paths to `scripts/` and `references/` are relative to this skill's directory.

## Steps
...

## Gotchas
...
```

Rules that every skill in this repo follows:

- Frontmatter has only `name`, `description` and optional `license` / `metadata`. See the [frontmatter convention](skill-frontmatter.md) for why `allowed-tools`, `model` and similar keys are rejected.
- `SKILL.md` is at most 100 lines (enforced by a test). Long specs go to `references/` with a conditional load line, repeatable procedures to `scripts/*.ps1`, starter files to `templates/`.
- Scripts are PowerShell 7+ and are called as `pwsh scripts/<Name>.ps1`.
- A skill that needs another skill's work delegates by name instead of restating it.

The complete rule set is in `packages/apm-tooling/.apm/skills/skill-write/references/skill-writing-rules.md`; the `skill-write`, `skill-audit` and `skill-slim` skills apply it.

## How the skills compose

- `detect-techstack` returns a JSON report naming the `<lang>-implementation` and `<lang>-test` skills for the project.
- `implementation` enforces "every change has tests" and dispatches to the language skill from that report.
- `code-review` reads the `## Review rules` section of each detected `<lang>-implementation` skill and rates findings 🔴 / 🟡 / 🟢.
- `diagnose` is loaded for bug fixes: it builds a red-capable feedback loop (commands from `<lang>-test`) before any hypothesis.
- `verify-project` runs build, tests and lint with the detected package manager.
- `orch-pipeline` chains plan, TDD, `review-fanout` and commit; `/orch` is its prompt.
- `github-issue` routes issue work by label and sub-issue shape; `github-pull-request` opens the PR.

## Skills vs. prompts

The only prompt in the repo is `/orch` in `packages/delivery/.apm/prompts/`. It just loads `orch-pipeline`. Prompts are slash-command entry points; the behaviour always lives in a skill so it works the same on every platform.

## Related

- [Skill frontmatter convention](skill-frontmatter.md)
- [Skill companion directories](../usage/skill-companion-dirs.md)
- [Common workflows](../usage/common-workflows.md)
- [All skills](../skill-list.md) (generated)
- [agentskills.io specification](https://agentskills.io/specification)
- [GitHub Copilot: about agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
