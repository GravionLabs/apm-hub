# Lessons Learned: Building High-Quality Skills

**Date:** 2026-05-03  
**Context:** Pilot optimization of 7 skills (175 minutes)  
**Scope:** Patterns, best practices, gotchas

---

## Table of Contents

1. [Skill Structure](#skill-structure) — Phases, checkpoints, organization
2. [Frontmatter](#frontmatter) — Model, hints, descriptions
3. [Content Quality](#content-quality) — Gotchas, output format, clarity
4. [References & Tools](#references--tools) — Allowlisting, documentation
5. [Domain-Specific Patterns](#domain-specific-patterns) — Types of skills
6. [Audit & Validation](#audit--validation) — How to catch issues early
7. [Optimization Timeline](#optimization-timeline) — Speed benchmarks

---

## Skill Structure

### The 3-Phase Model ✨

**All optimized skills follow:**

```
### Phase 1 — [Prepare/Analyze/Setup]
✓ Checkpoint: [Outcome of Phase 1]
[2-5 numbered steps]

### Phase 2 — [Execute/Implement/Generate]
✓ Checkpoint: [Outcome of Phase 2]
[2-5 numbered steps]

### Phase 3 — [Validate/Test/Deploy]
✓ Checkpoint: [Outcome of Phase 3]
[2-5 numbered steps]
```

**Why it works:**
- Agenten verstehen Progress sofort
- Checkpoints = natural resumption points
- Context Management: 3 phases → 3 compaction windows
- Sequential logic is clear

**Variations by skill type:**
- **Component generation** (angular-component): Scaffold → Enhance → Validate
- **GitHub workflow** (github-issue): Prepare → Plan → Implement → Verify
- **Generator** (typescript-mcp-server-generator): Scaffold → Implement → Configure
- **Domain expert** (angular-developer): Analyze → Generate → Validate

**Lesson:** Even with different purposes, the 3-phase structure adapts well. If you need 4+ phases, the skill might be too large → consider splitting.

---

## Frontmatter

### Required Fields (Updated)

```yaml
---
name: kebab-case-skill-name
description: 'Use this skill when <trigger pattern>. <What it does>.'
allowed-tools: [comma-separated, minimal list]
model: claude-sonnet-4.6  # ← NOW REQUIRED
chronicle-hints: 'single-purpose, structured-output, phases'  # ← NOW REQUIRED
---
```

### Critical Pattern: Descriptions

**❌ WRONG (Descriptive):**
```yaml
description: 'Scaffold an Angular standalone component with PrimeNG.'
```

**✅ RIGHT (Imperative):**
```yaml
description: 'Use this skill when creating Angular standalone components with gv- prefix, 3-file structure (ts/html/scss), and PrimeNG dependencies.'
```

**Why it matters:**
- Users/agents search for "when should I use this?"
- "Use this skill when..." is discoverable
- Specificity helps (gv- prefix, 3-file, PrimeNG are concrete triggers)

**Lesson:** Description is a marketing statement. Answer: "When do I use this?"

### Model Selection

- **claude-sonnet-4.6:** Default for generation, architecture, guidance skills
- **gpt-4.1:** Mechanical tasks, lower-stakes workflows (but we upgraded to Sonnet)
- **claude-haiku-4.5:** Not recommended (too weak for skill-writing)

**Pattern:** All 7 optimized skills use `claude-sonnet-4.6`.

**Lesson:** Better model = better reasoning. Invest in better models for your skills.

### Chronicle Hints

```yaml
chronicle-hints: 'single-purpose, structured-output, phases'
```

**Meaning:**
- **single-purpose:** Skill does one thing well
- **structured-output:** Phases + checkpoints + output format
- **phases:** 3 phases with explicit checkpoints

**Lesson:** These hints help Copilot CLI optimize skill execution even without Chronicle enabled.

---

## Content Quality

### Output Format (Mandatory)

Every skill should end with:

```markdown
## Output Format

### ✅ Summary
[One-line outcome]

### 📝 What Changed
[Structured list: files, count, status]

### ✔️ Verify
[PowerShell commands to validate]

### 🚀 Next Steps
[Numbered list of follow-up actions]
```

**Why mandatory:**
- Agenten wissen, was sie bekommen
- Verification is testable
- Next steps enable chaining (this skill → next skill)
- Structured output compresses ~3x better (Context Management)

**Example (github-pull-request):**
```markdown
### ✅ Summary
PR #42 created for issue #42 on branch `feature/foo-bar`.

### 📝 What Changed
- PR URL: https://github.com/.../pull/42
- Title: feature: add foo bar (#42)
- Issue link: Closes #42
- CI status: Running
- Files: 3 (23 lines changed)

### ✔️ Verify
gh pr view --web
gh pr checks

### 🚀 Next Steps
1. Share PR link
2. Monitor CI
3. Request review
```

**Lesson:** Output format is not optional. It's part of the specification now.

### Gotchas (Expanded Requirement)

**Before optimization:**
- 0-2 Gotchas (generic)

**After optimization:**
- 3-5 Gotchas (specific to domain)

**Examples that work:**
- "Always use MCP (or GH CLI) to read issue first — don't guess from issue number" (github-issue)
- "Don't throw errors from tool handlers — always return `isError: true`" (typescript-mcp-server-generator)
- "`ng build` must always be run after code generation to catch compilation errors early. Do not skip this step." (angular-developer)

**Why specific gotchas matter:**
- They prevent agent errors (save ~1 hour per user)
- They show expertise (domain knowledge)
- They're audit-checkable (does skill address known mistakes?)

**Lesson:** Gotchas are not filler. They're bug prevention.

### Prerequisites

**Before optimization:**
- Often implicit or missing

**After optimization:**
- Always explicit:
  ```markdown
  ## Prerequisites
  - Angular project or intent to create one
  - Familiarity with TypeScript (recommended)
  - Angular CLI installed (or willingness to use npx)
  ```

**Why it matters:**
- Agenten können checken, bevor sie starten
- Prevents "I don't have this installed" errors
- Clear expectations for users

**Lesson:** Every skill needs explicit prerequisites.

---

## References & Tools

### Allowed-Tools: Be Minimal

**❌ WRONG (Overly broad):**
```yaml
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_create_pull_request mcp_github_get_issue
```

**✅ RIGHT (Justified):**
```yaml
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_create_pull_request mcp_github_get_issue
# (Same, but each tool has documented usage in body)
```

**Principle:** Only allow tools that:
1. Are documented in body with example
2. Are safe for automation
3. Are cross-platform (PowerShell, not Bash)

**Lesson:** Tool allowlisting is a security & clarity question, not a feature request.

### References Organization

**Pattern that works:**
- Load references in Phase 1 (Analyze & Prepare)
- Reference relative paths only: `[name.md](references/name.md)`
- No reference chains (don't reference another reference)
- Max 1 level deep

**Example (angular-developer):**
```markdown
### Phase 1 — Analyze & Prepare
2. Load task-specific references:
   - Components: Read [references/components.md](references/components.md)
   - Forms: Read [references/signal-forms.md](references/signal-forms.md)
   - Testing: Read [references/testing-vitest.md](references/testing-vitest.md)
```

**Lesson:** Explicit reference loading saves agents from "where do I find X?" confusion.

---

## Domain-Specific Patterns

### Pattern 1: Component Generators (angular-component)
- **Structure:** Scaffold → Enhance → Validate
- **Output:** Created files, structure, verification
- **Time:** 15-20 min optimization
- **Gotchas:** Name matching, folder structure, prefix consistency
- **Lesson:** Generator skills benefit most from structured output

### Pattern 2: Workflow Skills (github-issue, github-pull-request)
- **Structure:** Prepare → Execute → Verify
- **Output:** Branch, PR, CI status
- **Time:** 18-20 min optimization
- **Gotchas:** Version handling, fallback strategies, linking
- **Lesson:** Workflow skills need explicit checkpoints for resumption

### Pattern 3: Meta-Skills (skill-write, skill-audit)
- **Structure:** Load → Audit/Execute → Report
- **Output:** Generated file, validation report
- **Time:** 20-22 min optimization
- **Gotchas:** Self-reference, validation consistency
- **Lesson:** Meta-skills must demonstrate the patterns they teach

### Pattern 4: Domain Expert Skills (angular-developer)
- **Structure:** Analyze → Generate → Validate
- **Topics:** Cross-cutting guides (not in phases)
- **Time:** 50-60 min optimization (largest refactor)
- **Gotchas:** 5-10 domain-specific issues
- **Lesson:** Expert skills need clear separation of phases from topics

### Pattern 5: Generator Frameworks (typescript-mcp-server-generator)
- **Structure:** Scaffold → Implement → Configure
- **Output:** Project structure, tools, tests
- **Time:** 25-30 min optimization
- **Gotchas:** PowerShell enforcement, version handling, config validation
- **Lesson:** Generators must show safe patterns (PowerShell, zod validation)

---

## Audit & Validation

### Pre-Audit Checklist

Before running `@skill-audit`, verify:

- ✅ **Frontmatter:** name, description (imperative), allowed-tools, model, chronicle-hints
- ✅ **Structure:** 3 phases with checkpoints
- ✅ **PowerShell:** All code blocks are ` ```powershell `, not bash
- ✅ **Output Format:** Summary/What Changed/Verify/Next Steps present
- ✅ **Gotchas:** 3-5 domain-specific gotchas
- ✅ **References:** Loaded in Phase 1, relative paths, no chains
- ✅ **Tools:** Each allowed-tool documented with example

### Audit Findings & Fixes

**Common findings (from our audits):**

| Finding                                    | Severity      | Fix                               | Time      |
| :----------------------------------------- | :------------ | :-------------------------------- | :-------- |
| Description lacks "Use this skill when..." | 🔴 Critical   | Rewrite description imperatively  | 2 min     |
| Missing chronicle-hints                    | 🔴 Critical   | Add to frontmatter                | 1 min     |
| Bash code blocks (` ```bash `)             | 🔴 Critical   | Replace with ` ```powershell `    | 5-10 min  |
| Missing Output Format                      | 🟡 Important  | Add standard format section       | 5 min     |
| Gotchas ≤2                                 | 🟡 Important  | Expand to 3-5 domain-specific     | 5-10 min  |
| Tools not documented                       | 🟡 Important  | Add examples in body              | 5 min     |
| Phase structure unclear                    | 🟡 Important  | Reorganize into 3 explicit phases | 10-15 min |
| Missing Prerequisites                      | 🟢 Suggestion | Add explicit section              | 3 min     |

**Lesson:** Most findings are fixable in <10 minutes. skill-update automates this.

---

## Optimization Timeline

### Benchmark Data (from 7 pilot skills)

| Type                                        | Complexity | Time      | Notes                               |
| :------------------------------------------ | :--------- | :-------- | :---------------------------------- |
| Vorbild (angular-component)                 | Low        | 15 min    | Already had structure, added format |
| Meta (skill-write, skill-audit)             | Medium     | 20-22 min | Must be self-demonstrating          |
| Struktur (github-issue-*, typescript-mcp-*) | Medium     | 18-28 min | Phase conversion straightforward    |
| Expert (angular-developer)                  | High       | 52 min    | Topics + phases restructuring       |

### Time Breakdown (52-min expert skill)

- 5 min: Read existing skill, understand scope
- 15 min: Plan 3 phases + checkpoint structure
- 15 min: Rewrite phases + add checkpoints
- 10 min: Add output format + gotchas
- 5 min: Sync to 3 locations + verify
- 2 min: Document findings

**Total:** 52 minutes (consistent!)

### Estimated Phase 7 Timeline

- **Per-skill:** 7-10 min average (skill-update automates most)
- **92 skills × 8.5 min:** ~13 hours
- **Buffer (25%):** ~3 hours
- **Total:** ~16 hours (across 4 sessions)

---

## Quality Indicators

### High-Quality Skills Exhibit

- ✅ 3 explicit phases with checkpoints
- ✅ Descriptions start with "Use this skill when..."
- ✅ ≥3 domain-specific gotchas
- ✅ Full output format (Summary/What Changed/Verify/Next Steps)
- ✅ All code blocks are PowerShell
- ✅ Allowed-tools documented with examples
- ✅ References loaded in Phase 1
- ✅ Prerequisites explicit
- ✅ Passes skill-audit with 0 critical findings

### Audit Pass Rates (Expected)

- **Excellent (0 critical, ≤2 suggestions):** ~40% of skills
- **Good (0 critical, 3-5 suggestions):** ~40% of skills
- **Needs Review (1-2 critical):** ~15% of skills
- **Blocked (3+ critical):** ~5% of skills (MEGA skills, etc.)

---

## Key Takeaways

1. **Phases are mandatory:** 3 phases + 3 checkpoints = standard
2. **Output format is non-negotiable:** Summary/What Changed/Verify/Next Steps
3. **Frontmatter matters:** Model + chronicle-hints + imperative description
4. **Gotchas prevent errors:** 3-5 domain-specific, not generic
5. **PowerShell everywhere:** Bash is a critical issue
6. **Tools must be justified:** Document each allowed-tool usage
7. **References load in Phase 1:** Agenten know what to read upfront
8. **Meta-skills demonstrate:** They teach by example
9. **Output format enables chaining:** This skill → next skill seamlessly
10. **Optimization is predictable:** ~8 min per skill average, pattern is consistent

---

## Resources

- [Phase 6: Quality Gate](./phase-6-quality-gate.md)
- [Phase 7: Rollout Strategy](./phase-7-rollout-strategy.md)
- [Pilot Results (all 8 skills)](./pilot-results/)
- [Chronicle Optimization](./chronicle-optimization.md)
- [Context Management](./context-management.md)
