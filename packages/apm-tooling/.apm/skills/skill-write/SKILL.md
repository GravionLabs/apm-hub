---
name: skill-write
description: >
  Creates and edits opencode and Copilot skills. Use this skill when drafting or
  refining a skill so the result stays small, valid, reusable, and
  convention-compliant.
allowed-tools: read search codebase write edit editFiles
compatibility: opencode, github-copilot
chronicle-hints: 'single-purpose, structured-output, phases'
---

## Overview

Use this skill to keep skill files compact, reusable, and convention-compliant. Skills created with this tool are automatically optimized for:
- **Chronicle**: Session tracking, clear phases, structured output
- **LSP**: Precise code intelligence across languages
- **Context efficiency**: Token-aware patterns for long sessions

**PowerShell is required:** All shell code blocks must use ` ```powershell ` syntax. This is a non-negotiable requirement for cross-platform tooling compatibility.

Avoid verbose reasoning.

## Prerequisites

- Skill path
- Read `references/skill-writing-rules.md` — apply all rules from that file throughout
- Review `assets/skill-template-optimized.md` — use as starting point for new skills
- **PowerShell requirement:** All shell examples in the skill must use PowerShell syntax (` ```powershell `), never Bash or sh
- **Chronicle optimization:** Use the template structure with phases and checkpoints

## Instructions

### Phase 1 — Plan & Validate

1. Pick the location:
   - Use `packages/<domain>/.apm/skills/<name>/` for domain workflows.
   - Use `.github/skills/<name>/` only for repo-level skill tooling.
   - If no package fits, create one with `apm.yml`.
2. Validate the name: kebab-case, 1-64 chars, matches the directory, and has no leading, trailing, or consecutive hyphens.
3. ✓ **Checkpoint:** Skill location and name validated. Ready for Phase 2.

### Phase 2 — Create & Structure

4. Create `SKILL.md` first; add `scripts/`, `references/`, or `assets/` only if they reduce repeated context.
5. Write frontmatter (`name`, `description`, `allowed-tools`, optional `compatibility`, optional repo-local `model`, optional `chronicle-hints`); keep `allowed-tools` minimal and pre-approve shell access only for reviewed commands. If you include `model`, choose it using `docs/model-overview.md` and treat it as advisory repo convention rather than officially required skill syntax. Use `compatibility` to declare platform support (e.g. `compatibility: opencode, github-copilot`).
6. Keep the body compact using standard sections: Overview → Prerequisites → Instructions → Gotchas → Output format.
7. ✓ **Checkpoint:** Frontmatter complete and structure ready. Ready for Phase 3.

### Phase 3 — Optimize & Validate

8. Ensure all shell code blocks use **only** ` ```powershell ` syntax (never Bash or sh).
9. If scripts needed: flag-based, `--help` enabled, data on stdout, diagnostics on stderr, non-zero on error. PowerShell scripts (.ps1) preferred.
10. Final validation:
    - Name matches directory
    - Description is specific and answers "when should I use this?"
    - Any frontmatter `model` is optional, aligned with `docs/model-overview.md`, and not presented as an official required field
    - Any body-level "Model hint" is specific, user-visible, and consistent with frontmatter `model`
    - Body stays focused, no duplication across references
    - References are conditional (loaded only when needed)
    - Output follows Chronicle structure (Summary → What Changed → Verify → Next Steps)
11. ✓ **Checkpoint:** Skill complete and validated. Ready for use.

## Gotchas

- Directory name must match `name` exactly.
- Official GitHub skill docs do not list `model` as a standard frontmatter field; use it only as an explicit repo-local convention.
- Use ` ```powershell ` for shell blocks — this is mandatory, never use Bash or sh.
- Do not duplicate rules across the body and references.
- Keep reference chains one level deep.

## Output Format

### ✅ Summary
Skill `{name}` created at `{path}/SKILL.md` following all conventions.

### 📝 What Changed
- Created: `{path}/SKILL.md` ({lines} lines)
- Created/Updated: `{path}/references/*.md` (if needed)
- Created/Updated: `{path}/assets/*` (if needed)
- Created/Updated: `{path}/scripts/*.ps1` (if needed)

### ✔️ Verify
```powershell
# Check frontmatter syntax
$skill = Get-Content "{path}/SKILL.md" | Select-Object -First 10
Write-Host "Frontmatter valid if contains: name, description, allowed-tools"

# Check structure
$content = Get-Content "{path}/SKILL.md"
if ($content -match "## Overview") { Write-Host "✓ Has Overview section" }
if ($content -match "## Prerequisites") { Write-Host "✓ Has Prerequisites section" }
if ($content -match "## (Instructions|Steps)") { Write-Host "✓ Has Instructions/Steps section" }
```

### 🚀 Next Steps
1. Review skill against `docs/checklists/chronicle-checklist.md`
2. Test with `skill-audit` to validate
3. Publish to appropriate package
4. Add to documentation if domain-specific
