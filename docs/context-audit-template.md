# Context Management Audit for Large Skills

This template helps audit large skills (>100 lines) for context/token efficiency.

---

## Quick Audit Checklist

Use this when reviewing a skill that's longer than expected:

- [ ] **Frontmatter:** Is everything necessary? (name, description, allowed-tools, model)
- [ ] **Intro:** One-sentence summary of what skill does?
- [ ] **Prerequisites:** Only essential requirements listed?
- [ ] **Body structure:** Standard sections (Prerequisites → Steps → Constraints → Output)?
- [ ] **Steps section:** 
  - [ ] Can questions be asked all upfront (not iteratively)?
  - [ ] Are phases clearly marked?
  - [ ] Does each phase have a checkpoint?
- [ ] **Output format:**
  - [ ] Summary (1 line)?
  - [ ] What Changed (structured list)?
  - [ ] Verify (command)?
  - [ ] Next Steps (actionable)?
- [ ] **References:** Are long specs moved to `references/`?
- [ ] **Assets:** Are templates >20 lines in `assets/`?
- [ ] **Scripts:** Are complex commands in `.ps1` scripts?

---

## Issues to Look For

### Issue 1: Prose Instead of Structure

**Symptom:** Long paragraphs explaining what happened.

**Example (bad):**
```markdown
The skill will create several files. First it creates the component file 
which includes the TypeScript class definition. Then it creates the template 
file which has the HTML structure. After that it creates the styles file. 
Finally it updates the barrel export so the component is available. You should 
then write tests and integrate it into your app.
```

**Fix:** Use bullets and structure:
```markdown
## ✅ Summary
Component created: dashboard

## 📝 What Changed
- Created: src/app/dashboard.component.ts (45 lines)
- Created: src/app/dashboard.component.html
- Created: src/app/dashboard.component.scss
- Modified: src/app/index.ts

## 🚀 Next Steps
1. Write unit tests
2. Integrate into parent component
```

**Token impact:** Bad = 200 tokens. Fix = 60 tokens. **70% savings.**

---

### Issue 2: Back-and-Forth Questions

**Symptom:** Skill asks one question at a time instead of gathering all input upfront.

**Example (bad):**
```markdown
### Step 1: Ask component name
"What should I name the component?"
[User answers]

### Step 2: Ask selector prefix
"What selector prefix should I use?"
[User answers]

### Step 3: Ask folder
"Where should I create it?"
[User answers]
```

**Fix:** Ask all upfront:
```markdown
### Phase 1: Gather Input
Ask: component name, selector prefix, folder path, modules to import
[One user response with all inputs]
```

**Message cost:** Bad = 6 messages. Fix = 2 messages. **67% fewer messages.**

---

### Issue 3: Large File Reads

**Symptom:** Skill reads entire large files when only parts are needed.

**Example (bad):**
```bash
cat src/app/index.ts  # If 500 lines, all added to context
```

**Fix:** Use targeted reads:
```bash
grep -n "export" src/app/index.ts  # Only exports
head -50 src/app/index.ts           # First 50 lines
tail -10 src/app/config.ts          # Last 10 lines
```

**Token impact:** Bad = 2000 tokens. Fix = 200 tokens. **90% savings.**

---

### Issue 4: Verbose Command Output

**Symptom:** Skill prints all test/build output to conversation.

**Example (bad):**
```bash
npm test  # Prints hundreds of lines to context
```

**Fix:** Redirect to file:
```bash
npm test > /tmp/test-results.log 2>&1
echo "✓ Tests passed (details: /tmp/test-results.log)"
```

**Token impact:** Bad = 1500+ tokens. Fix = 50 tokens. **97% savings.**

---

### Issue 5: Missing Checkpoints

**Symptom:** Long multi-step workflows with no intermediate summaries.

**Example (bad):**
```markdown
### Steps
1. Parse requirements
2. Analyze codebase
3. Write implementation
4. Add tests
5. Documentation
[No checkpoints between steps]
```

**Fix:** Add phase checkpoints:
```markdown
### Phase 1 — Understand
1. Parse requirements
2. Analyze codebase
✓ Phase 1 complete. Requirements: X. Files: Y.

### Phase 2 — Implement
3. Write implementation
✓ Phase 2 complete. Modified: Z.

### Phase 3 — Verify
4. Add tests
5. Documentation
✓ Phase 3 complete.
```

**Compaction benefit:** Clear checkpoints compress 50-80% better. Summaries keep checkpoint structure.

---

### Issue 6: Duplicate Content Across Skills

**Symptom:** Multiple skills have the same workflow steps.

**Example (bad):**
```
skill-A: "Step 1: Read file X, Step 2: Parse it, Step 3: Validate..."
skill-B: "Step 1: Read file X, Step 2: Parse it, Step 3: Validate..."
```

**Fix:** Delegate instead:
```
skill-B: "Call skill-A, then add custom logic..."
```

**Token impact:** Bad = content duplicated 3x. Fix = one source. **66% reduction.**

---

## Large Skills to Audit

These are the largest skills in the repository:

| Skill | Size | Domain |
|---|---|---|
| `playwright-python` | 581 lines | Playwright |
| `playwright-dotnet` | 501 lines | Playwright |
| `playwright-angular` | 355 lines | Playwright |
| `angular-developer` | 157 lines | Angular |
| `check-prerequisites` | 122 lines | Repo tooling |

**Recommendation:** Start with `playwright-*` skills — longest ones likely have the most optimization potential.

---

## Audit Process

For each large skill:

1. **Read the SKILL.md** — What is it doing?
2. **Count sections:** How many phases? How many questions?
3. **Check output structure:** Does it use Summary/What Changed/Verify/Next Steps?
4. **Spot issues:** Look for prose, back-and-forth, large reads, verbose output
5. **Estimate savings:** How much context could be freed by restructuring?
6. **Document findings:** Create GitHub issue with specific recommendations

---

## Context Audit Template

Copy and fill this template for each large skill audited:

```markdown
## Context Audit: [skill-name]

### Findings

- **Current size:** X lines
- **Estimated context cost:** Y tokens per invocation
- **Main issue:** [prose/back-and-forth/large reads/verbose output/missing checkpoints]

### Recommendations

1. [Specific fix with expected token savings]
2. [Next recommendation]

### Before/After Example

**Before:**
[Show current problematic output]

**After:**
[Show optimized version]

### Token Savings
- Current: X tokens
- Optimized: Y tokens
- Savings: Z% 

### Effort
- [ ] Low (cosmetic changes, restructure output)
- [ ] Medium (refactor steps, add checkpoints)
- [ ] High (split into sub-skills or major redesign)
```

---

## See Also

- [Context Management Guide](../context-management.md)
- [Chronicle Optimization](../chronicle-optimization.md)
- [Skill Writing Rules](../references/skill-writing-rules.md)
