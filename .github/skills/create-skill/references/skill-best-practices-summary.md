## Skill Best Practices — Body, Scripts, References, Assets

### Body content rules

**Length limits:**
- < 500 lines
- < 5,000 tokens

Every token in `SKILL.md` displaces conversation history and other active skills in the context window. Keep the body focused. Move rarely-needed detail to `references/`.

**Recommended body structure:**

```
## Overview / Goal        (1–3 sentences)
## Prerequisites          (tools, env vars, files that must exist)
## Instructions           (numbered, step-by-step workflow)
## Gotchas                (things the agent would get wrong without explicit guidance)
## Available scripts      (bullet list of scripts/ with one-line descriptions)
## Output format          (template or description)
```

Include only sections that are genuinely useful for the skill. Omit empty sections.

**What to include:**
- Project-specific conventions the agent cannot infer
- Non-obvious edge cases and environment quirks (gotchas)
- The specific tools, APIs, or libraries to use (with defaults, not equal alternatives)
- Output format templates
- Explicit validation steps

**What to omit:**
- General knowledge the agent already has (HTTP basics, what a CSV is, etc.)
- Generic, vague advice ("handle errors appropriately")
- Long lists of every possible edge case

Ask: *"Would the agent get this wrong without this instruction?"* — if no, cut it.

---

### `scripts/` rules

Bundle a script when the same logic repeats, or manual execution is unreliable.

| Rule | Reason |
|------|--------|
| No interactive prompts | Agents run in non-interactive shells — a blocking prompt hangs indefinitely |
| Implement `--help` | The agent reads `--help` output to learn the script's interface |
| Write helpful error messages | State what went wrong, what was expected, and what to try next |
| Structured output (JSON/CSV/TSV) | Composable with `jq`, `cut`, etc. |
| Data to **stdout**, diagnostics to **stderr** | Keeps output clean for piping |
| Non-zero exit on error | Allows the agent to detect failures reliably |

Prefer self-contained scripts with inline dependencies:

```python
# Python (PEP 723 — run with `uv run`):
# /// script
# dependencies = ["requests>=2.31"]
# requires-python = ">=3.11"
# ///
```

Reference scripts from `SKILL.md` using relative paths from the skill root:

```markdown
Run the validation script:
```bash
bash scripts/validate.sh "$INPUT_FILE"
```
```

---

### `references/` rules

Content for on-demand loading — not loaded automatically.

Move content to `references/` when:
- It is needed only in specific scenarios
- It would push `SKILL.md` beyond 500 lines / 5,000 tokens
- It is reference material (specs, error codes, schemas) rather than procedural steps

Tell the agent **when** to load a reference — use conditional instructions:

```markdown
✅ If the API returns a non-200 status, read `references/api-errors.md` to identify the cause.
❌ See references/ for details.   ← too vague
```

File naming:
```
references/REFERENCE.md   # General technical reference
references/api-errors.md  # Error codes and remedies
references/schema.yaml    # Data schema (can be non-Markdown)
```

Rules:
- Use relative paths from the skill root: `references/api-errors.md`
- Keep reference chains **one level deep** — no A → B → C chains

---

### `assets/` rules

Static resources used during skill execution (templates, binary/structured data, images).

| | `references/` | `assets/` |
|--|--------------|----------|
| Content type | Documentation, prose | Templates, binary/structured data, images |
| Typical format | Markdown | Any format |
| Purpose | Agent reads to understand | Agent uses to produce output |

Short output templates can live inline in `SKILL.md`. Long templates belong in `assets/` — reference them conditionally.

---

### Effective instruction patterns

**Gotchas section** — keep in `SKILL.md` so the agent reads them before encountering the situation:
```markdown
## Gotchas
- The `users` table uses soft deletes. Always add `WHERE deleted_at IS NULL`.
```

**Output format template** — provide a concrete template, not prose description:
```markdown
## Output format
Use this template:
# [Title]
## Summary
[One paragraph]
## Findings
- Finding 1
```

**Calibrating prescriptiveness:**
- Give the agent freedom when multiple valid approaches exist and results tolerate variation
- Be prescriptive when the operation is fragile or a specific sequence is required
- Provide one default tool/library with a brief fallback, not equal alternatives

---

### Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Generic content with no real context | Ground in real tasks, actual code, or project-specific docs |
| Explaining things the agent already knows | Cut it |
| Overly broad scope | Split into focused skills |
| Overly narrow scope | Merge closely related workflows |
| Reference chains deeper than one level | Keep all file references one level deep |
| Interactive prompts in scripts | Accept all input via flags, env vars, or stdin |
| Vague error messages in scripts | State what went wrong, what was expected, what to try next |
| Listing equal alternatives | Pick one default; mention alternatives briefly as fallbacks |
| Instructions specific to one concrete task | Write reusable procedures; put specifics in templates or gotchas |
