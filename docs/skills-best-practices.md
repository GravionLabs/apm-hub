# Agent Skills — Best Practices

> **Reference**: [agentskills.io](https://agentskills.io/home) · [Specification](https://agentskills.io/specification) · [Best practices](https://agentskills.io/skill-creation/best-practices) · [Optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)
> · [GitHub Copilot — Add skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills) · [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)

---

## 1. What is an Agent Skill?

An Agent Skill is a folder containing a `SKILL.md` file. It packages procedural knowledge, domain context, reusable scripts, templates, and reference material into a portable, version-controlled unit that AI agents load on demand.

### Progressive Disclosure — how agents load a skill

| Stage                       | What loads                                      | Token budget               |
| :-------------------------- | :---------------------------------------------- | :------------------------- |
| **Discovery** (startup)     | `name` + `description` only                     | ~100 tokens                |
| **Activation** (task match) | Full `SKILL.md` body                            | < 5,000 tokens recommended |
| **Execution** (on demand)   | Files from `scripts/`, `references/`, `assets/` | as needed                  |

Agents only read the full instructions when the skill is relevant. Scripts and reference files are loaded even more lazily — only when the agent is explicitly instructed to use them.

> **Skills and the context window**
>
> Skills do **not** expand the agent's context window — they compete for it. Once a skill activates, its full `SKILL.md` body occupies the same context window as the conversation history, system prompt, tool results, and all other active skills. Every token in your skill displaces other content the agent might need. Progressive disclosure is designed specifically to minimise this cost: only the metadata of inactive skills (~100 tokens each) sits in the window at startup; the bulk of instructions loads only when a skill is actually relevant.
>
> Practical consequence: keep skills focused, keep them short, and move rarely-needed detail to `references/` with explicit load instructions.

---

## 2. Directory Structure

```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: supplementary documentation
├── assets/           # Optional: templates, images, data files
└── ...               # Any additional files or directories
```

- The **directory name** must exactly match the `name` field in frontmatter.
- `SKILL.md` is the **only required file**. All other directories are optional.
- Store skills in one of the recognised locations (see §10).

---

## 3. `SKILL.md` Format

A `SKILL.md` file **must** contain YAML frontmatter followed by a Markdown body:

```markdown
---
name: my-skill
description: >
  Performs X. Use this skill when the user needs to Y or Z.
---

## Step-by-step instructions
...
```

---

## 4. Frontmatter Fields

### 4.1 Field overview

| Field           | Required         | Max length  | Description                                               |
| :-------------- | :--------------- | :---------- | :-------------------------------------------------------- |
| `name`          | ✅                | 64 chars    | Unique identifier. Must match the directory name.         |
| `description`   | ✅                | 1,024 chars | What the skill does and when to use it.                   |
| `license`       | ❌                | —           | License name or reference to a bundled license file.      |
| `compatibility` | ❌                | 500 chars   | Environment requirements (OS packages, network, runtime). |
| `metadata`      | ❌                | —           | Arbitrary key-value map for additional properties.        |
| `allowed-tools` | ❌ (experimental) | —           | Space-separated list of pre-approved tools.               |

---

### 4.2 `name` field

**Required.**

```yaml
name: github-actions-failure-debugging
```

The `name` follows **kebab-case** conventions: all lowercase, words separated by single hyphens, no spaces or special characters.

Rules:
- **1–64 characters**.
- Only **lowercase letters (`a-z`)**, **digits (`0-9`)**, and **hyphens (`-`)**.
- Must **not** start or end with a hyphen.
- Must **not** contain consecutive hyphens (`--`).
- Must **match the parent directory name** exactly.

**Good names:**

| Name                      | Why it works                   |
| :------------------------ | :----------------------------- |
| `pdf-extraction`          | Short, lowercase, kebab-case   |
| `github-actions-debugger` | Descriptive, clear domain      |
| `csv-data-analysis`       | Action + subject, no ambiguity |
| `db-migration-runner`     | Concise, readable              |

**Bad names:**

| Name                                                              | Problem                               |
| :---------------------------------------------------------------- | :------------------------------------ |
| `PDFExtraction`                                                   | Uppercase letters not allowed         |
| `pdf_extraction`                                                  | Underscores not allowed — use hyphens |
| `my skill`                                                        | Spaces not allowed                    |
| `-invalid-start`                                                  | Must not start with a hyphen          |
| `invalid-end-`                                                    | Must not end with a hyphen            |
| `my--skill`                                                       | Consecutive hyphens not allowed       |
| `this-skill-name-is-way-too-long-and-exceeds-the-64-char-limit-x` | Exceeds 64 characters                 |

---

### 4.3 `description` field

**Required.**

Use YAML's folded scalar (`>`) for multi-sentence descriptions — it collapses newlines into spaces, keeping the YAML readable without affecting the string value:

```yaml
description: >
  Debugs failing GitHub Actions workflows. Use this skill when asked to
  investigate or fix CI/CD failures, even if the user does not mention
  GitHub Actions explicitly.
```

#### Three-part structure

Write descriptions following this formula:

| Part                 | Purpose                                     | Example                                                           |
| :------------------- | :------------------------------------------ | :---------------------------------------------------------------- |
| **What it does**     | One sentence: the action the skill performs | "Debugs failing GitHub Actions workflows."                        |
| **When to use it**   | Imperative: "Use this skill when…"          | "Use this skill when asked to investigate or fix CI/CD failures…" |
| **Key capabilities** | Specific keywords and indirect triggers     | "…even if the user does not mention GitHub Actions explicitly."   |

All three parts are important for accurate triggering. Agents match against the description at startup — if "when to use it" is missing, the skill won't activate at the right time; if "key capabilities" is missing, near-miss prompts may over-trigger.

#### Rules
- **1–1,024 characters** (hard limit enforced by the specification).
- Use `>` (folded scalar) for any description spanning more than one sentence.
- Include **indirect trigger phrasing**: "even if the user does not mention X explicitly."
- **Do not** make the description so broad that the skill activates for unrelated tasks.

> See §9 for in-depth guidance on description optimisation and testing.

---

### 4.4 `license` field

**Optional.**

```yaml
license: MIT
# or:
license: See LICENSE file
```

Keep it short: either the SPDX license identifier or the name of a bundled file.

---

### 4.5 `compatibility` field

**Optional.**

```yaml
compatibility: Requires Python 3.11+, uv, and network access to api.example.com
```

Rules:
- **1–500 characters** if provided.
- Include only if your skill has **specific environment requirements**.
- State required system packages, runtimes, or network access.

---

### 4.6 `metadata` field

**Optional.**

```yaml
metadata:
  acme-team: backend
  acme-version: "2.1"
```

Rules:
- A **flat map** of string keys to string values.
- Make key names reasonably unique (e.g., prefix with your org name) to avoid conflicts.
- No schema is enforced; agent clients may ignore unknown keys.

---

### 4.7 `allowed-tools` field

**Optional. Experimental.**

```yaml
allowed-tools: execute read edit search codebase editFiles runCommands
```

Rules:
- A **space-separated** string of tool identifiers.
- Pre-approves those tools so the agent does not ask for confirmation on each use.
- ⚠️ **Only pre-approve `execute` / `shell` / `bash` if you have fully reviewed all bundled scripts and trust the skill source.** Pre-approval removes the confirmation step, allowing attacker-controlled content to execute arbitrary commands.
- Support varies between agent implementations — unrecognised identifiers are ignored.

#### Tool identifier reference

Tool names are platform-specific. Use the **primary alias** (from [GitHub Copilot custom agents docs](https://docs.github.com/en/copilot/reference/custom-agents-configuration#tool-aliases)) where possible, and add platform-specific identifiers alongside it to maximise coverage.

| Identifier     | Platform                      | Purpose                                                                   |
| :------------- | :---------------------------- | :------------------------------------------------------------------------ |
| **`execute`**  | Cloud Agent (primary alias)   | Execute shell commands; compatible aliases: `shell`, `Bash`, `powershell` |
| **`read`**     | Cloud Agent (primary alias)   | Read file contents; compatible alias: `Read`                              |
| **`edit`**     | Cloud Agent (primary alias)   | Edit/create files; compatible aliases: `Edit`, `Write`                    |
| **`search`**   | Cloud Agent (primary alias)   | Search files and text; compatible aliases: `Grep`, `Glob`                 |
| **`web`**      | Cloud Agent (primary alias)   | Fetch URLs / web search; compatible aliases: `WebSearch`, `WebFetch`      |
| `shell`        | Copilot CLI (permission kind) | Shell command execution (also a Cloud Agent alias for `execute`)          |
| `write`        | Copilot CLI (permission kind) | File write access (also a Cloud Agent alias for `edit`)                   |
| `codebase`     | VS Code Copilot               | Semantic codebase search                                                  |
| `editFiles`    | VS Code Copilot               | Create and edit files                                                     |
| `runCommands`  | VS Code Copilot               | Execute terminal commands                                                 |
| `mcp_github_*` | All platforms                 | GitHub MCP server tools (wildcard)                                        |

#### Recommendation: targeting all platforms

Since unrecognised identifiers are silently ignored, you can safely list identifiers for multiple platforms. Each platform picks the identifiers it recognises.

**For Cloud Agent + Copilot CLI only:**
```yaml
allowed-tools: execute read edit search
```

**For all three targets (Cloud Agent + Copilot CLI + VS Code):**
```yaml
allowed-tools: execute read edit search codebase editFiles runCommands
```

---

## 5. Body Content

The Markdown body is the full instruction set for the agent. It loads entirely when the skill is activated.

### 5.1 Length limits

| Limit  | Recommended |
| :----- | :---------- |
| Lines  | < 500       |
| Tokens | < 5,000     |

These limits exist because a skill's body loads **in full** into the same context window as everything else the agent is working with. Every token you add to `SKILL.md` directly displaces conversation history, tool results, and other active skills. Exceeding these limits doesn't cause an error, but it degrades the agent's ability to track what matters.

If a skill legitimately requires more, move detailed content to `references/` files and tell the agent exactly when to load each file.

### 5.2 Recommended structure

```markdown
## Overview / Goal
Brief description of the skill's purpose (1–3 sentences).

## Prerequisites
Tools, environment variables, or files that must exist before starting.

## Instructions / Workflow
Numbered, step-by-step procedure. Be prescriptive where fragility demands it.

## Gotchas
Environment-specific facts the agent would get wrong without being told.

## Available scripts
Bullet list of scripts in scripts/ with a one-line description each.

## Output format
Template or description of the expected output.
```

Not every skill needs all sections. Include only what is genuinely useful.

### 5.3 What to include

✅ **Include:**
- Project-specific conventions the agent cannot infer
- Domain-specific procedures and workflows
- Non-obvious edge cases (gotchas)
- The specific tools, APIs, or libraries to use
- Output format templates
- Explicit validation steps

❌ **Omit:**
- General knowledge the agent already has (e.g., what a PDF is, how HTTP works)
- Advice that is generic and vague ("handle errors appropriately")
- Every possible edge case — let the agent use its own judgement for the long tail

Ask yourself: *"Would the agent get this wrong without this instruction?"* If no — cut it.

---

## 6. `scripts/` Directory

Contains executable code the agent can run as part of the skill's workflow.

### 6.1 When to bundle a script

Bundle a script in `scripts/` when:
- The same logic appears in multiple steps or across test runs.
- The command is complex enough that getting it right manually on each run is unreliable.
- You need reproducible, testable logic.

For simple, one-off invocations of existing tools, prefer referencing them directly (e.g., `uvx ruff@0.8.0 check .`).

### 6.2 Referencing scripts from `SKILL.md`

Use **relative paths from the skill root**:

```markdown
## Available scripts

- **`scripts/validate.sh`** — Validates configuration files against the schema
- **`scripts/process.py`** — Processes input data and produces a JSON report

## Workflow

1. Run the validation script:
   ```bash
   bash scripts/validate.sh "$INPUT_FILE"
   ```
2. Process the results:
   ```bash
   python3 scripts/process.py --input results.json
   ```
```

### 6.3 Self-contained scripts (inline dependencies)

Prefer scripts that declare their own dependencies inline, so the agent can run them without a separate install step:

**Python (PEP 723 — run with `uv run`):**
```python
# /// script
# dependencies = ["requests>=2.31"]
# requires-python = ">=3.11"
# ///
import requests
...
```

**Deno:**
```typescript
import * as cheerio from "npm:cheerio@1.0.0";
```

**Bun:**
```typescript
import * as cheerio from "cheerio@1.0.0";
```

Pin versions explicitly for reproducibility.

### 6.4 Script design rules for agentic use

| Rule                                     | Reason                                                                                                                      |
| :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **No interactive prompts**               | Agents run in non-interactive shells; a blocking prompt hangs indefinitely. Accept all input via flags, env vars, or stdin. |
| **Implement `--help`**                   | The agent reads `--help` output to learn the script's interface. Include description, flags, and examples.                  |
| **Write helpful error messages**         | On error, state what went wrong, what was expected, and what to try next.                                                   |
| **Use structured output (JSON/CSV/TSV)** | Structured formats are composable with other tools (`jq`, `cut`, `awk`).                                                    |
| **Separate data from diagnostics**       | Write structured data to **stdout**, progress/warnings to **stderr**.                                                       |
| **Handle edge cases gracefully**         | Return a non-zero exit code and a meaningful message — not a Python traceback.                                              |
| **Document dependencies**                | State prerequisites in `SKILL.md` (or use the `compatibility` frontmatter field).                                           |

---

## 7. `references/` Directory

Contains supplementary documentation the agent loads **on demand** — not automatically.

### 7.1 When to use `references/`

Move content to `references/` when:
- It is needed only in specific scenarios (e.g., error handling, advanced configuration).
- It would push `SKILL.md` beyond the 500-line / 5,000-token limit.
- It is reference material rather than procedural instructions.

### 7.2 File naming conventions

```
references/
├── REFERENCE.md      # General technical reference
├── api-errors.md     # Error codes and their remedies
├── schema.yaml       # Data schema (can be non-Markdown)
├── FORMS.md          # Form templates or structured data formats
└── domain-topic.md   # Domain-specific files (finance.md, legal.md, …)
```

Keep individual files focused. Agents load them into the context window; smaller files waste less context.

### 7.3 Telling the agent when to load a reference

Be explicit — use conditional instructions rather than a generic "see references/":

```markdown
If the API returns a non-200 status code, read `references/api-errors.md`
to identify the cause and the recommended remediation.
```

This is more useful than:
```markdown
<!-- too vague — the agent may not know when to act -->
See references/ for details.
```

### 7.4 File reference rules

- Use **relative paths from the skill root**: `references/api-errors.md`.
- Keep reference chains **one level deep** — avoid nested chains where file A references file B which references file C.

---

## 8. `assets/` Directory

Contains static resources used during skill execution.

```
assets/
├── report-template.md    # Output document template
├── config-template.yaml  # Configuration template
├── architecture.png      # Diagram referenced from instructions
└── lookup-table.csv      # Data file (exchange rates, error codes, …)
```

**When to use `assets/` vs `references/`:**

|                | `references/`             | `assets/`                                 |
| :------------- | :------------------------ | :---------------------------------------- |
| Content type   | Documentation, prose      | Templates, binary/structured data, images |
| Typical format | Markdown                  | Any format                                |
| Purpose        | Agent reads to understand | Agent uses to produce output              |

For output format templates, short templates can live inline in `SKILL.md`; longer ones belong in `assets/` — reference them explicitly so the agent only loads them when needed.

---

## 9. Writing Effective Descriptions

The `description` field determines whether a skill activates. It carries the entire burden of triggering. See the [official optimizing-descriptions guide](https://agentskills.io/skill-creation/optimizing-descriptions) for a systematic approach to testing and improving descriptions.

### 9.1 Three-part formula

Write every description using this formula:

```
[What it does] + [When to use it] + [Key capabilities / indirect triggers]
```

```yaml
# What it does: "Analyzes spreadsheet and CSV data."
# When to use it: "Use this skill when the user wants to explore, transform,
#   visualize, or summarize data from a file"
# Key capabilities / indirect triggers: "even if they don't explicitly mention
#   'CSV' or 'data analysis.'"

description: >
  Analyzes spreadsheet and CSV data. Use this skill when the user wants to
  explore, transform, visualize, or summarize data from a file — even if they
  don't explicitly mention "CSV" or "data analysis."
```

### 9.2 Principles

1. **Use imperative phrasing**: "Use this skill when…" not "This skill does…"
2. **Focus on user intent**, not internal mechanics.
3. **Be specific**: list the contexts and scenarios where the skill applies.
4. **Be explicit about indirect triggers**: "even if the user does not mention X explicitly."
5. **Stay concise**: a few sentences to a short paragraph is ideal. Hard limit: 1,024 characters.
6. **Use `>` (folded scalar)** for any description spanning more than one sentence.

**Too vague:**
```yaml
description: Helps with data tasks.
```

**Better:**
```yaml
description: >
  Analyzes spreadsheet and CSV data. Use this skill when the user wants to
  explore, transform, visualize, or summarize data from a file — even if they
  don't explicitly mention "CSV" or "data analysis."
```

### 9.3 Testing descriptions (eval queries)

Create ~20 test prompts: 8–10 that _should_ trigger the skill, 8–10 that _should not_.

**Should-trigger queries** — vary along:
- Phrasing (formal vs. casual vs. typos)
- Explicitness (names the domain vs. describes the need without naming it)
- Detail (terse prompt vs. long context-heavy request)

**Should-not-trigger queries** — use near-misses (same keywords, different intent):

| ❌ Weak negative              | ✅ Strong negative                                                 |
| :--------------------------- | :---------------------------------------------------------------- |
| "Write a fibonacci function" | "Write a Python script to read a CSV and upload rows to Postgres" |
| "What's the weather today?"  | "Update the formulas in my Excel budget spreadsheet"              |

Run each query multiple times (nondeterministic models); compute a **trigger rate**. A should-trigger query passes if trigger rate > 0.5; a should-not-trigger query passes if trigger rate < 0.5.

---

## 10. Patterns for Effective Instructions

### 10.1 Gotchas section

List environment-specific facts the agent would get wrong without explicit instructions:

```markdown
## Gotchas

- The `users` table uses soft deletes. Always add `WHERE deleted_at IS NULL`.
- `user_id` in the database = `uid` in the auth service = `accountId` in billing.
- `GET /health` returns 200 even when the database is down. Use `GET /ready`.
```

Keep gotchas in `SKILL.md` — not in a reference file — so the agent reads them before it can encounter the situation.

### 10.2 Output format templates

Provide a concrete template rather than describing the format in prose:

```markdown
## Report structure

Use this template:

```markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
```
```

For short templates: inline in `SKILL.md`. For long templates or templates only needed sometimes: store in `assets/` and reference conditionally.

### 10.3 Checklists for multi-step workflows

```markdown
## Workflow progress

- [ ] Step 1: Analyze form (`scripts/analyze_form.py`)
- [ ] Step 2: Create field mapping (`fields.json`)
- [ ] Step 3: Validate mapping (`scripts/validate_fields.py`)
- [ ] Step 4: Fill form (`scripts/fill_form.py`)
- [ ] Step 5: Verify output (`scripts/verify_output.py`)
```

Checklists help the agent track progress and avoid skipping validation gates.

### 10.4 Validation loops

```markdown
## Editing workflow

1. Make your edits.
2. Run validation: `python scripts/validate.py output/`
3. If validation fails, fix the issues and re-run.
4. Only proceed when validation passes with zero errors.
```

### 10.5 Plan-validate-execute (for destructive or batch operations)

```markdown
## Migration workflow

1. Extract the plan: `python scripts/analyze.py input/ > plan.json`
2. Validate the plan: `python scripts/validate_plan.py plan.json`
   (checks all targets exist, types are compatible, required fields are present)
3. If validation fails, revise `plan.json` and re-validate.
4. Execute: `python scripts/execute.py plan.json`
```

The validation step prevents irreversible mistakes by checking the plan against a source of truth before execution.

---

## 11. Calibrating Control

Not every instruction needs the same level of prescriptiveness.

### 11.1 When to give the agent freedom

When multiple approaches are valid and results tolerate variation, explain _why_ rather than dictating exact steps:

```markdown
## Code review process

1. Check all database queries for SQL injection (use parameterised queries).
2. Verify authentication checks on every endpoint.
3. Look for race conditions in concurrent code paths.
4. Confirm error messages do not leak internal details.
```

### 11.2 When to be prescriptive

When the operation is fragile, consistency is critical, or a specific sequence must be followed:

```markdown
## Database migration

Run exactly this sequence:

```bash
python scripts/migrate.py --verify --backup
```

Do not modify the command or add additional flags.
```

### 11.3 Providing defaults instead of options

Presenting multiple equal options forces the agent to choose and increases the chance of an incorrect choice.

**Too many options:**
```markdown
You can use pypdf, pdfplumber, PyMuPDF, or pdf2image...
```

**Clear default with escape hatch:**
```markdown
Use pdfplumber for text extraction:

```python
import pdfplumber
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

---

## 12. Anti-patterns to Avoid

| Anti-pattern                                     | Problem                                                    | Fix                                                                      |
| :----------------------------------------------- | :--------------------------------------------------------- | :----------------------------------------------------------------------- |
| Generic LLM-generated skill with no real context | Produces vague, unhelpful instructions                     | Ground the skill in real tasks, actual code, or project-specific docs    |
| Explaining things the agent already knows        | Wastes context; dilutes important instructions             | Cut anything the agent handles correctly without the skill               |
| Overly broad scope                               | Skill activates for unrelated tasks; instructions conflict | Split into focused skills, each covering a coherent unit of work         |
| Overly narrow scope                              | Multiple skills must load simultaneously                   | Merge closely related workflows into one skill                           |
| Reference chains deeper than one level           | Hard to follow; risks context overload                     | Keep all file references one level deep                                  |
| Interactive prompts in scripts                   | Script hangs waiting for input the agent cannot provide    | Accept all input via flags, env vars, or stdin                           |
| Vague error messages in scripts                  | Agent can't self-correct; wastes turns                     | State what went wrong, what was expected, and what to try next           |
| Listing equal alternatives for tools/libraries   | Agent makes arbitrary choices                              | Pick one default; mention alternatives briefly as fallbacks              |
| Instructions specific to one concrete task       | Skill not reusable                                         | Write reusable procedures; keep specific details in templates or gotchas |

---

## 13. Validation

Use the [`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref) reference library to validate a skill:

```bash
skills-ref validate ./my-skill
```

This checks:
- Frontmatter is valid YAML
- Required fields (`name`, `description`) are present
- `name` matches the directory name and follows naming conventions
- Field values are within length limits

---

## 14. Skill Storage Locations

Agents discover skills from the following directories:

| Scope                          | Directories                                                    |
| :----------------------------- | :------------------------------------------------------------- |
| **Project** (single repo)      | `.github/skills/`, `.claude/skills/`, `.agents/skills/`        |
| **Personal** (across projects) | `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` |

Each skill must be in its own subdirectory. Subdirectory name must match the `name` field in `SKILL.md`.

---

## Quick-reference checklist

```
[ ] name: lowercase, hyphens only, 1-64 chars, matches directory, no leading/trailing/consecutive hyphens
[ ] description: 1-1024 chars, imperative phrasing, includes trigger contexts and keywords
[ ] body: < 500 lines, < 5,000 tokens
[ ] body: add only what the agent wouldn't know on its own
[ ] gotchas section present for non-obvious environment facts
[ ] scripts: no interactive prompts, --help implemented, structured output, helpful errors
[ ] references: conditional load instructions ("if X, read references/Y.md")
[ ] file references: relative paths, one level deep
[ ] allowed-tools: only added if source is fully trusted
[ ] skills-ref validate passes
```
