# Copilot CLI Plugins

## What is a Copilot CLI Plugin?

A **Copilot CLI plugin** is an installable bundle that extends GitHub Copilot with specialized agents, skills (prompts), and coding instructions scoped to a particular domain or technology stack. Plugins are the primary distribution unit in the copilot-hub — they package everything a team needs for a specific workflow into a single, shareable artifact.

A plugin:
- Bundles **agents** (expert Copilot roles available via `@`-mentions)
- Bundles **skills** (task-specific prompts available as slash commands)
- Bundles **instructions** (persistent coding standards applied to matching files)
- Ships a machine-readable **`plugin.json`** manifest consumed by the Copilot CLI

---

## Plugin Structure

A plugin lives in its own directory under `plugins/`:

```
plugins/
└── my-plugin/
    ├── plugin.config.yml          # Source of truth — defines agents, skills, instructions
    ├── agents/                    # Copied agent files (*.agent.md)
    │   └── my-agent.agent.md
    ├── skills/                    # Generated skill directories
    │   └── my-skill/
    │       └── SKILL.md
    ├── instructions/              # Copied instruction files (*.instructions.md)
    │   └── csharp.instructions.md
    └── .github/
        └── plugin/
            └── plugin.json        # Auto-generated manifest — do not edit manually
```

> **Note:** `plugin.json` and the `agents/`, `skills/`, `instructions/` directories are **auto-generated** by `npm run generate`. Always edit `plugin.config.yml` and re-run the generator.

---

## `plugin.config.yml` Format

The `plugin.config.yml` file is the source of truth for a plugin. The generator reads it and produces all output artifacts.

```yaml
name: my-plugin
description: Short description of what this plugin provides
version: "1.0.0"
author: MyOrg
license: MIT
keywords: [csharp, dotnet]

agents:
  - source: csharp/api-architect    # resolves to templates/csharp/api-architect.agent.md
  - source: shared/documentation-writer

skills:
  - name: csharp-async
    source: csharp/skills/csharp-async     # resolves to templates/csharp/skills/csharp-async.skill.md
  - name: csharp-code-review
    source: csharp/skills/csharp-code-review
    extend:
      - csharp/agents/csharp-expert        # body appended after a --- separator

instructions:
  - source: csharp/instructions/csharp          # resolves to templates/csharp/instructions/csharp.instructions.md
  - source: csharp/instructions/csharp-nunit

files:
  - source: editor-configs/.editorconfig-csharp
    destination: .editorconfig
```

### Field Reference

| Field                   | Type                      | Required | Description                                                                                 |
| :---------------------- | :------------------------ | :------: | :------------------------------------------------------------------------------------------ |
| `name`                  | string                    |    ✅     | Unique plugin identifier (kebab-case)                                                       |
| `description`           | string                    |    ✅     | One-sentence description of what the plugin provides                                        |
| `version`               | string                    |    ✅     | Semantic version (e.g. `"1.0.0"`)                                                           |
| `author`                | string or object          |    —     | Author name or `{ name, email }` object                                                     |
| `license`               | string                    |    —     | SPDX license identifier (e.g. `MIT`)                                                        |
| `keywords`              | string[]                  |    —     | Searchable tags                                                                             |
| `agents`                | PluginAgentConfig[]       |    —     | List of agents to include                                                                   |
| `agents[].source`       | string                    |    ✅     | Agent path — use `<domain>/agents/<name>` (e.g., `csharp/agents/api-architect`).            |
| `skills`                | PluginSkillConfig[]       |    —     | List of skills to generate                                                                  |
| `skills[].name`         | string                    |    ✅     | Skill name (used as the directory name under `skills/`)                                     |
| `skills[].source`       | string                    |    ✅     | Source template path — use `<domain>/skills/<name>` (e.g., `csharp/skills/csharp-async`)    |
| `skills[].extend`       | string[]                  |    —     | Additional source paths whose bodies are appended to the skill                              |
| `instructions`          | PluginInstructionConfig[] |    —     | List of instruction files to bundle                                                         |
| `instructions[].source` | string                    |    ✅     | Instruction path — use `<domain>/instructions/<name>` (e.g., `csharp/instructions/csharp`). |
| `files`                 | PluginFileConfig[]        |    —     | List of arbitrary files to copy into the plugin                                             |
| `files[].source`        | string                    |    ✅     | Source file path relative to `templates/` (or repo root)                                    |
| `files[].destination`   | string                    |    —     | Destination path relative to the plugin directory. Defaults to the basename of source.      |

### Resolving `source` paths

**Agents** — `source: "csharp/agents/api-architect"` → `templates/csharp/agents/api-architect.agent.md`

**Skills** — `source: "csharp/skills/csharp-async"` → `templates/csharp/skills/csharp-async.skill.md` (or `.prompt.md` if no `.skill.md` exists)

