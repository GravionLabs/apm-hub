---
name: create-skill
description: 'Create a new skill in copilot-hub following the agentskills.io directory layout and copilot-hub conventions.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---

Create a new skill in the `GravionLabs/apm-hub` repository.

## Directory Layout
```
templates/<domain>/skills/<name>/
  SKILL.md            ← required; name field must match directory name
  templates/          ← static config files to copy into user projects
  scripts/            ← PS1/bash automation scripts
  references/         ← reference docs, cheat sheets, error catalogs
```
Skills live in `templates/<domain>/skills/<name>/SKILL.md`. Use the `shared` domain for cross-language skills.

## SKILL.md Frontmatter (required)
```yaml
---
name: <name>           # must match directory name exactly
description: '...'     # one sentence; used for auto-selection
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---
```

`allowed-tools` must include cross-platform aliases for every capability the skill needs:

| Capability | Add these identifiers |
|---|---|
| Read / search files | `read search codebase` |
| Edit / create files | `write edit editFiles` |
| Execute shell commands | `execute shell runCommands` |

Keep VS Code-only tools (`problems`, `changes`, `playwright`, `mcp_*`) when needed, but always pair them with the cross-platform set above.

## When to use `## Stack`
Add a `## Stack` block only for skills that run commands — list the key CLI tools and packages.
Omit for analysis, review, or documentation-only skills.

## Content Guidelines
- `SKILL.md` ≤ 100 lines
- Steps must be actionable, not explanatory
- Move detailed background docs to `references/` instead of embedding them in `SKILL.md`
- Use `templates/` for static files copied into user projects
- Use `scripts/` for PS1 automation (cross-platform, `pwsh`-compatible)

## PS1 Script Conventions
```powershell
param(
  [Parameter(Mandatory)][string]$ParamName,
  [ValidateSet('option1','option2')][string]$Type = 'option1'
)
```
- Target `pwsh` (PowerShell Core) — runs on Windows, macOS, and Linux
- Make scripts idempotent; check for existing files before overwriting

## Registering the Skill
After creating the skill, add it to the domain plugin config:
```yaml
# plugins/<plugin>/plugin.config.yml
skills:
  - source: <domain>/skills/<name>
    description: '...'
```
Then run `npm run generate` to rebuild the plugin.

After registering, **update the relevant agent(s)** in the same domain to reference the new skill:
```markdown
## Available Skills

Use `/<skill-name>` to <one-line description from SKILL.md>.
```
Add the entry to the `## Available Skills` section in each agent file where the skill is applicable.

## Tips
> **Use the `task` tool** for mechanical steps (file creation, npm install, `npm run generate`).
> Routes work to a cheaper model. Example: `#task npm run generate`

## References
See `references/` for detailed specs:
- `agentskills-spec.md` — agentskills.io directory layout spec (all 4 subdirs)
- `copilot-plugin-spec.md` — GitHub Copilot CLI plugin.json spec
- `skill-conventions.md` — copilot-hub internal conventions and design decisions

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
