# Chronicle Optimization Checklist for Skills

Use this checklist when creating or updating skills to ensure they work well with GitHub Copilot CLI's Chronicle session tracking system.

---

## Pre-Creation Review

- [ ] **Purpose is focused:** Skill does one clear thing (create component, audit code, start issue, etc.), not multiple things
- [ ] **Not doing Chronicle's job:** Skill doesn't try to summarize sessions or manage history itself — Chronicle does that
- [ ] **Skill is self-contained:** Skill succeeds or fails clearly; doesn't require manual follow-up decisions

---

## Frontmatter

- [ ] Frontmatter has:
  ```yaml
  ---
  name: kebab-case-name
  description: 'One sentence: what this skill creates/does'
  allowed-tools: [minimal set]
  model: [appropriate for task complexity]
  ---
  ```
- [ ] `description` answers: "When should I use this skill?" (not "how does it work")
- [ ] Optional `chronicle-hints: 'single-purpose, structured-output, phases'` added
- [ ] No hardcoded paths, org names, or credentials in frontmatter

---

## Body Structure

- [ ] **Intro section:** 1-2 sentences, plain English, explains what skill does
- [ ] **Prerequisites or Setup:** Any required tools/auth (e.g., `gh auth status`)
- [ ] **Steps section:** Clear phases (Understand → Implement → Verify)
- [ ] Each phase has a goal and checkpoint summary
- [ ] **Constraints or Gotchas:** Common issues and how to fix them
- [ ] **Output format:** Documented at end of skill

---

## Output Format (For Chronicle)

Skill must output in this order:

1. **Summary** (1 line)
   ```
   ✅ [What was created/done]
   ```

2. **What Changed** (structured list with file paths)
   ```
   - Created: src/app/header/header.component.ts (52 lines)
   - Modified: src/app/index.ts (added export)
   ```

3. **Verification** (how to verify the work)
   ```
   npm test
   npm run build
   ```

4. **Next Steps** (what comes after)
   ```
   1. Add unit tests
   2. Integrate into parent
   ```

**Good example:**
```markdown
## ✅ Summary
Angular component `dashboard` created as standalone.

## 📝 What Changed
- Created src/app/dashboard/dashboard.component.ts (45 lines)
- Created src/app/dashboard/dashboard.component.html (template)
- Created src/app/dashboard/dashboard.component.scss (styles)
- Updated src/app/index.ts (added export)

## ✔️ Verify
Run tests: `ng test --include='**/dashboard.component.spec.ts'`
Build: `ng build`

## 🚀 Next Steps
1. Write unit tests (dashboard.component.spec.ts)
2. Integrate into AppComponent or use in app.routes
3. Test in dev: `ng serve`
```

---

## Phase Checkpoints

If skill has multiple phases (Understand, Implement, Verify):

- [ ] Each phase outputs a checkpoint when complete:
  ```
  ✓ Phase 1 (Understand) complete.
  - Analyzed issue requirements
  - Identified files to modify: src/auth/, src/api/
  - Ready for Phase 2 (Implement).
  ```

- [ ] Checkpoints include what was learned/done in the phase
- [ ] Checkpoints make it clear what comes next
- [ ] No checkpoint is longer than 5 bullet points

---

## Token & Context Efficiency

- [ ] Skill avoids wall-of-text outputs
- [ ] File contents are shown only when necessary (not entire files)
- [ ] Errors are descriptive but brief (not full stack traces in output)
- [ ] If output is verbose, move to log files (`.log`, `/tmp`)
- [ ] Skill completes in a "summarizable" way for Chronicle

---

## Error Handling

- [ ] Errors explain:
  1. What went wrong (clear message)
  2. Why it happened (root cause)
  3. How to fix it (actionable step)

**Good:**
```
❌ Error: TypeScript file has syntax errors.
Reason: Line 45 is missing semicolon.
Fix: Correct the syntax and try again, or run: npx eslint --fix
```

**Avoid:**
```
Error in component generation. Exit code 1. See logs.
```

---

## Testing for Chronicle Optimization

- [ ] Run the skill once: does the output make sense as a summary in 6 months?
- [ ] Check: Could you resume this session and know what was done?
- [ ] Check: Could `/chronicle standup` create a useful report from this?
- [ ] Check: Does the final output clearly show what changed and what to do next?

---

## Comparison: Before & After

### Before (Non-optimized)

```markdown
## Instructions

The skill will ask you some questions, then create some files. Make sure you answer all questions carefully.

1. First, you will be asked for inputs
2. Then, the skill creates the files
3. The skill will tell you what happened

## Output

Just see what gets printed.
```

### After (Chronicle-optimized)

```markdown
Create one Angular component in your project.

## What this skill does
Scaffolds a standalone Angular component (TypeScript, template, styles) following your project conventions in 3 files.

## Steps

### Phase 1 — Gather & Validate
1. Ask: component name (kebab-case), selector prefix, folder path
2. Validate inputs (check folder exists, name valid)
3. ✓ Output: "Phase 1 complete. Ready to create component."

### Phase 2 — Create Files
1. Create `{name}.component.ts` (standalone component class)
2. Create `{name}.component.html` (minimal template)
3. Create `{name}.component.scss` (empty stylesheet)
4. Update barrel `index.ts` or `public-api.ts` export

### Phase 3 — Verify
1. Check all files exist and are syntactically valid
2. ✓ Output structured summary

## Output Format

### ✅ Summary
{Component name} component created at {path}.

### 📝 What Changed
- Created {path}/{name}.component.ts (52 lines)
- Created {path}/{name}.component.html
- Created {path}/{name}.component.scss
- Updated {path}/index.ts

### ✔️ Verify
ng build && ng test

### 🚀 Next Steps
1. Write unit tests
2. Integrate into parent component
3. Test in dev server
```

---

## Apply to Existing Skills

To update an existing skill for Chronicle optimization:

1. **Review current output:** Does it match the Summary/What Changed/Verification/Next Steps format?
2. **Add phases:** Break workflow into clear phases (Understand → Implement → Verify)
3. **Add checkpoints:** Output phase completion summaries
4. **Simplify instructions:** Make them scannable, not prose
5. **Test:** Run once, check if summary makes sense

---

## See Also

- [Chronicle Optimization Guide](../chronicle-optimization.md)
- [Skill Writing Rules](../references/skill-writing-rules.md)
- [Context Management](../context-management.md)
- [GitHub Copilot CLI Chronicle](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/chronicle)
