# Skill Companion Directories

Skills can ship with companion files (code templates, reference docs, scripts, assets) that the plugin generator automatically copies alongside the skill's `SKILL.md`.

## Directory Convention

Each skill's companion directory lives next to its `.skill.md` file, under the domain's `skills/` subdirectory:

```
templates/<domain>/skills/
  <skill-name>.skill.md          ← the skill itself
  <skill-name>/                  ← companion directory (same name, no extension)
    templates/                   ← files to copy into user projects
    scripts/                     ← executable utility scripts
    references/                  ← reference docs, cheat sheets, error catalogs
    assets/                      ← images, diagrams, binary files
```

Only create subdirs that are actually needed. An empty `assets/` directory adds no value.

## Subdir Semantics

| Subdir        | Content                                | Examples                                                 |
| :------------ | :------------------------------------- | :------------------------------------------------------- |
| `templates/`  | Files to copy/adapt into user projects | `.editorconfig`, `pyproject.toml`, `Program.cs`, CI YAML |
| `scripts/`    | Executable utility scripts             | `setup.sh`, `run-migrations.ps1`                         |
| `references/` | Reference docs for the agent to read   | `common-errors.md`, `cheatsheet.md`                      |
| `assets/`     | Images, diagrams, binary files         | `architecture.svg`, `logo.png`                           |

## How the Generator Processes Them

When `npm run generate` runs, after writing `SKILL.md` the generator checks for a companion directory:

1. If `templates/<domain>/skills/<skill-name>/` exists, its entire contents are copied recursively to `plugins/<plugin-name>/skills/<skill-name>/`
2. Each copied file is logged: `✓ Skill asset: skills/<skill-name>/templates/...`
3. The skill install process (via Copilot CLI) delivers the companion files alongside `SKILL.md` to the user's `.github/` directory

## Example: `create-dotnet-solution`

```
templates/csharp/skills/
  create-dotnet-solution.skill.md
  create-dotnet-solution/
    templates/
      Directory.Build.props        ← shared MSBuild properties
      Directory.Packages.props     ← Central Package Management stub
      .editorconfig                ← opinionated C# style rules
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

1. Create the companion directory: `templates/<domain>/skills/<skill-name>/`
2. Add your files in the appropriate subdir (`templates/`, `scripts/`, etc.)
3. Add a `## Templates` / `## References` section to the skill's `.skill.md`
4. Run `npm run generate` to verify the files are copied correctly
