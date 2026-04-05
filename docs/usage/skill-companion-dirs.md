# Skill Companion Directories

Skills can ship with companion files (code templates, reference docs, scripts, assets) that the plugin generator automatically copies alongside the skill's `SKILL.md`.

## Directory Convention

Each skill lives in its own directory under the domain's `skills/` subdirectory, following the [agentskills.io](https://agentskills.io) directory layout:

```
templates/<domain>/skills/
  <skill-name>/
    SKILL.md                         ← the skill itself
    templates/                       ← files to copy into user projects
    scripts/                         ← executable utility scripts
    references/                      ← reference docs, cheat sheets, error catalogs
    assets/                          ← images, diagrams, binary files
```

Only create subdirs that are actually needed. An empty `assets/` directory adds no value.

> **Legacy flat layout (backward compatible):** `<skill-name>.skill.md` alongside a `<skill-name>/` companion directory is still supported but deprecated. Prefer the directory layout for new skills.

## Subdir Semantics

| Subdir | Content | Examples |
|---|---|---|
| `templates/` | Files to copy/adapt into user projects | `.editorconfig`, `pyproject.toml`, `Program.cs`, CI YAML |
| `scripts/` | Executable utility scripts | `setup.sh`, `run-migrations.ps1` |
| `references/` | Reference docs for the agent to read | `common-errors.md`, `cheatsheet.md` |
| `assets/` | Images, diagrams, binary files | `architecture.svg`, `logo.png` |

## How the Generator Processes Them

When `npm run generate` runs, after writing `SKILL.md` the generator copies companion files:

1. Reads all entries in `templates/<domain>/skills/<skill-name>/` (excluding `SKILL.md`)
2. Recursively copies them to `plugins/<plugin-name>/skills/<skill-name>/`
3. Each copied file is logged: `✓ Skill asset: skills/<skill-name>/templates/...`
4. The skill install process (via Copilot CLI) delivers the companion files alongside `SKILL.md` to the user's `.github/` directory

## Example: `create-dotnet-solution`

```
templates/csharp/skills/
  create-dotnet-solution/
    SKILL.md
    templates/
      Directory.Build.props        ← shared MSBuild properties
      Directory.Packages.props     ← Central Package Management stub
      .editorconfig                ← opinionated C# style rules
    scripts/
      New-Solution.ps1
```

The skill references these in its `## Templates` section so the agent knows to copy them to the solution root.

## Referencing Companion Files in the Skill

Document companion files in a `## Templates` or `## References` section:

```markdown
## Templates
Starter files are available in `templates/` alongside this skill:
- **`Directory.Build.props`** — shared MSBuild properties (Nullable, TreatWarningsAsErrors)
- **`Directory.Packages.props`** — Central Package Management stub with test packages
```

## Adding Companion Files to an Existing Skill

1. Place files in the appropriate subdir inside the skill directory: `templates/<domain>/skills/<skill-name>/templates/`, `scripts/`, etc.
2. Add a `## Templates` / `## References` section to the skill's `SKILL.md`
3. Run `npm run generate` to verify the files are copied correctly
