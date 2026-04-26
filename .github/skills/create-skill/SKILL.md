---
name: create-skill
description: >
  Creates a complete agent skill from a user-provided description or prompt. Use this
  skill when asked to build, scaffold, or generate a new skill — even if the user only
  provides a rough idea, domain name, or workflow description.
allowed-tools: execute read edit search codebase editFiles runCommands
---

## Overview

Scaffold a new skill directory conforming to the agentskills.io specification.

## Prerequisites

- Know the intended skill name (kebab-case) or derive one from the user's description
- Know the target location: `.github/skills/`, `.claude/skills/`, or `~/.copilot/skills/`

## Instructions

### Phase 1 — Gather requirements

1. Ask for (or derive from context): skill name, purpose, target domain
2. Determine what companion files are needed:
   - **`scripts/`** — if the workflow involves complex, repeated, or failure-prone commands
   - **`references/`** — if the skill needs specs, error catalogs, schemas, or long tables
   - **`assets/`** — if the skill produces output from templates or uses data files
3. Read `references/frontmatter-schema.md` to validate the name and plan the description

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
- `allowed-tools`: space-separated; do not pre-approve `shell`/`bash` unless all scripts are reviewed
- `model`: include only if a specific model capability is needed (e.g. complex reasoning)

Body rules — read `references/skill-best-practices-summary.md` now:
- Keep the body under 500 lines / 5,000 tokens
- Include only what the agent would not know without it
- Use a gotchas section for non-obvious environment facts
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
```

## Gotchas

- The directory name **must** match the `name` frontmatter field exactly — case-sensitive.
- Do not pre-approve `shell` or `bash` in `allowed-tools` unless you have reviewed all bundled scripts.
- Prefer one default tool/library with a brief fallback over listing equal alternatives.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
