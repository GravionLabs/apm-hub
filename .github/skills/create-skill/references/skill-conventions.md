# copilot-hub Skill Conventions

Internal conventions for creating and maintaining skills in the `GravionLabs/copilot-hub` repository.

## Directory Layout

Skills use the agentskills.io directory layout:
```
templates/<domain>/skills/<name>/
  SKILL.md
  templates/   ← config files copied to user projects
  scripts/     ← PS1 automation scripts
  references/  ← deep-dive docs
```

Only `SKILL.md` is required. Create subdirectories only when content exists for them.

## Supported Domains

| Domain | Purpose |
|---|---|
| `csharp` | C# / .NET skills |
| `typescript` | TypeScript / Node.js / Angular skills |
| `python` | Python skills |
| `devops` | CI/CD, GitHub Actions, Azure DevOps |
| `terraform` | Terraform / IaC skills |
| `security` | Security review, auditing |
| `angular` | Angular-specific skills |
| `docker` | Docker / container skills |
| `postgresql` | Database skills |
| `shared` | Cross-language / meta skills |

## SKILL.md Guidelines

- **≤ 100 lines** — keep it actionable; move detailed background to `references/`
- **Frontmatter** `name` field must match the directory name exactly
- **`## Stack` block** — required for any skill that runs commands; omit for analysis/review skills
- **Steps** — imperative voice, numbered, actionable (not explanatory)
- **`## Constraints`** — list hard rules the agent must follow
- **`## Tips`** — task tool hint for mechanical steps (see below)

## Task Tool Tip Pattern

Add at the end of skills with mechanical automation steps:
```markdown
## Tips
> **Use the `task` tool** for the scaffolding steps — they are mechanical and don't require reasoning.
> Example: `#task pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Core" -OutputType library`
> This allows routing scaffold work to a cheaper, faster model.
```

## Template Files Conventions

- Place in `templates/` subdirectory alongside `SKILL.md`
- Always reference them in a `## Templates` or `## Template Files` section in `SKILL.md`
- Use a table: `| File | Purpose |`
- Files are copied verbatim into the plugin by the generator — keep them production-ready

## PS1 Script Conventions

- Target `pwsh` (PowerShell Core) — cross-platform
- Use `param()` block with `[Parameter(Mandatory)]` and `[ValidateSet()]`
- Include `$ErrorActionPreference = 'Stop'`
- Make scripts idempotent — check before overwriting
- Use `Write-Host "..." -ForegroundColor Cyan` for progress, `Green` for success, `Red` for errors
- `$ScriptDir = $PSScriptRoot` — use relative paths from script location

## Generating After Changes

After creating or modifying skills and `plugin.config.yml`:
```bash
npm run build && npm run generate
```
Never commit generated files (`docs/*.md`, `.github/plugin/marketplace.json`) — CI regenerates them.

## Naming Conventions

- Skill directory name: `kebab-case` (e.g., `setup-prettier-eslint-husky`)
- SKILL.md `name` field: identical to directory name
- PS1 scripts: `PascalCase` verb-noun (e.g., `New-Solution.ps1`, `Setup-CodeQuality.ps1`)
- Template files: match the filename used in the user's project (e.g., `.prettierrc`, `tsconfig.json`)
