---
agent: agent
description: Perform a structured code review according to copilot-hub project standards
---

## Code Review

Perform a detailed code review for the provided code or diff. Apply the project-specific standards for **copilot-hub** — a shared library of GitHub Copilot templates, collections, CLI plugins, and TypeScript tooling.

## Review Focus

### 1. YAML Frontmatter
- For `.instructions.md`: Is `description` present? Is `applyTo` set (scoped) or absent (global)?
- For `.prompt.md`: Are `agent` and `description` present?
- For `.agent.md`: Are `name`, `description`, and `target` present?
- Is metadata complete and accurate?

### 2. Repository Structure
- Does the file fit within the established structure?
  - `templates/agents/` — `.agent.md`
  - `templates/prompts/` — `.prompt.md`
  - `templates/instructions/` — `.instructions.md`
  - `plugins/<name>/` — `plugin.config.yml`, `agents/`, `skills/`
  - `src/` — TypeScript generators with Vitest tests
  - `docs/` — Concepts, guides, best practices, checklists
- Is naming `kebab-case` and descriptive of purpose?

### 3. Reusability
- Are templates technology-agnostic and generic enough for broad usage?
- No hardcoded org names, repo URLs, internal references, or secrets.
- One clear purpose per file — no mixed concerns.

### 4. Plugins (`plugin.config.yml`)
- Do agent `source` paths exist in the plugin's `agents/` folder?
- Do skill `source` references point to valid agent files?
- Is `plugin.json` left untouched? (It is auto-generated — never edit manually.)

### 5. TypeScript (`src/`)
- Is type safety maintained? (No `any` without justification.)
- Do new generators have corresponding Vitest tests in `*.test.ts`?
- Does `npm test` pass? Does `npm run build` compile without errors?

### 6. Documentation (`docs/`)
- Are internal links valid and pointing to existing files?
- Are new template types or significant features documented?

## Do NOT flag

- Minor Markdown formatting (blank lines, list style)
- Line length in documentation
- Prose style preferences
- Ordering of frontmatter keys

## Response Format

Return feedback as a prioritized list. For each finding, provide:

1. **Description**: What is the issue or observation?
2. **Category**: Which review focus area does it relate to?
3. **Recommendation**: How to fix or improve it (with a short example if helpful).
4. **Severity**: Critical, Warning, or Info.

Use the following priority markers:

- 🔴 **Critical**: Must be fixed before merge (broken references, missing required frontmatter, secrets in templates).
- 🟡 **Warning**: Recommended changes for correctness or reusability.
- 🟢 **Info/Praise**: Positive aspects or minor suggestions.

Code or diff to review:
${input:code:Paste the code or diff to review}
