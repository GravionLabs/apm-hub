# agentskills.io Skill Directory Spec

## Skill Directory Layout

A skill is a **directory** named after the skill, containing a required `SKILL.md` and optional subdirectories:

```
<skill-name>/
├── SKILL.md          ← required
├── scripts/          ← executable helpers (bash, PowerShell, Python)
├── references/       ← reference docs (Markdown, cheat sheets, error catalogs)
├── assets/           ← images, diagrams, binary files
└── templates/        ← starter code / config files to copy into user projects
```

## SKILL.md Required Fields

| Field | Description |
|---|---|
| `name` | Skill identifier — **must match the directory name exactly** |
| `description` | One-sentence description shown to users and used for auto-selection |
| `allowed-tools` | Space-separated list of tools the agent may use |

> **Note:** The official GitHub Copilot CLI currently only recognises `name`, `description`, `license`, and `allowed-tools`. Unknown fields are silently ignored.

### SKILL.md Frontmatter Format
```yaml
---
name: skill-name
description: 'What this skill does in one sentence.'
allowed-tools: editFiles codebase runCommands
---
```

### Optional Frontmatter Fields
| Field | Description | Support |
|---|---|---|
| `model` | Preferred model (e.g., `gpt-4.1`) — omit to use session default | ⚠️ aspirational — not yet implemented in official Copilot CLI (ignored) |
| `version` | Skill version string | ⚠️ aspirational — not yet implemented in official Copilot CLI (ignored) |

## Standard Subdirectory Purposes

### `templates/`
Static files that the agent copies (and optionally patches) into the user's project.
Examples: `.prettierrc`, `tsconfig.json`, `Directory.Build.props`, `ci.yml`.

### `scripts/`
Executable helpers that automate multi-step setup tasks.
- PowerShell (`.ps1`) for cross-platform automation — run with `pwsh`
- Bash (`.sh`) for Unix-only tasks
- Python (`.py`) for data-processing helpers

### `references/`
Markdown documentation the agent reads during execution — not copied to user projects.
Examples: error catalogs, cheat sheets, decision trees, constraint lists.

### `assets/`
Static binary resources: diagrams, images, data files.
The agent typically references these but does not copy them to user projects.

## Skill Discovery (agentskills.io)

Skills are discovered via the `COPILOT_SKILLS_DIRS` environment variable — a colon-separated list of directories to scan. Each subdirectory containing a `SKILL.md` is recognized as a skill.

## copilot-hub Extension: `plugin.config.yml`

In copilot-hub, skills are additionally registered in the domain's `plugin.config.yml`:
```yaml
skills:
  - source: <domain>/skills/<name>   # relative to templates/
    description: '...'              # used in marketplace listing
```
The generator copies the entire skill directory (including subdirs) into the plugin output.
