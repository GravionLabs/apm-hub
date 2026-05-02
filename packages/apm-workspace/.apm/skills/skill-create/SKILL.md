---
name: skill-create
description: >
  Creates a complete agent skill from a user-provided description or prompt. Use this
  skill when asked to build, scaffold, or generate a new skill — even if the user only
  provides a rough idea, domain name, or workflow description.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
---

## Overview

Scaffold a new skill directory conforming to the agentskills.io specification.

## Prerequisites

- Know the intended skill name (kebab-case) or derive one from the user's description
- Know the target location: `packages/<domain>/.apm/skills/<skill-name>/` or `.github/skills/<skill-name>/`
- Know the target domain package (see Phase 1 — Domain determination below)

## Instructions

### Phase 1 — Gather requirements

1. Ask for (or derive from context): skill name, purpose, target domain
2. **Determine the target domain** (see sub-section below)
3. Determine what companion files are needed:
   - **`scripts/`** — if the workflow involves complex, repeated, or failure-prone commands
   - **`references/`** — if the skill needs specs, error catalogs, schemas, or long tables
   - **`assets/`** — if the skill produces output from templates or uses data files
4. Read `references/frontmatter-schema.md` to validate the name and plan the description

#### Domain determination

Every skill lives in exactly one of two places:

| Location | When to use |
| -------- | ----------- |
| `packages/<domain>/.apm/skills/<skill-name>/` | Default — the skill serves a specific technology or workflow domain |
| `.github/skills/<skill-name>/` | Only for repo-level meta/tooling skills (e.g. skill-create, skill-audit) that manage skills themselves |

**Step 1 — List existing domain packages**

Scan the `packages/` directory to find all existing domains. Each subdirectory is one domain package. Current packages follow the naming pattern `{category}-{technology-or-function}`:

| Category | Examples |
| -------- | -------- |
| `common` | `common-git`, `common-azuredevops`, `common-ssdlc`, `common-onboarding` |
| `development` | `development-angular-unity`, `development-dotnet-engineer`, `development-pr-review`, `development-workflow` |
| `refinement` | `refinement-work-items` |
| `planning2` | `planning2-task-breakdown` |

**Step 2 — Match or create**

- If the skill's purpose clearly fits an existing domain → place it under `packages/<domain>/.apm/skills/<skill-name>/`.
- If no existing domain fits → create a new package directory (see *New package creation* below).
- If the skill is a meta/tooling skill for managing agent skills → place it in `.github/skills/<skill-name>/`.

**New package creation** — required files when no suitable domain exists:

```
packages/<domain>/
├── apm.yml
└── .apm/
    └── skills/
        └── <skill-name>/
            └── SKILL.md
```

Minimum `apm.yml`:

```yaml
name: <domain>          # must match directory name, kebab-case
version: 0.1.0
description: <one-line summary of the domain>
author: RWEST Generation & Operations
dependencies:
  apm: []
  mcp: []
```

### Phase 2 — Validate the name

- Kebab-case only: `a-z`, `0-9`, `-`
- 1–64 characters; no leading, trailing, or consecutive hyphens
- Must match the directory name you will create

If the user provides an invalid name, suggest a corrected version before proceeding.

### Phase 3 — Create the directory structure

```
{location}/{name}/
├── SKILL.md
├── scripts/          (only if needed)
├── references/       (only if needed)
└── assets/           (only if needed)
```

### Phase 4 — Write `SKILL.md`

Read `references/frontmatter-schema.md` now.

Frontmatter rules (apply strictly):

- `name`: must match the directory name
- `description`: imperative phrasing, specific keywords, 1–1,024 chars
- `allowed-tools`: space-separated; use the cross-platform combination for the capabilities the skill needs. Read `references/frontmatter-schema.md` for the full mapping table.

  | Capability needed      | Add these identifiers       |
  | ---------------------- | --------------------------- |
  | Read/search files      | `read search codebase`      |
  | Edit/create files      | `write edit editFiles`      |
  | Execute shell commands | `execute shell runCommands` |
  | Web fetch              | `web`                       |

  Combine as needed. Example for a skill that reads, edits, and runs commands:

  ```
  allowed-tools: execute shell runCommands read write edit editFiles search codebase
  ```

  Do not pre-approve `execute`/`shell`/`runCommands` unless all bundled scripts are reviewed, or all inline shell commands in the body are confirmed safe.

- `model`: include only if a specific model capability is needed (e.g. complex reasoning)

Body rules — read `references/skill-best-practices-summary.md` now:

- Keep the body under 500 lines / 5,000 tokens
- Include only what the agent would not know without it
- Use a gotchas section for non-obvious environment facts
- Use **Decision Flows** for conditional behaviour: `If X → do Y; otherwise do Z`. Three forms:
  - **Conditional reference loading**: `"If [condition], read references/Y.md"`
  - **Tool availability check**: `"If [tool] is available → use it; otherwise fall back to [alternative]"`
  - **Conditional execution path**: `"If [condition] → take branch A; else take branch B"`
- Move large reference material to `references/` with conditional load instructions
- Move templates > ~20 lines to `assets/`

### Phase 5 — Create companion files (if needed)

**Scripts** — each script must:

- Accept all input via flags (no interactive prompts)
- Implement `--help`
- Write data to stdout, diagnostics to stderr
- Return a non-zero exit code on error
- Declare dependencies inline (PEP 723 for Python)

**References** — each reference file must:

- Be loaded conditionally: "If X, read `references/Y.md`"
- Use relative paths from the skill root

**Assets** — output templates and data files loaded on demand.

### Phase 6 — Final validation

Check against the quick-reference list:

```
[ ] name matches directory, kebab-case, 1-64 chars, no bad hyphens
[ ] description: imperative, 1-1024 chars, specific triggers
[ ] body: < 500 lines, no generic knowledge
[ ] scripts: --help, no interactive prompts, structured output
[ ] references: conditional load instructions in SKILL.md
[ ] domain/location confirmed: existing package used OR new package created with apm.yml
```

## Gotchas

- The directory name **must** match the `name` frontmatter field exactly — case-sensitive.
- Do not pre-approve `execute`, `shell`, or `runCommands` in `allowed-tools` unless you have reviewed all bundled scripts.
- Prefer one default tool/library with a brief fallback over listing equal alternatives.
- **PowerShell is the required shell** — use ` ```powershell ` (not ` ```bash ` or ` ```sh `) for all shell command code blocks. Scripts belong in `.ps1` files.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
