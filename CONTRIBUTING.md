# Contributing to copilot-hub

Thank you for your interest in contributing to **copilot-hub** 🎉

This repository serves as a **shared knowledge base and template library** for using GitHub Copilot effectively across teams.  
To keep the content consistent, maintainable, and high‑quality, please follow the guidelines below.

---

## 1. Purpose of this Repository

This repository provides:

- Documentation explaining GitHub Copilot concepts
  (Prompts, Instructions, Agents, best practices)
- Reusable **Copilot configuration files**
- Example prompts, instructions, and agents
- A shared foundation for team‑wide Copilot enablement

All contributions should support at least one of these goals.

---

## 2. What You Can Contribute

You are welcome to contribute:

### ✅ Documentation

- Concept explanations (`docs/concepts`)
- Usage guides (`docs/usage`)
- Best practices (`docs/best-practices`)
- FAQs and onboarding material

### ✅ Copilot Configuration

- New or improved prompt files (`.prompt.md`)
- Repository‑wide or path‑specific instruction files
- Custom agents for well‑defined roles

### ✅ Examples

- Prompt usage examples
- Agent invocation examples
- Instruction scoping examples

---

## 3. What Should _Not_ Be Added

Please **do not** add:

- Project‑specific secrets or credentials
- Organization‑specific internal URLs or references
- Hardcoded personal or company‑specific identifiers
- Opinionated tooling requirements without explanation

This repository should remain **generic, reusable, and safe**.

---

## 4. File and Naming Conventions

### General Rules

- Use **lowercase kebab‑case** for file names
- Keep names short, descriptive, and explicit
- One purpose per file

### Prompts

```text
<task-name>.prompt.md
```

Examples:

- explain-code.prompt.md
- ts-write-tests.prompt.md
- code-review.prompt.md

### Instructions

```text
<scope>.instructions.md
```

Examples:

- frontend.instructions.md
- backend.instructions.md
- security.instructions.md

### Agents

```text
<role>.agent.md
```

Examples:

- security-reviewer.agent.md
- test-engineer.agent.md
- documentation-writer.agent.md

### Skills

Skills use the [agentskills.io](https://agentskills.io) directory layout — each skill lives in its own directory:

```text
templates/<domain>/skills/<task-name>/
  SKILL.md
```

Examples:

- `csharp/skills/csharp-async/SKILL.md`
- `csharp/skills/create-dotnet-solution/SKILL.md`
- `devops/skills/code-review/SKILL.md`

> **Legacy:** flat `<task-name>.skill.md` files are still supported for backward compatibility but the directory layout is the default for all new and migrated skills.

## 6. Auto-Generated Files — Do Not Commit in Feature Branches

The plugin generator produces several **aggregate files** that summarise all plugins in one place.
These files are regenerated automatically by CI after every merge to `main` and must **not** be included in feature branch commits.

### Files that must not be committed in PRs

| File | Description |
|------|-------------|
| `.github/plugin/marketplace.json` | Combined marketplace manifest (all plugins) |
| `docs/plugin-list.md` | Generated plugin overview table |
| `docs/skill-list.md` | Generated skill overview table |
| `docs/template-list.md` | Generated template overview table |
| `docs/agent-list.md` | Generated agent overview table |
| `docs/instruction-list.md` | Generated instruction overview table |

### What to commit instead

A PR that adds a new plugin should only contain:

```
templates/<domain>/agents/<name>.agent.md         ← new agent template
templates/<domain>/skills/<name>/SKILL.md         ← new skill (preferred directory layout)
templates/<domain>/skills/<name>/                 ← companion content lives here too
templates/<domain>/instructions/<name>.instructions.md  ← new instruction template
templates/<domain>/prompts/<name>.prompt.md       ← new prompt template (VS Code)

plugins/<plugin-name>/skills/*/SKILL.md     ← generated (gitignored)
plugins/<plugin-name>/agents/*.agent.md     ← generated (gitignored)
plugins/<plugin-name>/instructions/*.md     ← generated (gitignored)
plugins/<plugin-name>/.github/plugin/plugin.json  ← generated (gitignored)
```

> See [Skill Companion Directories](docs/usage/skill-companion-dirs.md) for how to add templates, scripts, references, and assets alongside a skill.

> **Note:** Per-plugin files under `plugins/<plugin-name>/` are fine to commit — they only affect one plugin's directory and will never conflict across branches. The prohibited files are the ones that **aggregate all plugins into a single file**.

### Why?

When two feature branches both run the generator and commit `.github/plugin/marketplace.json`, git cannot automatically resolve the conflict because both branches modified the same sorted list.
By keeping aggregate files out of PRs, merges are always clean — CI regenerates everything on `main` in a single `[skip ci]` commit after each merge.

### CI Enforcement

A CI check (`No Generated Files in PR`) will fail if your PR contains any of the files listed above.
To fix it, remove them from your commits:

```bash
git restore --staged .github/plugin/marketplace.json docs/plugin-list.md docs/skill-list.md docs/template-list.md
git commit --amend --no-edit
```


## 5. Writing Guidelines

### Writing Prompts

Good prompts:

- Focus on one task
- Use clear input placeholders (${input:...})
- Explicitly state expected output
- Avoid unnecessary verbosity (like "can you please ...." )

Bad prompts:

- Try to cover many unrelated tasks
- Implicit assumptions about the codebase
- Overly generic instructions

### Writing Instructions

Instructions should:

- Describe how Copilot should behave
- Remain high‑level and stable
- Avoid repeating prompt logic
- Use applyTo scopes where appropriate

Do not:

- Over‑constrain Copilot
- Duplicate documentation text
- Encode company‑specific policy without context

### Writing Agents

Agents must:

- Have a clearly defined role
- Declare boundaries (what they must not do)
- Use the minimal tool set required
- Prefer read‑only tools for review agents

Avoid:

- “Generic helper” agents
- Overlapping agent responsibilities
- Implicit permissions
