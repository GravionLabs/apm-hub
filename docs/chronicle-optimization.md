# Chronicle Optimization for Skills

GitHub Copilot CLI's **Chronicle** feature records every session locally and provides tools like `/chronicle standup`, `/chronicle tips`, and `/chronicle improve` to enhance your workflow. This guide explains how to optimize skills for better session tracking and summarization.

---

## What is Chronicle?

Chronicle is a session history system that:
- **Tracks** every prompt, response, tool call, and file modification in `~/.copilot/session-state/`
- **Summarizes** conversation history automatically when context fills up (~80%)
- **Generates insights** via `/chronicle standup` (what you worked on), `/chronicle tips` (productivity tips), and `/chronicle improve` (custom instructions)

**Key insight:** Chronicle summaries are more effective when skills are **focused, structured, and explicit about outcomes**.

---

## Design Principles for Chronicle-Optimized Skills

### 1. **Be Focused, Not Sprawling**

**Why:** Chronicle creates better summaries when skills have a clear, single purpose.

**Good:**
- `angular-component` — Create one Angular component
- `skill-write` — Create one skill file
- `github-pull-request` — Create one pull request

**Avoid:**
- `omniscient-fixer` — Fix bugs, refactor code, write tests, AND generate docs in one skill
- `universal-generator` — Generate anything, anywhere

**Chronicle benefit:** Focused skills produce cleaner summaries. `/chronicle standup` will say "Created 5 Angular components" instead of "Did various things".

---

### 2. **Structure Output Explicitly**

**Why:** Chronicle summaries capture outcomes better when output is structured.

**Good:**
```
## ✅ Completed
- Created src/app/header/header.component.ts
- Created src/app/header/header.component.html
- Created src/app/header/header.component.scss
- Added to src/app/index.ts

## 📍 Next Steps
- Add unit tests in spec file
- Integrate into AppComponent
```

**Avoid:**
```
Done! Header component created. You can now add it wherever you want and write tests if you feel like it.
```

**Chronicle benefit:** Structured summaries are compact and accurate when compaction occurs (~80% context).

---

### 3. **Make Checkpoints Explicit**

**Why:** Chronicle uses checkpoints to resume long sessions without losing context.

**Good skill design:**

```markdown
## Steps

### Phase 1 — Understand
- Analyze requirements
- Plan changes

### Phase 2 — Implement  
- Write code
- Add tests

### Phase 3 — Verify
- Run tests
- Push changes
```

**After each phase**, output a checkpoint summary:

```
✓ Phase 1 complete. 
- Requirements understood: new auth flow with JWT refresh tokens
- Files to modify: src/auth/, src/api/
- Ready to implement in Phase 2.
```

**Chronicle benefit:** Clear phases help `/chronicle improve` generate targeted suggestions like "Always plan before implementing" or "Break work into phases".

---

### 4. **Use Consistent Output Sections**

Skills should always output these sections (in order):

1. **Summary** — One-line outcome
2. **What Changed** — Files modified/created (with paths)
3. **Verification** — How to verify the work (commands to run)
4. **Next Steps** — What comes next (tests, integration, etc.)

**Example:**

```markdown
## Summary
✅ Angular component `header` created with TypeScript, template, and styles.

## What Changed
- ✅ src/app/header/header.component.ts (55 lines)
- ✅ src/app/header/header.component.html (8 lines)
- ✅ src/app/header/header.component.scss (12 lines)
- ✅ src/app/index.ts (added export)

## Verification
```bash
ng test --include='**/header.component.spec.ts'
ng build
```

## Next Steps
1. Write unit tests in `header.component.spec.ts`
2. Import into `AppComponent`
3. Test in dev server: `ng serve`
```

**Chronicle benefit:** Consistent sections make summaries scannable and compaction more effective.

---

## Implementation Checklist

When creating or updating a skill for Chronicle optimization:

