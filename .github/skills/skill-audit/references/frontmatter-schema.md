## Frontmatter Schema

Use this file when a skill needs the shared frontmatter rules.

> **Official vs repo-local fields:** Official GitHub skill docs currently
> document `name`, `description`, optional `license`, and `allowed-tools`.
> This schema also records copilot-hub conventions that are useful in this
> repository, even when they are not part of the official minimum.

### Required fields

| Field         | Rules                                                                                                                     |
|---------------|---------------------------------------------------------------------------------------------------------------------------|
| `name`        | Kebab-case only, 1-64 chars, must match the parent directory exactly, no leading/trailing/consecutive hyphens.            |
| `description` | Imperative phrasing, 1-1,024 chars, describes what the skill does and when to use it, includes specific trigger keywords. |

### Optional fields

| Field           | Rules                                                                                                                                                                                              |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `compatibility` | Only add when the skill has specific runtime/environment requirements.                                                                                                                             |
| `allowed-tools` | Space-separated tool identifiers. Only pre-approve shell access when bundled scripts or inline shell commands have been reviewed.                                                                  |
| `model`         | Repo-local advisory field only. If used, pick a value from `docs/model-overview.md`, keep it consistent with any body-level "Model hint", and do not treat it as officially required skill syntax. |

### `allowed-tools` aliases

| Capability             | Add these identifiers       |
|------------------------|-----------------------------|
| Read/search files      | `read search codebase`      |
| Edit/create files      | `write edit editFiles`      |
| Execute shell commands | `execute shell runCommands` |
| Web fetch              | `web`                       |

### Minimal valid frontmatter

```yaml
---
name: my-skill
description: >
  Does X. Use this skill when the user needs Y or Z, even if they do not
  mention X explicitly.
---
```

### Repo-local advisory `model`

Use `model` only when this repository benefits from an explicit preferred model.
It is not part of the official GitHub skill minimum and may be ignored by
official Copilot skill loaders.

```yaml
---
name: my-skill
description: >
  Does X. Use this skill when the user needs Y or Z.
model: claude-sonnet-4.6
---
```
