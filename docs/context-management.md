# Context Management for Skills

GitHub Copilot CLI has a fixed **context window** (varies by model) that fills up during long sessions. Understanding context management helps you design skills that work well in long sessions without running out of space.

---

## What is the Context Window?

The context window is the total amount of information that the AI model can consider at one time. It includes:

- **System instructions & tools** (fixed overhead)
- **Your messages** (prompts you send)
- **Copilot's responses** (everything Copilot says)
- **Tool calls & results** (files read, commands run)

As your conversation progresses, the window fills up. When it reaches ~80% capacity, Copilot CLI automatically **compacts** the conversation into a summary.

---

## Why Context Matters for Skills

Skills contribute to context fill-up when they:

1. **Read large files** — Each file read is added to the context
2. **Run verbose commands** — Output is added to the context
3. **Generate long output** — Skill results are added to the context
4. **Provide verbose explanations** — Every message fills the window

Skills that are **token-aware** work better in long sessions.

---

## Checking Your Context Usage

While using Copilot CLI, you can check context usage at any time:

```bash
/context
```

This shows:
- **System/Tools**: Fixed overhead (usually 10-20%)
- **Messages**: Your conversation so far
- **Free Space**: How much room is left
- **Buffer**: Reserved space that triggers compaction (~20%)

---

## What Happens During Compaction

When context reaches ~80% full:

1. Copilot CLI creates a **snapshot** of the conversation
2. Sends it to the AI model with a special prompt: "Summarize this conversation"
3. The summary captures:
   - **Goals**: What the conversation was trying to accomplish
   - **Technical details**: Important code, file paths, decisions made
   - **Important files**: Which files were modified or created
   - **Next steps**: What to do next to resume
4. Replaces the full conversation with the compact summary
5. Continues with the new messages

**Result:** The conversation history is compressed by 50-80%, freeing up space for new work.

---

## Designing Token-Aware Skills

### 1. **Ask Everything Upfront, Not Iteratively**

**Why:** Back-and-forth questions add messages, filling context faster.

**Good:**
```markdown
## Gather Input
Ask once: component name, selector prefix, target folder, imports needed
(1 message from skill, 1 from user)
```

**Avoid:**
```markdown
## Step 1: Ask component name
"What component name?" — user answers
## Step 2: Ask selector prefix
"What selector prefix?" — user answers
## Step 3: Ask folder
"What folder?" — user answers
(6 messages total)
```

**Context impact:** Good = 2 messages. Avoid = 6 messages. In a long session with many skills, this adds up.

### 2. **Return Structured Output, Not Prose**

**Why:** Structured data (lists, tables) compresses better than prose when compaction happens.

**Good:**
```markdown
## ✅ Summary
Created component.

## 📝 Files
- src/header.ts (52 lines)
- src/header.html
- src/header.scss

## 🚀 Next
1. Write tests
2. Integrate
```

**Avoid:**
```markdown
## Result
Well, I created a new component for you. It's a standalone Angular component with all the usual stuff — 
a TypeScript file with the component class, an HTML template, and some SCSS for styling. The files were 
created in src/ and I also updated the barrel export. You should probably write some unit tests next and 
then integrate it somewhere. Let me know if you need help with any of that.
```

**Context impact:** Good = ~100 tokens. Avoid = ~300 tokens (3x larger).

### 3. **Avoid Reading Entire Files**

**Why:** File content is added to context. Reading 1MB of code fills significant space.

**Good:**
```bash
# Read only the relevant part
head -50 src/app/index.ts  # First 50 lines
grep -n "export" src/app/index.ts  # Only export statements
```

**Avoid:**
```bash
# Read entire files if they're large
cat src/app/index.ts  # If it's 500 lines, all added to context
```

**Context impact:** Large files = thousands of tokens. Targeted reads = hundreds.

### 4. **Redirect Verbose Output to Files**

**Why:** Command output gets added to context.

**Good:**
```bash
npm test > test-results.log 2>&1
echo "✓ Tests passed (details in test-results.log)"
```

**Avoid:**
```bash
npm test  # All output printed to conversation
```

**Context impact:** Test output can be 1000+ lines. Redirecting keeps context clean.

### 5. **Use Phases with Clear Checkpoints**

**Why:** Checkpoints help with resume on long sessions and compress better.

**Good:**
```markdown
### Phase 1 — Parse
[Do work]
✓ Parsed requirements.
- Issue: Add JWT refresh
- Files: auth/, api/

### Phase 2 — Implement
[Do work]
✓ Implemented auth refresh.
- Modified: src/auth/refresh.ts
- Tests: src/auth/refresh.spec.ts

### Phase 3 — Verify
[Do work]
✓ All tests passing.
```

**Why it works:** Each checkpoint is compact. Compaction can keep checkpoints while summarizing verbose work.

---

## Token-Aware Output Template

When skills output results, use this structure (optimized for context):

```markdown
## ✅ Summary
[One line: what was done]

## 📝 What Changed
- Created: path/file.ts (X lines)
- Modified: path/file2.ts
- Deleted: path/old.ts

## ✔️ Verify
[Command to verify, e.g., `npm test`]

## 🚀 Next Steps
1. [Actionable step]
2. [Actionable step]
```

**Why:** This structure is scannable and compresses well. Compaction will keep all four sections intact.

---

## Gotchas

### "My skill works fine alone but fills context in long sessions"

**Issue:** Skill output is compact, but it's used repeatedly in a long session.

**Fix:** Use phases and checkpoints so compaction can compress earlier work while keeping progress tracking.

### "Compaction keeps forgetting important details"

**Issue:** Important details aren't captured in the "next steps" section.

**Fix:** Make checkpoints explicit and include important file paths and decisions in phase output.

### "My LSP server reads lots of context"

**Issue:** LSP operations return large results.

**Fix:** LSP is designed for this — it returns structured data that compresses better than text-based search.

### "Tests output fills the entire context"

**Issue:** `npm test` output is verbose.

**Fix:** Redirect to file: `npm test > /tmp/test-results.log 2>&1 && echo "✓ Passed"`.

---

## Monitoring Context in Your Own Sessions

Try this in an interactive Copilot CLI session:

```bash
# See current context usage
/context

# After adding some work, check again
/context

# Manually trigger compaction if needed
/compact
```

Watch how context fills and compaction works. This helps you understand token efficiency better.

---

## Best Practices Summary

| Practice                                    | Context Saved | Difficulty |
| :------------------------------------------ | :------------ | :--------- |
| Ask all questions upfront                   | Medium        | Easy       |
| Return structured output                    | Medium        | Easy       |
| Avoid reading large files                   | High          | Easy       |
| Redirect command output to files            | High          | Easy       |
| Use phases & checkpoints                    | Medium        | Medium     |
| Optimize LSP usage (use it, don't avoid it) | Low           | Hard       |

---

## See Also

- [Chronicle Optimization](./chronicle-optimization.md)
- [GitHub Copilot CLI Context Management](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/context-management)
- [LSP Configuration](./lsp-configuration.md)