- [ ] **Single purpose:** Skill does one thing well, not many things partially
- [ ] **Phases:** Work breaks into 2-4 clear phases with phase summaries
- [ ] **Explicit output:** Final output includes Summary, What Changed, Verification, Next Steps
- [ ] **Checkpoints:** Phase completions output checkpoint summaries
- [ ] **Token efficiency:** Skill avoids wall-of-text output (use structured lists)
- [ ] **Failures are clear:** Errors explain what went wrong and what to do next
- [ ] **Instructions short:** Initial instruction (<200 words) explains what skill does in 1-2 sentences

---

## Example: Angular Component Skill (Chronicle-Optimized)

### Before (Non-optimized)

```markdown
## Overview
Use this skill to create an Angular component. It will ask you for the name, selector, imports, and folder. It will then create the component files and add to the barrel.
```

### After (Chronicle-Optimized)

```markdown
---
name: angular-component
description: 'Scaffold an Angular standalone component with 3-file structure (ts/html/scss) following project conventions.'
chronicle-hints: 'single-purpose, structured-output, phases'
---

Create one standalone Angular component.

## What this skill does
Generates a ready-to-use Angular component with TypeScript, template, and stylesheet. **One component per session.**

## Steps (Phases)

### Phase 1 — Gather Input
1. Ask: component name (kebab-case), selector prefix, target folder
2. Validate inputs
3. ✓ Output: "Phase 1 complete. Ready to create {name} component."

### Phase 2 — Create Files
1. Create `<name>.ts` (component class)
2. Create `<name>.html` (template)
3. Create `<name>.scss` (styles)
4. Update barrel export (`index.ts` / `public-api.ts`)
5. ✓ Output: "Phase 2 complete. 4 files created."

### Phase 3 — Verify
1. Check files exist and are valid
2. Show import path
3. ✓ Output structured summary

## Output Format

### ✅ Summary
Angular component `{name}` created.

### 📝 What Changed
- `src/app/{path}/{name}.component.ts` (45 lines)
- `src/app/{path}/{name}.component.html` (minimal template)
- `src/app/{path}/{name}.component.scss` (empty)
- Updated barrel: `src/app/{path}/index.ts`

### ✔️ Verification
```bash
cat src/app/{path}/{name}.component.ts  # Verify class structure
ng build  # Verify compilation
```

### 🚀 Next Steps
1. Add unit tests: `src/app/{path}/{name}.component.spec.ts`
2. Integrate into parent component
3. Run: `ng serve && ng test`
```

**Chronicle benefits:**
- Clear phases → better summaries on resume
- Structured output → compact when compaction happens
- Explicit verification → user knows what to do next
- Single purpose → `/chronicle standup` will show "Created components" not "Did random Angular stuff"

---

## When Adding Chronicle Hints to Frontmatter

Add an optional `chronicle-hints` field to SKILL.md frontmatter:

```yaml
---
name: my-skill
description: 'Does one thing'
chronicle-hints: 'single-purpose, structured-output, phases'
---
```

**Available hints** (for tooling/documentation):
- `single-purpose` — Skill does one focused task
- `structured-output` — Output uses Summary/What Changed/Verification/Next Steps
- `phases` — Work breaks into clear phases with checkpoints
- `token-aware` — Skill optimizes for token efficiency
- `resumable` — Skill can be resumed mid-work without losing progress

These hints help skill-write templates and documentation systems.

---

## Troubleshooting

### "My skill creates a long conversation"

**Issue:** Too much back-and-forth or verbose output.

**Fix:**
1. Ask all required questions upfront, not iteratively
2. Batch output into one final structured summary
3. Move verbose logs to `/tmp` or `.log` files, not conversation

### "Chronicle summaries are vague about my work"

**Issue:** Skill output is unstructured prose.

**Fix:**
1. Add explicit "Summary", "What Changed", "Next Steps" sections
2. Use bullet points and tables, not paragraphs
3. Include file paths, not generic descriptions

### "/chronicle improve doesn't suggest useful instructions"

**Issue:** Skill patterns aren't clear enough for analysis.

**Fix:**
1. Make phases explicit (`### Phase 1 —`, `### Phase 2 —`)
2. Add checkpoint summaries after each phase
3. Consistent output format across all runs

---

## See Also

- [GitHub Copilot CLI Chronicle](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/chronicle)
- [Skill Writing Guide](../references/skill-writing-rules.md)
- [Context Management](../context-management.md)
