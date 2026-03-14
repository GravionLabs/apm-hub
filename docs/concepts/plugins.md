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
  - source: my-agent  # resolves to templates/agents/my-agent.agent.md

skills:
  - name: my-skill
    source: prompts/my-skill.prompt.md
  - name: extended-skill
    source: prompts/base.prompt.md
    extend:
      - agents/extra.agent.md  # body appended after a --- separator

instructions:
  - source: csharp        # resolves to templates/instructions/csharp.instructions.md
  - source: csharp-nunit  # resolves to templates/instructions/csharp-nunit.instructions.md
```

### Field Reference

| Field                   | Type                      | Required | Description                                                                         |
| :---------------------- | :------------------------ | :------: | :---------------------------------------------------------------------------------- |
| `name`                  | string                    |    ✅     | Unique plugin identifier (kebab-case)                                               |
| `description`           | string                    |    ✅     | One-sentence description of what the plugin provides                                |
| `version`               | string                    |    ✅     | Semantic version (e.g. `"1.0.0"`)                                                   |
| `author`                | string or object          |    —     | Author name or `{ name, email }` object                                             |
| `license`               | string                    |    —     | SPDX license identifier (e.g. `MIT`)                                                |
| `keywords`              | string[]                  |    —     | Searchable tags                                                                     |
| `agents`                | PluginAgentConfig[]       |    —     | List of agents to include                                                           |
| `agents[].source`       | string                    |    ✅     | Agent filename without extension — resolves to `templates/agents/<source>.agent.md` |
| `skills`                | PluginSkillConfig[]       |    —     | List of skills to generate                                                          |
| `skills[].name`         | string                    |    ✅     | Skill name (used as the directory name under `skills/`)                             |
| `skills[].source`       | string                    |    ✅     | Source template path relative to `templates/`                                       |
| `skills[].extend`       | string[]                  |    —     | Additional source paths whose bodies are appended to the skill                      |
| `instructions`          | PluginInstructionConfig[] |    —     | List of instruction files to bundle                                                 |
| `instructions[].source` | string                    |    ✅     | Instruction name — resolves to `templates/instructions/<source>.instructions.md`    |

### Resolving `source` paths

**Agents** — `source: "my-agent"` → `templates/agents/my-agent.agent.md`

**Skills** — `source: "prompts/my-skill.prompt.md"` → `templates/prompts/my-skill.prompt.md`

**Instructions** — `source: "csharp"` → `templates/instructions/csharp.instructions.md`  
The generator automatically appends `.instructions.md` if the source does not already end with it.

---

## How to Use a Plugin

1. Install the plugin via the Copilot CLI:
   ```bash
   gh copilot plugin install <path-or-url-to-plugin>
   ```
2. Use the bundled agents with `@my-agent` in Copilot Chat.
3. Use the bundled skills as slash commands.
4. The bundled instructions are automatically applied to files matching the `applyTo` glob in each instruction file.

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

5. Commit both `plugin.config.yml` and all generated files.

---

## Plugin Marketplace

Available plugins in this hub:

| Plugin                                                                     | Description                                                           |
| :------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| [`csharp-development`](../../plugins/csharp-development/plugin.config.yml) | C#/.NET: NUnit tests, async patterns, code review, Helm               |
| [`gfog-security`](../../plugins/security/plugin.config.yml)                | Security: STRIDE threat modeling, RWEST SSDLC, Disaster Recovery      |
| [`gfog-devops`](../../plugins/gfog-devops/plugin.config.yml)               | DevOps: Azure DevOps pipelines, PR automation, code review publishing |

See the [Plugin Marketplace section in README](../../README.md#-plugin-marketplace) for details.