**Instructions** — `source: "csharp/instructions/csharp"` → `templates/csharp/instructions/csharp.instructions.md`

All sources use the format `<domain>/<type>/<name>`. The `<type>` segment (`skills`, `agents`, `prompts`, `instructions`) determines the file extension automatically. See [Skill Companion Directories](../usage/skill-companion-dirs.md) for bundling templates, scripts, and references alongside a skill.

---

## How to Use a Plugin

### Option A — Register copilot-hub as a Custom Marketplace *(recommended)*

```bash
# Register once
gh copilot plugin marketplace add GravionLabs/copilot-hub

# Browse available plugins
gh copilot plugin marketplace browse copilot-hub

# Install by name
gh copilot plugin install csharp-development@copilot-hub
```

### Option B — Direct Install

```bash
# Install from a repository subdirectory
gh copilot plugin install GravionLabs/copilot-hub:plugins/csharp-development
```

### After Installation

1. Use the bundled **agents** via `@agent-name` in Copilot Chat.
2. Use the bundled **skills** as slash commands (e.g. `/create-dotnet-solution`).
3. The bundled **instructions** are automatically applied to files matching their `applyTo` glob.

### Managing Plugins

```bash
gh copilot plugin list                          # show installed plugins
gh copilot plugin update csharp-development     # update to latest
gh copilot plugin uninstall csharp-development  # remove
```

---

## How to Create a New Plugin

1. Create a new directory under `plugins/`:
   ```bash
   mkdir plugins/my-plugin
   ```

2. Create `plugins/my-plugin/plugin.config.yml` following the format above.

3. Ensure all referenced templates exist under `templates/`.

4. Run the generator:
   ```bash
   npm run generate
   ```
   This produces `agents/`, `skills/`, `instructions/`, and `.github/plugin/plugin.json`.

5. Commit `plugin.config.yml` — generated files (`agents/`, `skills/`, `instructions/`, `plugin.json`) are gitignored and regenerated automatically by CI after merging to `main`.

---

## Plugin Marketplace

copilot-hub acts as a custom marketplace for the Copilot CLI. A `marketplace.json` in the repo root indexes all available plugins.

Register and browse:

```bash
gh copilot plugin marketplace add GravionLabs/copilot-hub
gh copilot plugin marketplace browse copilot-hub
```

See the [Plugin Marketplace section in README](../../README.md#-plugin-marketplace) and [docs/plugin-list.md](../plugin-list.md) for the full list of available plugins.

---

## marketplace.json

copilot-hub ships a `marketplace.json` file in the repository root. This file makes the repo a first-class **plugin marketplace** for the Copilot CLI — users can register it once and then browse and install plugins by name.

```json
{
  "name": "copilot-hub",
  "description": "...",
  "repository": "GravionLabs/copilot-hub",
  "plugins": [
    {
      "name": "csharp-development",
      "path": "plugins/csharp-development",
      "description": "C#/.NET full-stack development plugin.",
      "version": "1.0.0",
      "keywords": ["csharp", "dotnet"]
    }
  ]
}
```

`marketplace.json` is **auto-generated** by `npm run generate` from the `plugin.config.yml` files in each plugin directory. Do not edit it manually.

---

## Generator Pipeline

Running `npm run generate` (or committing to `main`) triggers a pipeline in `src/index.ts`:

| Step | Generator                       | Output                                                      |
| :--- | :------------------------------ | :---------------------------------------------------------- |
| 1    | `plugin-generator.ts`           | Agents, skills, instructions, `plugin.json` for each plugin |
| 2    | `template-list-generator.ts`    | `docs/template-list.md` (all types, by domain)              |
| 3    | `skill-list-generator.ts`       | `docs/skill-list.md` (skills by domain)                     |
| 4    | `agent-list-generator.ts`       | `docs/agent-list.md` (agents by domain)                     |
| 5    | `instruction-list-generator.ts` | `docs/instruction-list.md` (instructions by domain)         |
| 6    | `plugin-list-generator.ts`      | `docs/plugin-list.md`                                       |
| 7    | `readme-generator.ts`           | Patches `<!-- AUTO:... -->` blocks in `README.md`           |
| 8    | `format-docs-generator.ts`      | Formats all Markdown tables in `docs/` and `README.md`      |
| 9    | `marketplace-generator.ts`      | `marketplace.json`                                          |

> **`npm run generate`** (no args) runs only **step 1** (plugin artifacts: `agents/`, `skills/`, `instructions/`, `plugin.json`). This is safe to run locally in feature branches.
>
> **Steps 2–9** require **`npm run generate:ci`** and must only run via CI, not locally in feature branches. Running `generate:ci` locally will produce aggregate docs (`marketplace.json`, `skill-list.md`, etc.) that must not be committed to feature branch PRs.
