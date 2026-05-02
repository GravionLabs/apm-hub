---
name: skill-update
description: >
  Applies improvements from a skill audit to an existing skill. Use this skill when
  audit findings are ready to be applied — after running skill-audit or when the user
  provides a list of improvements. Works best when audit-report.md exists in the skill
  directory.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
---

## Overview

Process a skill audit report and apply all recommended improvements to the skill.

## Prerequisites

- The skill directory path (ask if not provided)
- `audit-report.md` in the skill directory — or explicit findings from the user

## Instructions

### Phase 1 — Load findings

1. Check for `{skill-dir}/audit-report.md`
   - If found: read it and parse all findings by severity
   - If not found: ask the user to either run `skill-audit` first or provide the findings directly
2. List all existing files in `{skill-dir}/` before making any changes

### Phase 2 — Apply fixes (critical first, then important, then suggestions)

Process findings in severity order: 🔴 → 🟡 → 🟢.

For each finding, apply the appropriate fix:

**Location issues (🟢):**
- If the skill is in `.github/skills/` but belongs in a domain package:
  1. Identify the correct domain package under `packages/` (or create one with an `apm.yml`)
  2. Move the skill directory: `mv .github/skills/<name> packages/<domain>/.apm/skills/<name>`
  3. Update any references to the old path in config files or other skills
- If the skill is in a domain package but belongs in `.github/skills/` (i.e. it is a meta/tooling skill):
  1. Move the skill directory: `mv packages/<domain>/.apm/skills/<name> .github/skills/<name>`
  2. Update any references to the old path
- Note: location moves are manual operations — confirm with the user before proceeding.

**Name issues (🔴):**
- If `name` frontmatter does not match the directory: update the frontmatter field
- If the directory name itself is invalid (uppercase, underscores, consecutive hyphens): rename the directory with `mv`, then update `name` in `SKILL.md`

**Description issues (🟡):**
- Rewrite to use imperative phrasing: "Use this skill when…"
- Add specific trigger keywords and indirect trigger phrasing
- Trim to stay under 1,024 characters

**Body too long (🟡):**
- Identify content blocks that are reference material (specs, large tables, error codes) rather than procedural steps
- Move them to `references/{topic}.md`
- Replace the inline content with a conditional load instruction: "If X, read `references/{topic}.md`"

**Content should be in assets (🟢):**
- Move long output templates (> ~20 lines) to `assets/{name}.md`
- Replace inline content with a conditional reference

**Content should be in scripts (🟢):**
- Extract complex or repeated commands into `scripts/{name}.sh` (or `.py`)
- Add `--help`, structured stdout, stderr diagnostics, non-zero exit on error
- Update `SKILL.md` to reference the script with the correct relative path

**Reference issues (🟡):**
- Replace vague "see references/" with specific conditional instructions
- Fix absolute paths to relative paths from the skill root
- Break reference chains deeper than one level

**Script issues (🔴/🟡):**
- Interactive prompts: replace `input()` / `read -p` / blocking stdin with flag-based input
- Missing `--help`: add a help handler
- Stdout/stderr confusion: route data to stdout, diagnostics to stderr
- Missing non-zero exit on error: add `sys.exit(1)` / `exit 1` where appropriate

**Decision Flow issues (🟢):**
- Replace vague conditional prose with explicit `If X → do Y; otherwise do Z` blocks
- If the skill uses optional tools (e.g. MCP server), add a tool-availability Decision Flow near the top: `"If [tool] is available → use it; otherwise fall back to [alternative]"`
- If the skill conditionally loads references, replace `"see references/"` with `"If [condition], read references/Y.md"`

**Anti-patterns (🟡/🟢):**
- Generic vague content: rewrite with project-specific context, or remove if redundant
- Equal alternatives: pick one default and move others to a "fallback" note
- Overly broad description: narrow to the specific scenarios the skill handles
- Hardcoded names/URLs: replace with reusable patterns or template placeholders

### Phase 3 — Validate

After applying all fixes, verify:
- `name` frontmatter matches the directory name
- `description` uses imperative phrasing and is ≤ 1,024 chars
- Body is < 500 lines
- All `references/` files have conditional load instructions in `SKILL.md`
- No interactive prompts remain in any scripts

### Phase 4 — Clean up and report

1. Remove or archive `audit-report.md` from the skill directory when all findings are resolved
   - Remove if all findings were addressed
   - Leave in place (with a note) if some findings were intentionally skipped
2. Report what was changed:
   - List each fix applied
   - List any findings skipped and why

## Gotchas

- When renaming a directory, update any references to the skill in `plugin.config.yml` or other config files.
- Do not make changes beyond the scope of the audit findings — this is a targeted fix pass, not a rewrite.
- If a 🟢 suggestion would require significant restructuring, ask the user before applying it.

## Output format

```
Updated: {skill-dir}
  Applied {N} fixes
  Skipped {N} findings (see below)

Changes made:
  - {fix 1}
  - {fix 2}

Skipped:
  - {finding}: {reason}
```
