## Frontmatter Schema

Use this file when a skill needs the shared frontmatter rules.

> **Source of truth:** `docs/concepts/skill-frontmatter.md`. Skills must load
> on GitHub Copilot, Claude Code, and OpenCode from one source file, so only
> agentskills.io-legal keys are allowed at the top level.

### Required fields

| Field         | Rules                                                                                                                     |
|---------------|---------------------------------------------------------------------------------------------------------------------------|
| `name`        | Kebab-case only, 1-64 chars, must match the parent directory exactly, no leading/trailing/consecutive hyphens.            |
| `description` | Imperative phrasing, 1-1,024 chars, describes what the skill does and when to use it, includes specific trigger keywords. |

### Optional fields

| Field      | Rules                                                                                       |
|------------|----------------------------------------------------------------------------------------------|
| `license`  | SPDX identifier (e.g. `MIT`).                                                                |
| `metadata` | Map of free-form string annotations (e.g. `chronicle-hints`, authorship). Hosts ignore them. |

### Forbidden top-level fields (🔴 audit finding)

| Field           | Why forbidden                                                                                        |
|-----------------|------------------------------------------------------------------------------------------------------|
| `allowed-tools` | Matched no platform's tool vocabulary; tool policy belongs to the host platform, not the skill.      |
| `model`         | Platform-specific and goes stale; skills are instructions, not runtime configuration.                |
| `compatibility` | Spec-compliant skills run on all agentskills.io hosts; a uniform claim carries no information.       |
| anything else   | Non-standard keys break strict loaders. Move custom annotations under `metadata:`.                   |

### Minimal valid frontmatter

```yaml
---
name: my-skill
description: >
  Does X. Use this skill when the user needs Y or Z, even if they do not
  mention X explicitly.
---
```

### With optional fields

```yaml
---
name: my-skill
description: >
  Does X. Use this skill when the user needs Y or Z.
license: MIT
metadata:
  chronicle-hints: 'single-purpose, structured-output, phases'
---
```
