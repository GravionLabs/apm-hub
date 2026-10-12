---
name: skill-write
description: 'Create or edit a SKILL.md that loads unchanged on Copilot, Claude Code and OpenCode. Use when drafting a skill.'
---

## Prerequisites

- Skill path, or the domain and name for a new skill
- Read `references/skill-writing-rules.md` and apply it throughout
- For a new skill, start from `assets/skill-template-optimized.md`

Paths to `scripts/`, `references/` and `assets/` are relative to this skill's directory.

## Instructions

### 1. Plan and validate

1. Pick the location: `packages/<domain>/.apm/skills/<name>/` for domain workflows; `.github/skills/<name>/` only for repo-level tooling. If no package fits → create one with `apm.yml`.
2. Validate the name: kebab-case, 1-64 chars, matches the directory, no leading, trailing or consecutive hyphens.

### 2. Create and structure

3. Create `SKILL.md` first; add `scripts/`, `references/` or `assets/` only if they reduce repeated context.
4. Frontmatter: `name` and `description` only, plus optional `license` and `metadata`. The only other keys allowed are the client keys in the rules (`disable-model-invocation` paired with `metadata.opencode/autoinvoke: 'false'`, `user-invocable`, `context: fork`, `agent`); add them only when the rules say so.
5. Body: one-sentence overview, numbered instructions, gotchas, one-line report format. Stay ≤ 100 lines.

### 3. Validate

6. All shell blocks use ` ```powershell `.
7. Scripts (if any): flag-based, `--help`, data on stdout, diagnostics on stderr, non-zero on error.
8. Final check: name matches directory, description says when to use it, references are conditional, nothing duplicated across body and references or with another skill.
9. Run `node scripts/check-manifests.mjs --fix` at the repo root so the package `apm.yml` lists the skill.

## Gotchas

- Directory name must match `name` exactly
- Keep reference chains one level deep

Report: summary, files created or changed, and `skill-audit <skill-path>` to verify.
