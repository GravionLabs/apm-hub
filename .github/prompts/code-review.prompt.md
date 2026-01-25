---
agent: agent
description: Perform a structured code review according to project standards
---

## Code Review

Perform a detailed code review for the provided code or diff. Consider the project-specific standards defined in this repository.

## Review Focus

### 1. Markdown Standards
- Are the rules from `templates/instructions/markdown.instructions.md` followed?
- No H1 headings (generated from title).
- Correct list formatting (use `-` for bullets, `1.` for numbered lists).
- Line length within 80 characters for readability.
- Proper heading hierarchy (H2 and H3 only).
- YAML frontmatter with required metadata fields.

### 2. Repository Structure
- Does the file fit within the established structure (`docs/`, `templates/`, `examples/`)?
- Is it placed in the appropriate subdirectory (e.g., `templates/prompts/`, `templates/instructions/`)?

### 3. Reusability
- Are templates technology-agnostic and generic enough for broad usage?
- Can the template be adapted across different tech stacks?
- Is the content self-contained and not overly specific to one use case?

### 4. Documentation
- Are internal links correctly formatted and valid?
- Are relevant checklists from `docs/checklists/` referenced or considered?
- Is the file properly linked from related index pages (e.g., `docs/template-list.md`)?

### 5. YAML Frontmatter
- For scoped instructions: Does the `applyTo` pattern correctly match intended files?
- For prompts/agents: Are `agent`, `description`, and other required fields present?
- Is metadata complete and accurate?

## Response Format

Return feedback as a prioritized checklist. For each finding, provide:

1. **Description**: What is the issue or observation?
2. **Category**: Which review focus area does it relate to?
3. **Recommendation**: How to fix or improve it (with examples if applicable).
4. **Severity**: Critical, Warning, or Info.

Use the following priority markers:

- 🔴 **Critical**: Must be fixed before merge (security risks, major standard violations).
- 🟡 **Warning**: Recommended changes for better quality or consistency.
- 🟢 **Info/Praise**: Positive aspects or minor suggestions.

Code or diff to review:
${input:code:Paste the code or diff to review}
