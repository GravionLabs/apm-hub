---
name: skill-create
description: >
  Creates a complete agent skill. Use this skill when building or scaffolding a
  new skill from a prompt, rough idea, or domain name, even if the request is
  underspecified.
allowed-tools: read search codebase write edit editFiles
---

## Overview

Create the smallest skill that still captures the required workflow.

## Prerequisites

- Skill name
- Target location and domain
- Read `references/frontmatter-schema.md`

## Instructions

1. Pick the location:
   - Use `packages/<domain>/.apm/skills/<name>/` for domain workflows.
   - Use `.github/skills/<name>/` only for repo-level skill tooling.
   - If no package fits, create one with `apm.yml`.
2. Validate the name: kebab-case, 1-64 chars, matches the directory.
3. Create `SKILL.md` first; add `scripts/`, `references/`, or `assets/` only if they reduce repeated context.
4. Write frontmatter:
   - `name`
   - `description`: imperative, specific triggers, ≤1,024 chars
   - `allowed-tools`: use the shared matrix; avoid shell access unless reviewed commands require it
5. Keep the body compact:
   - Overview
   - Prerequisites
   - Instructions
   - Gotchas
   - Output format
   - Use `If X → do Y; otherwise do Z` for conditional behavior.
   - Load references only when needed.
   - Move long specs/tables to `references/` and long templates to `assets/`.
6. If scripts are needed, make them flag-based, `--help` enabled, stdout-data/stderr-diagnostics, and non-zero on error.
7. Final validation: name matches directory, description is specific, body stays focused, and references are only loaded conditionally.

## Gotchas

- Directory name must match `name` exactly.
- Use ` ```powershell ` for shell blocks.
- Do not pre-approve `execute`, `shell`, or `runCommands` unless the commands are safe and necessary.
