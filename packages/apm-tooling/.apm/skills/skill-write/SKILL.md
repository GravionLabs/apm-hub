---
name: skill-write
description: >
  Creates and edits opencode and Copilot skills. Use this skill when drafting or
  refining a skill so the result stays small, valid, reusable, and
  convention-compliant.
metadata:
  chronicle-hints: 'single-purpose, structured-output, phases'
---

## Prerequisites

- Skill path (or the domain and name for a new skill)
- Read `references/skill-writing-rules.md` — apply it throughout
- For a new skill, start from `assets/skill-template-optimized.md`

## Instructions

### 1. Plan and validate

1. Pick the location: `packages/<domain>/.apm/skills/<name>/` for domain workflows; `.github/skills/<name>/` only for repo-level tooling. If no package fits, create one with `apm.yml`.
2. Validate the name: kebab-case, 1-64 chars, matches the directory, no leading, trailing or consecutive hyphens.

### 2. Create and structure

3. Create `SKILL.md` first; add `scripts/`, `references/` or `assets/` only if they reduce repeated context.
4. Frontmatter: `name` and `description` only, plus optional `license` and `metadata`. Never add `allowed-tools`, `model`, `compatibility` or any other top-level key.
5. Body: short overview, numbered instructions, gotchas, and a one-line report format. Stay ≤ 100 lines.

### 3. Validate

6. All shell blocks use ` ```powershell `.
7. Scripts (if any): flag-based, `--help`, data on stdout, diagnostics on stderr, non-zero on error.
8. Final check: name matches directory, description says when to use it, references are conditional, nothing duplicated across body and references.

## Gotchas

- Directory name must match `name` exactly
- Don't duplicate rules across the body and references
- Keep reference chains one level deep

Report: summary, files created or changed, and the `skill-audit` command to verify.
