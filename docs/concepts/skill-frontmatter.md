# Skill Frontmatter Convention

Every `SKILL.md` in `packages/*/.apm/skills/<name>/` must carry only the frontmatter defined here.
The goal: one source file that loads cleanly on **GitHub Copilot**, **Claude Code**, and **OpenCode**
without per-platform rewriting. The convention follows the
[agentskills.io specification](https://agentskills.io/specification).

## Legal top-level keys

| Key           | Required | Rules                                                                                     |
| :------------ | :------- | :---------------------------------------------------------------------------------------- |
| `name`        | yes      | kebab-case, matches the skill directory name                                              |
| `description` | yes      | Trigger-oriented: what the skill does **and** when to use it, including trigger phrases   |
| `license`     | no       | SPDX identifier (e.g. `MIT`)                                                              |
| `metadata`    | no       | Map for everything non-standard (see below)                                               |

**No other top-level keys are allowed.** In particular:

- **`allowed-tools` — dropped.** All three platforms run skills fine without it. The old values
  (`execute shell runCommands read write edit editFiles search codebase`) mixed Copilot and generic
  tool names in one space-separated string; Claude Code parses `allowed-tools` as a comma-separated
  list of *its* tool names, so the field matched nothing anywhere. Tool restriction is the host
  platform's job (agent `permission` blocks, Claude Code settings, Copilot policies), not the
  skill's. Decision recorded 2026-07 in #43.
- **`model` — forbidden.** Model choice is platform-specific and goes stale (`gpt-4.1` meant
  nothing to Claude Code or OpenCode). Skills are instructions, not runtime configuration.
- **`compatibility` — dropped.** Every skill claimed `opencode, github-copilot` while also working
  on Claude Code; a field that is uniformly wrong carries no information. Spec-compliant skills are
  compatible with all agentskills.io hosts by definition. If a skill ever genuinely supports only
  one platform, record that under `metadata.compatibility` with a comment explaining why.
- **`chronicle-hints`** and any other custom annotations move under `metadata:`.

## Template

```yaml
---
name: my-skill
description: >
  Does X for Y. Use this skill when the user asks to "do X", "set up Y",
  even if the request is underspecified.
license: MIT
metadata:
  chronicle-hints: 'single-purpose, structured-output, phases'
---
```

`metadata` values are free-form strings; hosts ignore them. Authorship/attribution
(e.g. upstream copyright) also lives here.

## Body rules (unchanged)

- Keep `SKILL.md` under ~100 lines; push detail into `references/*.md` (progressive disclosure).
- Reference files are loaded on demand by the skill body — never rely on frontmatter to load them.

## Enforcement

- `skill-create` / `skill-write` (apm-tooling) scaffold this template.
- `skill-audit` flags any non-standard top-level key (`allowed-tools`, `model`, `compatibility`,
  `chronicle-hints`, …) as a violation.
