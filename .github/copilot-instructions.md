# copilot-hub — Project Instructions

## What is this repository?

**copilot-hub** is a curated shared library for GitHub Copilot. It contains:
- **Templates** — reusable `.instructions.md`, `.prompt.md`, and `.agent.md` files teams copy into their own repos
- **CLI Plugins** — Copilot CLI plugins acting as a team-internal plugin marketplace
- **TypeScript tooling** — generators in `src/` that produce docs and plugin manifests

## Repository Structure

```
templates/
  agents/        # *.agent.md         — specialized Copilot roles (@-mentions)
  prompts/       # *.prompt.md        — task workflows (slash commands)
  instructions/  # *.instructions.md  — persistent project rules
plugins/
  <name>/        # plugin.config.yml + generated .github/plugin/plugin.json
src/             # TypeScript generators (Vitest tests, build: npm run build)
docs/            # Concepts, usage guides, best practices, checklists, sync docs
examples/        # Usage examples for agents, prompts, instructions
editor-configs/  # Editor configuration templates
.github/
  instructions/  # Scoped instructions for this repo itself
  agents/        # Agents for this repo's own workflows
  prompts/       # Prompts for this repo's own workflows
```

After adding or modifying templates, regenerate the index: `npm run generate-template-list`.

## Frontmatter Requirements

### `.instructions.md`
```yaml
---
description: 'Short description of what these instructions cover'
applyTo: '**/*.cs'   # glob pattern — omit for globally scoped instructions
---
```
- `applyTo` is required for scoped instructions (language/framework specific)
- `applyTo` must be omitted for global instructions meant for all files

### `.prompt.md`
```yaml
---
agent: agent          # or 'copilot' for inline completions
description: 'One sentence: what task does this prompt perform?'
---
```
- `description` must answer: "When should I use this prompt?"
- File name must be `kebab-case` and describe the task (e.g. `explain-code.prompt.md`)

### `.agent.md`
```yaml
---
name: 'Agent Display Name'
description: 'What this agent does and when to use it'
target: vscode        # vscode | jetbrains | all
tools:                # optional: list of allowed tools
---
```

### `plugin.config.yml`
```yaml
name: plugin-name
description: 'What this plugin provides'
version: "1.0.0"
agents:
  - source: agent-filename   # references templates/agents/*.agent.md
skills:
  - name: skill-name
    source: agents/agent-filename.agent.md
```
- Agent sources must match files in the plugin's `agents/` folder
- `plugin.json` in `.github/plugin/` is auto-generated — do not edit manually

## Code Review Guidelines

**Focus on correctness and reusability. Do not flag style nits or minor formatting.**

### Template files (`.instructions.md`, `.prompt.md`, `.agent.md`)
- Frontmatter is present and all required fields are populated
- `applyTo` glob pattern is correct and not overly broad (e.g. avoid `**/*`)
- Content is reusable across projects — no hardcoded org names, repo URLs, or secrets
- One clear purpose per file — no mixed concerns
- Refer to `docs/checklists/` for detailed per-type checklists

### Plugin files (`plugin.config.yml`, `agents/`, `skills/`)
- Agent source paths exist in the plugin's `agents/` folder
- Skills reference valid agent files
- Do not suggest edits to auto-generated `plugin.json`

### TypeScript (`src/`)
- Type safety is maintained (no `any` without justification)
- New generators must have corresponding Vitest tests in `*.test.ts`
- Run `npm test` to verify: all tests must pass
- Run `npm run build` to verify compilation

### Documentation (`docs/`)
- Internal links point to existing files
- New template types or significant features are documented

## Naming Conventions

| Type | Pattern | Example |
| :--- | :--- | :--- |
| Instructions | `<scope>.instructions.md` | `csharp.instructions.md` |
| Prompts | `<task>.prompt.md` | `explain-code.prompt.md` |
| Agents | `<role>.agent.md` | `security-reviewer.agent.md` |

All names use lowercase `kebab-case`. One purpose per file.

## What NOT to flag in reviews

- Minor Markdown formatting (blank lines, list style)
- Prose style preferences
- Line length in documentation
- Ordering of frontmatter keys
